// Una sola instancia de Prisma para toda la app (conexión a PostgreSQL en 127.0.0.1:5432)
const { PrismaClient } = require('@prisma/client');

module.exports = new PrismaClient();
