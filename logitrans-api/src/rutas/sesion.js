// CUALQUIER SESIÓN (administrador, empleado, chofer o cliente): quién soy y cerrar sesión
const prisma = require('../db');
const { CUALQUIER_SESION } = require('../roles');
const { registrar } = require('../seguridad/bitacora');
const { opcionesCookie } = require('../seguridad/sesion');

async function quienSoy(req, res) {
  const { id, tipo, rol } = req.usuario;
  const nombre = tipo === 'EMPLEADO'
    ? (await prisma.empleado.findUnique({ where: { id } }))?.nombre
    : (await prisma.cliente.findUnique({ where: { id } }))?.razonSocial;
  res.json({ tipo, rol, nombre });
}

// Cerrar sesión: el token queda en la lista de revocados hasta que expire
async function salir(req, res) {
  await prisma.tokenRevocado.create({ data: { jti: req.usuario.jti, usuarioId: req.usuario.id,
                                              expiraEn: new Date(req.usuario.exp * 1000) } });
  await registrar(req, 'LOGOUT', 'EXITO', req.usuario);
  res.clearCookie('sesion', opcionesCookie); res.json({ ok: true });
}

module.exports = {
  nombre: 'sesion',
  roles: CUALQUIER_SESION,
  rutas: [
    ['GET',  '/api/auth/yo',    quienSoy],
    ['POST', '/api/auth/salir', salir],
  ],
};
