// EMPLEADO (despacho): consulta envíos pendientes, choferes y vehículos, y arma rutas (CU-03)
const prisma = require('../db');
const { ROLES } = require('../roles');
const { z, validar, zUuid } = require('../validacion');
const { registrar } = require('../seguridad/bitacora');

async function enviosPendientes(req, res) {
  res.json(await prisma.envio.findMany({ where: { rutaId: null, estado: 'SOLICITADO' },
    orderBy: { creadoEn: 'asc' },
    select: { id: true, folioRastreo: true, direccionOrigen: true, direccionDestino: true,
              pesoKg: true, descripcion: true, creadoEn: true } }));
}

async function choferesActivos(req, res) {
  res.json(await prisma.empleado.findMany({ where: { rol: ROLES.CHOFER, activo: true },
    select: { id: true, nombre: true } }));
}

async function vehiculosActivos(req, res) {
  res.json(await prisma.vehiculo.findMany({ where: { activo: true } }));
}

const esquemaRuta = z.object({
  nombre: z.string().trim().min(3).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  choferId: zUuid,
  vehiculoId: zUuid,
  envioIds: z.array(zUuid).min(1).max(100) });

async function crearRuta(req, res) {
  const { nombre, fecha, choferId, vehiculoId, envioIds } = req.body;
  const chofer = await prisma.empleado.findUnique({ where: { id: choferId } });
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!chofer?.activo || chofer.rol !== ROLES.CHOFER || !vehiculo?.activo) {
    return res.status(400).json({ error: 'Chofer o vehículo no válido' });
  }
  const envios = await prisma.envio.findMany({
    where: { id: { in: envioIds }, rutaId: null, estado: 'SOLICITADO' } });
  if (envios.length !== new Set(envioIds).size) {
    return res.status(409).json({ error: 'Algún envío ya fue asignado o no existe' });
  }
  const ruta = await prisma.$transaction(async (tx) => {
    const r = await tx.ruta.create({ data: { nombre, fecha: new Date(fecha), choferId, vehiculoId } });
    await tx.envio.updateMany({ where: { id: { in: envioIds } }, data: { rutaId: r.id } });
    return r;
  });
  await registrar(req, 'CREAR_RUTA', 'EXITO', req.usuario);
  res.status(201).json(ruta);
}

module.exports = {
  nombre: 'empleado',
  roles: [ROLES.EMPLEADO],
  rutas: [
    ['GET',  '/api/despacho/envios',    enviosPendientes],
    ['GET',  '/api/despacho/choferes',  choferesActivos],
    ['GET',  '/api/vehiculos',          vehiculosActivos],
    ['POST', '/api/rutas',              validar(esquemaRuta), crearRuta],
  ],
};
