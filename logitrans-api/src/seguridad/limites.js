// 4. Limitación de peticiones por IP (fuerza bruta, relleno de credenciales y abuso del registro)
const { rateLimit } = require('express-rate-limit');

const limiteLogin = rateLimit({             // máx. 5 intentos fallidos cada 15 min por IP
  windowMs: 15 * 60 * 1000, limit: 5, skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos, espera 15 minutos' } });

const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' } });

const limiteGeneral = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 });

module.exports = { limiteLogin, limiteRegistro, limiteGeneral };
