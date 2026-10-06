// CHOFER: ve SOLO sus rutas y cambia el estado SOLO de los envíos de esas rutas (anti IDOR)
const prisma = require('../db');
const { ROLES } = require('../roles');
const { z, validar, idParam } = require('../validacion');
const { registrar } = require('../seguridad/bitacora');

// CU-02: el id del chofer sale del token, no de la URL
async function misRutas(req, res) {
  res.json(await prisma.ruta.findMany({ where: { choferId: req.usuario.id },
    include: { envios: true, vehiculo: { select: { placas: true, descripcion: true } } },
    orderBy: { fecha: 'desc' } }));
}

const esquemaEstado = z.object({
  estado: z.enum(['EN_RUTA', 'ENTREGADO']),
  comentario: z.string().trim().max(250).optional() });
const TRANSICIONES = { SOLICITADO: ['EN_RUTA'], EN_RUTA: ['ENTREGADO'] };

async function cambiarEstado(req, res) {
  const id = idParam(req.params.id);
  const envio = id && await prisma.envio.findUnique({ where: { id }, include: { ruta: true } });
  if (!envio || envio.ruta?.choferId !== req.usuario.id) {   // de otro chofer = "no existe"
    await registrar(req, 'CAMBIAR_ESTADO', 'FALLO', req.usuario);
    return res.status(404).json({ error: 'Envío no encontrado' });
  }
  const { estado, comentario } = req.body;
  if (!TRANSICIONES[envio.estado]?.includes(estado)) {
    return res.status(409).json({ error: `No se puede pasar de ${envio.estado} a ${estado}` });
  }
  await prisma.$transaction(async (tx) => {
    await tx.envio.update({ where: { id }, data: {
      estado, entregadoEn: estado === 'ENTREGADO' ? new Date() : undefined } });
    await tx.historialEnvio.create({ data: {
      envioId: id, estado, comentario: comentario || null, empleadoId: req.usuario.id } });
    const pendientes = await tx.envio.count({
      where: { rutaId: envio.rutaId, estado: { notIn: ['ENTREGADO', 'CANCELADO'] } } });
    await tx.ruta.update({ where: { id: envio.rutaId },
      data: { estado: pendientes === 0 ? 'FINALIZADA' : 'EN_CURSO' } });
  });
  await registrar(req, `ESTADO_${estado}`, 'EXITO', req.usuario);
  res.json({ ok: true });
}

module.exports = {
  nombre: 'chofer',
  roles: [ROLES.CHOFER],
  rutas: [
    ['GET',   '/api/rutas/mias',         misRutas],
    ['PATCH', '/api/envios/:id/estado',  validar(esquemaEstado), cambiarEstado],
  ],
};
