// 9. Manejador de errores: nunca envía trazas, rutas internas ni versiones al usuario.
// Express lo reconoce como manejador de errores porque recibe 4 parámetros.
module.exports = function manejadorErrores(err, req, res, next) {
  console.error(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos inválidos' });
  res.status(500).json({ error: 'Error interno del servidor' });
};
