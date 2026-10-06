// Bitácora de auditoría: solo inserta (la cuenta de la BD no tiene UPDATE ni DELETE sobre la tabla)
const prisma = require('../db');

async function registrar(req, accion, resultado, usuario = {}) {
  await prisma.bitacora.create({ data: {
    tipoUsuario: usuario.tipo ?? 'ANONIMO', usuarioId: usuario.id ?? null,
    accion, recurso: req.originalUrl.slice(0, 250), ip: req.ip ?? 'desconocida', resultado } });
}

module.exports = { registrar };
