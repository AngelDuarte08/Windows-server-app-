// AES-256-GCM para datos sensibles en la BD (secreto TOTP del cliente) y SHA-256 para tokens de un solo uso
const crypto = require('crypto');
const { CLAVE_CIFRADO } = require('../config');

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', CLAVE_CIFRADO, iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), datos]);        // IV (12) + tag (16) + datos
}

function descifrar(buf) {
  const b = Buffer.from(buf);
  const d = crypto.createDecipheriv('aes-256-gcm', CLAVE_CIFRADO, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');

module.exports = { cifrar, descifrar, sha256 };
