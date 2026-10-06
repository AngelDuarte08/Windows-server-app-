// CLIENTE: solicita, lista y rastrea SOLO sus propios envíos (el clienteId sale del token → anti IDOR)
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../db');
const { ROLES } = require('../roles');
const { z, validar, esquemaPassword } = require('../validacion');
const { registrar } = require('../seguridad/bitacora');

// Folio aleatorio, no secuencial: "LT" + 12 caracteres sin ambigüedades (0/O, 1/I)
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generarFolio() {
  let folio = 'LT';
  for (let i = 0; i < 12; i++) folio += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return folio;
}

// CU-09: solicitar un envío
const esquemaEnvio = z.object({
  direccionOrigen: z.string().trim().min(10).max(250),
  direccionDestino: z.string().trim().min(10).max(250),
  descripcion: z.string().trim().min(3).max(250),
  pesoKg: z.number().positive().max(25000) });

async function solicitarEnvio(req, res) {
  const envio = await prisma.$transaction(async (tx) => {
    const e = await tx.envio.create({ data: { ...req.body, folioRastreo: generarFolio(),
                                              clienteId: req.usuario.id } });   // dueño = sesión
    await tx.historialEnvio.create({ data: { envioId: e.id, estado: 'SOLICITADO',
                                             comentario: 'Solicitud recibida' } });
    return e;
  });
  await registrar(req, 'SOLICITAR_ENVIO', 'EXITO', req.usuario);
  res.status(201).json({ folioRastreo: envio.folioRastreo });
}

async function misEnvios(req, res) {
  res.json(await prisma.envio.findMany({ where: { clienteId: req.usuario.id },
    orderBy: { creadoEn: 'desc' },
    select: { folioRastreo: true, direccionOrigen: true, direccionDestino: true,
              descripcion: true, pesoKg: true, estado: true, creadoEn: true, entregadoEn: true } }));
}

// CU-10: rastrear un envío propio
async function rastrearEnvio(req, res) {
  const folio = String(req.params.folio).toUpperCase();
  if (!/^LT[A-Z0-9]{12}$/.test(folio)) return res.status(404).json({ error: 'Envío no encontrado' });
  const envio = await prisma.envio.findFirst({
    where: { folioRastreo: folio, clienteId: req.usuario.id },
    select: { folioRastreo: true, direccionOrigen: true, direccionDestino: true, descripcion: true,
              pesoKg: true, estado: true, creadoEn: true, entregadoEn: true,
              historial: { select: { estado: true, comentario: true, fecha: true },
                           orderBy: { fecha: 'asc' } } } });
  if (!envio) return res.status(404).json({ error: 'Envío no encontrado' });
  res.json(envio);
}

// Mi cuenta: cambiar contraseña (pide la actual)
async function cambiarPassword(req, res) {
  const cli = await prisma.cliente.findUnique({ where: { id: req.usuario.id } });
  if (!cli || !(await bcrypt.compare(req.body.actual, cli.passwordHash))) {
    await registrar(req, 'CAMBIO_PASSWORD', 'FALLO', req.usuario);
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  await prisma.cliente.update({ where: { id: cli.id },
                                data: { passwordHash: await bcrypt.hash(req.body.nueva, 12) } });
  await registrar(req, 'CAMBIO_PASSWORD', 'EXITO', req.usuario);
  res.json({ ok: true });
}

module.exports = {
  nombre: 'cliente',
  roles: [ROLES.CLIENTE],
  rutas: [
    ['GET',  '/api/envios',             misEnvios],
    ['POST', '/api/envios',             validar(esquemaEnvio), solicitarEnvio],
    ['GET',  '/api/envios/:folio',      rastrearEnvio],
    ['POST', '/api/clientes/password',
             validar(z.object({ actual: z.string().min(1).max(128), nueva: esquemaPassword })), cambiarPassword],
  ],
};
