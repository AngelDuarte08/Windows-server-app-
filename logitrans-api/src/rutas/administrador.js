// ADMINISTRADOR: gestiona accesos (CU-04) y consulta la bitácora (CU-05).
// No crea rutas ni modifica envíos: separación de funciones.
const prisma = require('../db');
const { ROLES } = require('../roles');
const { idParam } = require('../validacion');
const { registrar } = require('../seguridad/bitacora');

async function bitacora(req, res) {
  res.json(await prisma.bitacora.findMany({ orderBy: { fecha: 'desc' }, take: 200 }));
}

async function listarEmpleados(req, res) {
  res.json(await prisma.empleado.findMany({ orderBy: { nombre: 'asc' },
    select: { id: true, usuarioAD: true, nombre: true, rol: true, activo: true, ultimoAcceso: true } }));
}

// Revocar o reactivar: la sesión del empleado revocado se invalida en su siguiente petición
const cambiarAcceso = (activo) => async (req, res) => {
  const id = idParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'Datos inválidos' });
  if (id === req.usuario.id) return res.status(400).json({ error: 'No puedes cambiar tu propio acceso' });
  const emp = await prisma.empleado.findUnique({ where: { id } });
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
  await prisma.empleado.update({ where: { id }, data: { activo } });
  await registrar(req, activo ? 'REACTIVAR_EMPLEADO' : 'REVOCAR_EMPLEADO', 'EXITO', req.usuario);
  res.json({ ok: true });
};

module.exports = {
  nombre: 'administrador',
  roles: [ROLES.ADMINISTRADOR],
  rutas: [
    ['GET',  '/api/bitacora',                 bitacora],
    ['GET',  '/api/empleados',                listarEmpleados],
    ['POST', '/api/empleados/:id/revocar',    cambiarAcceso(false)],
    ['POST', '/api/empleados/:id/reactivar',  cambiarAcceso(true)],
  ],
};
