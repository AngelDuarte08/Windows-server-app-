// 7. Validación de entrada con zod: lo que no cumple el esquema nunca llega a la lógica de negocio
const { z } = require('zod');

const validar = (esquema) => (req, res, next) => {
  const r = esquema.safeParse(req.body ?? {});
  if (!r.success) return res.status(400).json({ error: 'Datos inválidos' });
  req.body = r.data; next();
};

// Todas las llaves son UUID (v7, generados por PostgreSQL); cualquier otro formato se rechaza
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zUuid = z.string().regex(UUID_RE);
const idParam = (valor) => (UUID_RE.test(String(valor)) ? String(valor).toLowerCase() : null);

// Contraseñas de clientes: mínimo 12 caracteres, mezcla de tipos y no comunes
const CONTRASENAS_COMUNES = new Set(['123456789012', 'contraseña123', 'password1234',
  'qwertyuiop12', 'logitrans123', 'administrador', '1234567890ab', 'iloveyou1234']);
const esquemaPassword = z.string().min(12).max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p))
  .refine((p) => !CONTRASENAS_COMUNES.has(p.toLowerCase()));

module.exports = { z, validar, UUID_RE, zUuid, idParam, esquemaPassword };
