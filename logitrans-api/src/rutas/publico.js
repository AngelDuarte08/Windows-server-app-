// PÚBLICO (sin sesión): login único (clientes y empleados), registro, verificación de correo y 2FA.
// Todas estas rutas tienen rate limit y responden con mensajes genéricos.
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const { authenticator } = require('otplib');
const prisma = require('../db');
const { ORIGEN, LDAP } = require('../config');
const { ROLES, GRUPOS_ROL, PUBLICO } = require('../roles');
const { z, validar, esquemaPassword } = require('../validacion');
const { limiteLogin, limiteRegistro } = require('../seguridad/limites');
const { registrar } = require('../seguridad/bitacora');
const { cifrar, descifrar, sha256 } = require('../seguridad/cifrado');
const { opcionesCookie, emitirSesion, emitirTemporal, verificarTemporal } = require('../seguridad/sesion');
const { autenticarAD } = require('../servicios/activeDirectory');

authenticator.options = { window: 1 };      // tolera ±30 s de desfase en el reloj del teléfono

// --- Login único (CU-01 y CU-08) ---------------------------------------------------------------
// 1) Se busca el identificador en la tabla clientes (correo).
// 2) Si no es cliente, se trata como empleado: la contraseña se valida contra Active Directory
//    (la BD no guarda contraseñas de empleados) y la tabla empleados dice si sigue activo y su rol.
// Los clientes necesitan además su código 2FA (segundo paso); los empleados entran directo.
const esquemaLogin = z.object({
  usuario: z.string().trim().toLowerCase().min(3).max(120),   // correo del cliente o usuario del dominio
  password: z.string().min(1).max(128) });

// Hash ficticio para que el tiempo de respuesta sea igual exista o no la cuenta
const HASH_FICTICIO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);
const falloGenerico = (res) => res.status(401).json({ error: 'Credenciales inválidas' });

// "juan.perez" o "juan.perez@logitrans.local" → "juan.perez"; cualquier otra cosa no es cuenta del dominio
const dominio = LDAP.DOMINIO.toLowerCase().replace(/\./g, '\\.');
const RE_USUARIO_AD = new RegExp(`^([a-z0-9.]{3,20})(@${dominio})?$`);   // solo letras, números y punto: evita inyección LDAP
const aUsuarioAD = (ident) => RE_USUARIO_AD.exec(ident)?.[1] ?? null;

async function login(req, res) {
  const { usuario, password } = req.body;
  const cli = await prisma.cliente.findUnique({ where: { email: usuario } });
  if (cli) return loginCliente(req, res, cli, password);

  const usuarioAD = aUsuarioAD(usuario);
  if (!usuarioAD) {                                  // ni cliente ni cuenta del dominio
    await bcrypt.compare(password, HASH_FICTICIO);
    await registrar(req, 'LOGIN', 'FALLO');
    return falloGenerico(res);
  }
  return loginEmpleado(req, res, usuarioAD, password);
}

// Empleado: Active Directory valida la contraseña; su grupo GG_* define el rol
async function loginEmpleado(req, res, usuario, password) {
  try {
    const ad = await autenticarAD(usuario, password);
    const roles = [...new Set(ad.grupos.map((g) => GRUPOS_ROL[g]).filter(Boolean))];
    if (roles.length !== 1) throw new Error('sin grupo autorizado o con más de uno');   // FA-4
    const [rol] = roles;

    const existente = await prisma.empleado.findUnique({ where: { adObjectGuid: ad.guid } });
    if (existente && !existente.activo) throw new Error('acceso revocado');  // CU-04
    const emp = await prisma.empleado.upsert({
      where: { adObjectGuid: ad.guid },
      update: { rol, nombre: ad.nombre, ultimoAcceso: new Date() },
      create: { adObjectGuid: ad.guid, usuarioAD: usuario, nombre: ad.nombre,
                rol, activo: true, ultimoAcceso: new Date() } });
    emitirSesion(res, { id: emp.id, tipo: 'EMPLEADO', rol });
    await registrar(req, 'LOGIN_EMPLEADO', 'EXITO', { tipo: 'EMPLEADO', id: emp.id });
    res.json({ nombre: emp.nombre, rol, tipo: 'EMPLEADO' });
  } catch {
    await registrar(req, 'LOGIN_EMPLEADO', 'FALLO');
    falloGenerico(res);
  }
}

// Cuenta bloqueada 30 min al llegar a 5 intentos fallidos (contraseña o código)
async function contarFallo(cli) {
  await prisma.cliente.update({ where: { id: cli.id }, data: {
    intentosFallidos: { increment: 1 },
    bloqueadoHasta: cli.intentosFallidos + 1 >= 5 ? new Date(Date.now() + 30 * 60000) : undefined } });
}
const estaBloqueado = (cli) => cli.bloqueadoHasta && cli.bloqueadoHasta > new Date();

// Cliente, paso 1: contraseña. Si es correcta, se pide el código 2FA (cookie temporal de 5 min)
async function loginCliente(req, res, cli, password) {
  const bloqueado = estaBloqueado(cli);
  const passOk = await bcrypt.compare(password, cli.passwordHash);
  const listo = !bloqueado && cli.emailVerificado && cli.totpActivo && cli.totpSecreto;
  if (!passOk || !listo) {
    if (!bloqueado) await contarFallo(cli);
    await registrar(req, 'LOGIN_CLIENTE', 'FALLO', { tipo: 'CLIENTE', id: cli.id });
    return falloGenerico(res);
  }
  emitirTemporal(res, 'login2fa', cli.id);
  res.json({ requiere2FA: true });
}

// Cliente, paso 2: código de la app autenticadora
async function loginCliente2FA(req, res) {
  let cli;
  try {
    cli = await prisma.cliente.findUnique({ where: { id: verificarTemporal(req, 'login2fa').id } });
  } catch {
    return res.status(401).json({ error: 'El tiempo para escribir el código expiró, inicia sesión de nuevo' });
  }
  const ok = cli && !estaBloqueado(cli) && cli.totpSecreto
             && authenticator.check(req.body.codigo, descifrar(cli.totpSecreto));
  if (!ok) {
    if (cli && !estaBloqueado(cli)) await contarFallo(cli);
    await registrar(req, 'LOGIN_CLIENTE_2FA', 'FALLO', cli ? { tipo: 'CLIENTE', id: cli.id } : {});
    return res.status(401).json({ error: 'Código incorrecto' });
  }
  await prisma.cliente.update({ where: { id: cli.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
  res.clearCookie('login2fa', opcionesCookie);
  emitirSesion(res, { id: cli.id, tipo: 'CLIENTE', rol: ROLES.CLIENTE });
  await registrar(req, 'LOGIN_CLIENTE', 'EXITO', { tipo: 'CLIENTE', id: cli.id });
  res.json({ nombre: cli.razonSocial, rol: ROLES.CLIENTE, tipo: 'CLIENTE' });
}

// --- CU-07: registro de clientes ---------------------------------------------------------------
const esquemaRegistro = z.object({
  razonSocial: z.string().trim().min(3).max(150),
  rfc: z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().max(120)
    .refine((e) => !e.endsWith(`@${LDAP.DOMINIO.toLowerCase()}`)),   // reservado para empleados
  password: esquemaPassword });

// En producción aquí se enviaría el correo por SMTP; en laboratorio se imprime en consola
async function enviarCorreoVerificacion(email, enlace) {
  console.log(`[CORREO] Para: ${email} — Confirma tu cuenta: ${enlace}`);
}

async function registrarCliente(req, res) {
  const { razonSocial, rfc, email, password } = req.body;
  const respuesta = { mensaje: 'Si los datos son válidos recibirás un correo para confirmar tu cuenta' };

  const existe = await prisma.cliente.findUnique({ where: { email } });
  if (existe) {                              // no revela que el correo ya está registrado
    await registrar(req, 'REGISTRO_CLIENTE', 'FALLO');
    return res.status(202).json(respuesta);
  }
  const cli = await prisma.cliente.create({ data: {
    razonSocial, rfc: rfc || null, email, passwordHash: await bcrypt.hash(password, 12) } });

  const token = crypto.randomBytes(32).toString('base64url');   // un solo uso, 24 h
  await prisma.tokenVerificacion.create({ data: {
    clienteId: cli.id, tokenHash: sha256(token), expiraEn: new Date(Date.now() + 24 * 3600 * 1000) } });
  await enviarCorreoVerificacion(email, `${ORIGEN}/clientes/verificar/${token}`);
  await registrar(req, 'REGISTRO_CLIENTE', 'EXITO', { tipo: 'CLIENTE', id: cli.id });
  res.status(202).json(respuesta);
}

// Confirma el correo y entrega el QR para configurar el 2FA
async function verificarCorreo(req, res) {
  const token = String(req.params.token);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({ error: 'Enlace no válido' });

  const tv = await prisma.tokenVerificacion.findUnique({
    where: { tokenHash: sha256(token) }, include: { cliente: true } });
  if (!tv || tv.usado || tv.expiraEn < new Date()) {
    await registrar(req, 'VERIFICAR_CORREO', 'FALLO');
    return res.status(400).json({ error: 'El enlace no es válido o ya expiró' });
  }
  const secreto = authenticator.generateSecret();
  await prisma.$transaction([
    prisma.tokenVerificacion.update({ where: { id: tv.id }, data: { usado: true } }),
    prisma.cliente.update({ where: { id: tv.clienteId }, data: {
      emailVerificado: true, totpSecreto: cifrar(secreto), totpActivo: false } }),
  ]);
  emitirTemporal(res, 'setup2fa', tv.clienteId);

  const uri = authenticator.keyuri(tv.cliente.email, 'LogiTrans', secreto);
  await registrar(req, 'VERIFICAR_CORREO', 'EXITO', { tipo: 'CLIENTE', id: tv.clienteId });
  res.json({ qr: await QRCode.toDataURL(uri), secreto });
}

async function confirmar2FA(req, res) {
  try {
    const datos = verificarTemporal(req, 'setup2fa');
    const cli = await prisma.cliente.findUnique({ where: { id: datos.id } });
    if (!cli?.totpSecreto || !authenticator.check(req.body.codigo, descifrar(cli.totpSecreto))) {
      throw new Error('código');
    }
    await prisma.cliente.update({ where: { id: cli.id }, data: { totpActivo: true } });
    res.clearCookie('setup2fa', opcionesCookie);
    await registrar(req, 'CONFIGURAR_2FA', 'EXITO', { tipo: 'CLIENTE', id: cli.id });
    res.json({ ok: true });
  } catch {
    await registrar(req, 'CONFIGURAR_2FA', 'FALLO');
    res.status(400).json({ error: 'Código incorrecto o configuración expirada' });
  }
}

const esquemaCodigo = z.object({ codigo: z.string().regex(/^\d{6}$/) });

module.exports = {
  nombre: 'publico',
  roles: PUBLICO,
  rutas: [
    ['POST', '/api/auth/login',                limiteLogin, validar(esquemaLogin), login],
    ['POST', '/api/auth/login/2fa',            limiteLogin, validar(esquemaCodigo), loginCliente2FA],
    ['POST', '/api/clientes/registro',         limiteRegistro, validar(esquemaRegistro), registrarCliente],
    ['GET',  '/api/clientes/verificar/:token', limiteRegistro, verificarCorreo],
    ['POST', '/api/clientes/2fa/confirmar',    limiteLogin, validar(esquemaCodigo), confirmar2FA],
  ],
};
