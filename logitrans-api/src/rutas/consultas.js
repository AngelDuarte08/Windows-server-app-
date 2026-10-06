// CONSULTAS DE SOLO LECTURA compartidas por EMPLEADO y ADMINISTRADOR: rutas (CU-02) y reportes (CU-06)
const prisma = require('../db');
const { ROLES } = require('../roles');

async function todasLasRutas(req, res) {
  res.json(await prisma.ruta.findMany({ orderBy: { fecha: 'desc' }, take: 200,
    include: { chofer: { select: { id: true, nombre: true } },
               vehiculo: { select: { id: true, placas: true } },
               _count: { select: { envios: true } } } }));
}

async function reporteEnvios(req, res) {
  const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [porEstado, total, entregados30, rutasActivas] = await Promise.all([
    prisma.envio.groupBy({ by: ['estado'], _count: { _all: true }, _sum: { pesoKg: true } }),
    prisma.envio.count(),
    prisma.envio.count({ where: { estado: 'ENTREGADO', entregadoEn: { gte: hace30 } } }),
    prisma.ruta.count({ where: { estado: { in: ['PLANEADA', 'EN_CURSO'] } } }),
  ]);
  res.json({ total, entregados30, rutasActivas,
    porEstado: porEstado.map((e) => ({ estado: e.estado, cantidad: e._count._all,
                                       pesoKg: e._sum.pesoKg })) });
}

module.exports = {
  nombre: 'consultas',
  roles: [ROLES.EMPLEADO, ROLES.ADMINISTRADOR],
  rutas: [
    ['GET', '/api/rutas',            todasLasRutas],
    ['GET', '/api/reportes/envios',  reporteEnvios],
  ],
};
