// Autenticación de empleados contra Active Directory por LDAPS (o un AD simulado en laboratorio)
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('ldapts');
const prisma = require('../db');
const { LDAP, AD_SIMULADO, AD_SIMULADO_PASSWORD } = require('../config');

// Usuarios de laboratorio para cuando no hay un controlador de dominio disponible
const AD_LAB = {
  'ana.torres':  { guid: '0d8b6a3e-1c2f-4a5b-9e7d-444444444444', nombre: 'Ana Torres',  grupo: 'GG_Administradores' },
  'maria.lopez': { guid: '0d8b6a3e-1c2f-4a5b-9e7d-222222222222', nombre: 'María López', grupo: 'GG_Empleados' },
  'juan.perez':  { guid: '0d8b6a3e-1c2f-4a5b-9e7d-111111111111', nombre: 'Juan Pérez',  grupo: 'GG_Choferes' },
  'carlos.ruiz': { guid: '0d8b6a3e-1c2f-4a5b-9e7d-333333333333', nombre: 'Carlos Ruiz', grupo: 'GG_Choferes' },
};

const clienteLDAP = () => new Client({ url: LDAP.URL, tlsOptions: { ca: [fs.readFileSync(LDAP.CA_CERT)] } });

// AD guarda objectGUID en binario con los 3 primeros bloques en little-endian
function guidAD(b) {
  const h = b.toString('hex');
  const le = (s) => s.match(/../g).reverse().join('');
  return [le(h.slice(0, 8)), le(h.slice(8, 12)), le(h.slice(12, 16)),
          h.slice(16, 20), h.slice(20)].join('-');
}

// Escapa caracteres especiales de filtros LDAP (RFC 4515), defensa adicional a la regex del usuario
const escaparLDAP = (s) => s.replace(/[\\*()\0]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));

// Devuelve { guid, nombre, grupos } si AD acepta las credenciales; si no, lanza error
async function autenticarAD(usuario, password) {
  if (AD_SIMULADO) {
    const u = AD_LAB[usuario.toLowerCase()];
    const esperado = Buffer.from(AD_SIMULADO_PASSWORD);
    const recibido = Buffer.from(password);
    if (!u || esperado.length === 0 || esperado.length !== recibido.length
        || !crypto.timingSafeEqual(esperado, recibido)) throw new Error('credenciales');
    return { guid: u.guid, nombre: u.nombre, grupos: [u.grupo] };
  }

  const ldap = clienteLDAP();
  try {
    await ldap.bind(`${usuario}@${LDAP.DOMINIO}`, password);   // AD valida contraseña y estado
    const { searchEntries } = await ldap.search(LDAP.BASE_DN, {
      scope: 'sub', filter: `(sAMAccountName=${escaparLDAP(usuario)})`,
      attributes: ['objectGUID', 'memberOf', 'displayName'],
      explicitBufferAttributes: ['objectGUID'] });
    const e = searchEntries[0];
    if (!e) throw new Error('no encontrado');
    const grupos = [].concat(e.memberOf || [])
      .map((dn) => String(dn).split(',')[0].replace(/^CN=/i, ''));
    return { guid: guidAD(e.objectGUID), nombre: String(e.displayName || usuario), grupos };
  } finally {
    await ldap.unbind().catch(() => {});
  }
}

// Respaldo de CU-04: marca como inactivas las cuentas deshabilitadas en AD
async function sincronizarBajas() {
  const ldap = clienteLDAP();
  try {
    await ldap.bind(LDAP.SVC_USER, LDAP.SVC_PASS);              // cuenta de servicio de solo lectura
    const { searchEntries } = await ldap.search(LDAP.BASE_DN, { scope: 'sub',
      filter: '(&(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=2))',
      attributes: ['sAMAccountName'] });
    const bajas = searchEntries.map((e) => String(e.sAMAccountName).toLowerCase());
    if (bajas.length) {
      await prisma.empleado.updateMany({ data: { activo: false },
        where: { usuarioAD: { in: bajas }, activo: true } });
    }
  } finally { await ldap.unbind().catch(() => {}); }
}

module.exports = { autenticarAD, sincronizarBajas };
