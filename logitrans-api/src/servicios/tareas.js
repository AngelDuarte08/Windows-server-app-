// Tareas periódicas en segundo plano
const prisma = require('../db');
const { AD_SIMULADO } = require('../config');
const { sincronizarBajas } = require('./activeDirectory');

function iniciarTareas() {
  // Cada 5 min: empleados deshabilitados en AD pierden el acceso aunque nadie lo haya revocado en el portal
  if (!AD_SIMULADO) setInterval(() => sincronizarBajas().catch(console.error), 5 * 60 * 1000);

  // Cada hora: depura tokens revocados que ya expiraron
  setInterval(() => prisma.tokenRevocado.deleteMany({ where: { expiraEn: { lt: new Date() } } })
    .catch(console.error), 60 * 60 * 1000);
}

module.exports = { iniciarTareas };
