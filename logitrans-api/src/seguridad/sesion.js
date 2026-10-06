// Sesión con JSON Web Token en cookie HttpOnly + Secure + SameSite=Strict (15 min, se renueva con actividad)
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { JWT_SECRET, COOKIE_SECURE } = require('../config');
const { ROLES } = require('../roles');

const MIN_15 = 15 * 60 * 1000;
const opcionesCookie = { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'strict', path: '/' };

function emitirSesion(res, datos) {
  const token = jwt.sign(datos, JWT_SECRET, { expiresIn: '15m', jwtid: crypto.randomUUID() });
  res.cookie('sesion', token, { ...opcionesCookie, maxAge: MIN_15 });
}

// Tokens temporales de un solo propósito (cookie aparte de la sesión):
//   setup2fa → tras verificar el correo, confirma el primer código 2FA (10 min)
//   login2fa → tras validar la contraseña de un cliente, espera su código 2FA (5 min)
const TEMPORALES = { setup2fa: { tipo: 'SETUP_2FA', minutos: 10 }, login2fa: { tipo: 'LOGIN_2FA', minutos: 5 } };

function emitirTemporal(res, cookie, clienteId) {
  const { tipo, minutos } = TEMPORALES[cookie];
  const token = jwt.sign({ id: clienteId, tipo }, JWT_SECRET, { expiresIn: `${minutos}m` });
  res.cookie(cookie, token, { ...opcionesCookie, maxAge: minutos * 60 * 1000 });
}
function verificarTemporal(req, cookie) {
  const datos = jwt.verify(req.cookies[cookie], JWT_SECRET, { algorithms: ['HS256'] });
  if (datos.tipo !== TEMPORALES[cookie].tipo) throw new Error('tipo');
  return datos;
}

// 5. ¿La sesión es válida, no fue revocada y el empleado sigue activo?
async function autenticar(req, res, next) {
  try {
    const datos = jwt.verify(req.cookies.sesion, JWT_SECRET, { algorithms: ['HS256'] });
    const revocado = await prisma.tokenRevocado.findUnique({ where: { jti: datos.jti } });
    if (revocado) throw new Error('revocado');
    if (datos.tipo === 'EMPLEADO') {
      const emp = await prisma.empleado.findUnique({ where: { id: datos.id } });
      if (!emp?.activo) throw new Error('inactivo');
      datos.rol = emp.rol;              // si TI le cambió el grupo, manda el rol actual, no el del token
    } else if (datos.tipo !== 'CLIENTE' || datos.rol !== ROLES.CLIENTE) {
      throw new Error('tipo de sesión no válido');
    }
    // Expiración por inactividad (FA-5): mientras haya actividad se renueva la sesión
    if (datos.exp * 1000 - Date.now() < 10 * 60 * 1000) {
      emitirSesion(res, { id: datos.id, tipo: datos.tipo, rol: datos.rol });
    }
    req.usuario = datos; next();
  } catch {
    res.clearCookie('sesion', opcionesCookie);
    return res.status(401).json({ error: 'Sesión no válida' });
  }
}

module.exports = { opcionesCookie, emitirSesion, emitirTemporal, verificarTemporal, autenticar };
