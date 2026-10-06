// Prueba de la matriz de permisos: cada endpoint contra cada rol (anónimo, cliente, chofer,
// empleado y administrador), más casos de IDOR, token alterado y revocación.
//
// Requisitos: Servidor.js corriendo con AD_SIMULADO=true y su salida guardada en un archivo,
// porque de ahí se lee el enlace de verificación de correo de los clientes de prueba:
//   node Servidor.js > servidor.log 2>&1 &
//   node pruebas/matriz-permisos.js servidor.log
// Crea datos de prueba (2 clientes, 1 envío, 1 ruta): úsala en una base de laboratorio.
const fs = require('fs');
const { authenticator } = require('otplib');
const BASE = process.env.API_URL || 'http://127.0.0.1:3000';
const LOG = process.argv[2];
if (!LOG) { console.error('Uso: node pruebas/matriz-permisos.js <archivo-de-log-del-servidor>'); process.exit(2); }

function agente() {
  const cookies = {};
  const f = async (metodo, url, cuerpo) => {
    const res = await fetch(BASE + url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json',
                 Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (v) cookies[k] = v; else delete cookies[k];
    }
    return { s: res.status, d: await res.json().catch(() => ({})) };
  };
  f.cookies = cookies;
  return f;
}
let fallos = 0, total = 0;
const ok = (cond, msg, extra) => { total++; if (!cond) { fallos++; console.log(`✗ ${msg}`, JSON.stringify(extra)); } else console.log(`✓ ${msg}`); };

async function nuevoCliente(email) {
  const a = agente();
  await a('POST', '/api/clientes/registro', { razonSocial: 'Cliente ' + email, email, password: 'MiClave#Segura2026' });
  await new Promise((r) => setTimeout(r, 300));
  const token = fs.readFileSync(LOG, 'utf8').match(new RegExp(`Para: ${email}.*verificar/([A-Za-z0-9_-]+)`))[1];
  const { d } = await a('GET', `/api/clientes/verificar/${token}`);
  await a('POST', '/api/clientes/2fa/confirmar', { codigo: authenticator.generate(d.secreto) });
  const r1 = await a('POST', '/api/auth/login', { usuario: email, password: 'MiClave#Segura2026' });
  if (!r1.d.requiere2FA) throw new Error('login cliente paso 1 ' + JSON.stringify(r1));
  const r = await a('POST', '/api/auth/login/2fa', { codigo: authenticator.generate(d.secreto) });
  if (r.s !== 200 || r.d.rol !== 'CLIENTE') throw new Error('login cliente paso 2 ' + JSON.stringify(r));
  a.email = email; a.secreto = d.secreto;
  return a;
}
async function nuevoEmpleado(usuario) {
  const a = agente();
  const r = await a('POST', '/api/auth/login', { usuario, password: 'Laboratorio#2026' });
  if (r.s !== 200) throw new Error('login ' + usuario + JSON.stringify(r));
  return a;
}

(async () => {
  const t = Date.now();
  const sesiones = {
    ANONIMO: agente(),
    CLIENTE: await nuevoCliente(`a${t}@ejemplo.com`),
    CHOFER: await nuevoEmpleado('juan.perez'),
    EMPLEADO: await nuevoEmpleado('maria.lopez'),
    ADMINISTRADOR: await nuevoEmpleado('ana.torres'),
  };
  const otroCliente = await nuevoCliente(`b${t}@ejemplo.com`);
  const otroChofer = await nuevoEmpleado('carlos.ruiz');

  // Datos reales para las pruebas de IDOR
  const { d: env } = await sesiones.CLIENTE('POST', '/api/envios', { direccionOrigen: 'Av. Insurgentes 100, León', direccionDestino: 'Calle Hidalgo 25, Irapuato', descripcion: 'Cajas', pesoKg: 10 });
  const pend = (await sesiones.EMPLEADO('GET', '/api/despacho/envios')).d.find((e) => e.folioRastreo === env.folioRastreo);
  const juan = (await sesiones.EMPLEADO('GET', '/api/despacho/choferes')).d.find((c) => c.nombre === 'Juan Pérez');
  const veh = (await sesiones.EMPLEADO('GET', '/api/vehiculos')).d[0];
  await sesiones.EMPLEADO('POST', '/api/rutas', { nombre: 'Ruta de prueba', fecha: '2026-10-02', choferId: juan.id, vehiculoId: veh.id, envioIds: [pend.id] });

  // ---------------- Matriz: [método, ruta, cuerpo, roles permitidos] ----------------
  const MATRIZ = [
    ['GET',   '/api/auth/yo', undefined,                          ['CLIENTE', 'CHOFER', 'EMPLEADO', 'ADMINISTRADOR']],
    ['POST',  '/api/clientes/password', {},                       ['CLIENTE']],
    ['GET',   '/api/envios', undefined,                           ['CLIENTE']],
    ['POST',  '/api/envios', {},                                  ['CLIENTE']],
    ['GET',   '/api/envios/LTAAAAAAAAAAAA', undefined,            ['CLIENTE']],
    ['GET',   '/api/rutas/mias', undefined,                       ['CHOFER']],
    ['PATCH', '/api/envios/x/estado', { estado: 'EN_RUTA' },      ['CHOFER']],
    ['GET',   '/api/despacho/envios', undefined,                  ['EMPLEADO']],
    ['GET',   '/api/despacho/choferes', undefined,                ['EMPLEADO']],
    ['GET',   '/api/vehiculos', undefined,                        ['EMPLEADO']],
    ['POST',  '/api/rutas', {},                                   ['EMPLEADO']],
    ['GET',   '/api/rutas', undefined,                            ['EMPLEADO', 'ADMINISTRADOR']],
    ['GET',   '/api/reportes/envios', undefined,                  ['EMPLEADO', 'ADMINISTRADOR']],
    ['GET',   '/api/bitacora', undefined,                         ['ADMINISTRADOR']],
    ['GET',   '/api/empleados', undefined,                        ['ADMINISTRADOR']],
    ['POST',  '/api/empleados/x/revocar', {},                     ['ADMINISTRADOR']],
    ['POST',  '/api/empleados/x/reactivar', {},                   ['ADMINISTRADOR']],
  ];
  const fila = [];
  for (const [m, ruta, cuerpo, permitidos] of MATRIZ) {
    const celdas = [];
    for (const [rol, a] of Object.entries(sesiones)) {
      const r = await a(m, ruta, cuerpo);
      const debe = permitidos.includes(rol);
      const esperado = debe ? 'permitido' : (rol === 'ANONIMO' ? 401 : 403);
      const bien = debe ? ![401, 403].includes(r.s) : r.s === esperado;
      total++; if (!bien) { fallos++; console.log(`✗ ${m} ${ruta} como ${rol}: ${r.s} (esperado ${esperado})`); }
      celdas.push((debe ? '✓' : '·') + (bien ? '' : '!'));
    }
    fila.push(`${(m + ' ' + ruta).padEnd(36)} ${celdas.map((c) => c.padEnd(5)).join('')}`);
  }
  console.log('\nMatriz verificada (✓ permitido · denegado)\n' + ''.padEnd(37) + 'ANON CLI  CHOF EMPL ADMIN');
  fila.forEach((f) => console.log(f));
  console.log();

  // ---------------- Casos específicos ----------------
  let r = await otroChofer('PATCH', `/api/envios/${pend.id}/estado`, { estado: 'EN_RUTA' });
  ok(r.s === 404, 'IDOR: un chofer NO puede mover envíos de la ruta de otro chofer', r);
  r = await sesiones.CHOFER('PATCH', `/api/envios/${pend.id}/estado`, { estado: 'EN_RUTA' });
  ok(r.s === 200, 'el chofer asignado sí puede mover su envío', r);
  r = await otroCliente('GET', `/api/envios/${env.folioRastreo}`);
  ok(r.s === 404, 'IDOR: un cliente NO puede ver el envío de otro cliente', r);
  r = await sesiones.CLIENTE('GET', `/api/envios/${env.folioRastreo}`);
  ok(r.s === 200, 'el dueño sí ve su envío', r);
  r = await sesiones.ADMINISTRADOR('GET', '/api/no-existe');
  ok(r.s === 404, 'endpoint no declarado → 404 (deny by default)', r);
  r = await sesiones.ADMINISTRADOR('DELETE', '/api/bitacora');
  ok(r.s === 404, 'método no declarado (DELETE bitácora) → 404', r);

  // Token alterado: cambiar el rol en el payload invalida la firma
  const ch = agente();
  const [h, p, s] = sesiones.CHOFER.cookies.sesion.split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  payload.rol = 'ADMINISTRADOR';
  ch.cookies.sesion = [h, Buffer.from(JSON.stringify(payload)).toString('base64url'), s].join('.');
  r = await ch('GET', '/api/bitacora');
  ok(r.s === 401, 'token con rol alterado → 401', r);

  // Login único
  let a = agente();
  r = await a('POST', '/api/auth/login', { usuario: 'maria.lopez@logitrans.local', password: 'Laboratorio#2026' });
  ok(r.s === 200 && r.d.rol === 'EMPLEADO' && !r.d.requiere2FA, 'login único: empleado con usuario@dominio entra directo como EMPLEADO', r);
  a = agente();
  r = await a('POST', '/api/auth/login', { usuario: otroCliente.email, password: 'Incorrecta#2026x' });
  ok(r.s === 401 && r.d.error === 'Credenciales inválidas', 'login único: cliente con contraseña incorrecta → mensaje genérico', r);
  r = await a('POST', '/api/auth/login', { usuario: otroCliente.email, password: 'MiClave#Segura2026' });
  ok(r.s === 200 && r.d.requiere2FA === true && !a.cookies.sesion, 'login único: cliente con contraseña correcta → pide 2FA, todavía sin sesión', r);
  r = await a('POST', '/api/auth/login/2fa', { codigo: '000000' });
  ok(r.s === 401 && !a.cookies.sesion, 'login único: código 2FA incorrecto → sin sesión', r);
  r = await a('POST', '/api/auth/login/2fa', { codigo: authenticator.generate(otroCliente.secreto) });
  ok(r.s === 200 && r.d.rol === 'CLIENTE' && a.cookies.sesion, 'login único: código correcto → sesión de CLIENTE', r);
  r = await agente()('POST', '/api/auth/login/2fa', { codigo: '123456' });
  ok(r.s === 401, 'el paso 2FA sin haber validado la contraseña → 401', r);
  r = await agente()('POST', '/api/auth/login', { usuario: 'nadie@ejemplo.com', password: 'Algo#123456789' });
  ok(r.s === 401 && r.d.error === 'Credenciales inválidas', 'cuenta inexistente → el mismo mensaje genérico', r);
  r = await agente()('POST', '/api/clientes/registro', { razonSocial: 'Impostor', email: 'ana.torres@logitrans.local', password: 'MiClave#Segura2026' });
  ok(r.s === 400, 'registro de cliente con correo del dominio interno → rechazado', r);

  // Públicos accesibles sin sesión
  for (const [m, ruta] of [['POST', '/api/clientes/registro']]) {
    r = await agente()(m, ruta, {});
    ok(r.s === 400, `público ${m} ${ruta} sin sesión → 400 por validación (no 401)`, r);
  }

  // Revocación: el admin revoca a carlos y su sesión muere de inmediato
  const emps = (await sesiones.ADMINISTRADOR('GET', '/api/empleados')).d;
  const carlos = emps.find((e) => e.usuarioAD === 'carlos.ruiz');
  r = await sesiones.ADMINISTRADOR('POST', `/api/empleados/${carlos.id}/revocar`);
  ok(r.s === 200, 'administrador revoca a carlos.ruiz', r);
  r = await otroChofer('GET', '/api/rutas/mias');
  ok(r.s === 401, 'la sesión de carlos.ruiz queda inválida', r);
  const yo = emps.find((e) => e.usuarioAD === 'ana.torres');
  r = await sesiones.ADMINISTRADOR('POST', `/api/empleados/${yo.id}/revocar`);
  ok(r.s === 400, 'el administrador no puede revocarse a sí mismo', r);
  r = await sesiones.ADMINISTRADOR('POST', `/api/empleados/${carlos.id}/reactivar`);
  ok(r.s === 200, 'administrador reactiva a carlos.ruiz', r);

  r = await sesiones.EMPLEADO('POST', '/api/auth/salir');
  ok(r.s === 200, 'cerrar sesión', r);
  r = await sesiones.EMPLEADO('GET', '/api/rutas');
  ok(r.s === 401, 'después de salir, el token ya no sirve', r);

  console.log(fallos ? `\n${fallos} FALLOS de ${total}` : `\nTODO OK (${total} comprobaciones)`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
