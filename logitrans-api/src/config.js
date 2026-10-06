// Configuración leída del .env. Si falta un secreto o la combinación es insegura, el servidor no inicia.
require('dotenv').config({ quiet: true });

const env = process.env;
const PRODUCCION = env.NODE_ENV === 'production';
const AD_SIMULADO = env.AD_SIMULADO === 'true';

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET falta o es muy corto');
if (!/^[0-9a-f]{64}$/i.test(env.CLAVE_CIFRADO || '')) {
  throw new Error('CLAVE_CIFRADO debe ser de 64 caracteres hexadecimales (32 bytes)');
}
if (AD_SIMULADO && PRODUCCION) throw new Error('AD_SIMULADO no está permitido en producción');

module.exports = Object.freeze({
  PUERTO: Number(env.PUERTO || 3000),
  ORIGEN: env.ORIGEN,
  PRODUCCION,
  JWT_SECRET: env.JWT_SECRET,
  CLAVE_CIFRADO: Buffer.from(env.CLAVE_CIFRADO, 'hex'),     // 32 bytes para AES-256
  COOKIE_SECURE: env.COOKIE_SECURE !== 'false',
  LDAP: {
    URL: env.LDAP_URL,                                     // ldaps://srv-logi01.logitrans.local:636
    BASE_DN: env.LDAP_BASE_DN,
    DOMINIO: env.LDAP_DOMINIO || 'logitrans.local',
    CA_CERT: env.CA_CERT,
    SVC_USER: env.LDAP_SVC_USER,                           // svc_logitrans: solo lectura
    SVC_PASS: env.LDAP_SVC_PASS,
  },
  AD_SIMULADO,
  AD_SIMULADO_PASSWORD: env.AD_SIMULADO_PASSWORD || '',
});
