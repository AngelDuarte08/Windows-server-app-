// 6. Mínimo privilegio: matriz de permisos central (deny by default).
// Cada archivo de src/rutas/ declara sus roles y sus rutas; aquí se arma la matriz con esas
// declaraciones, así que es imposible tener una ruta sin permisos o un permiso sin ruta.
const { PUBLICO } = require('../roles');
const { autenticar } = require('./sesion');
const { registrar } = require('./bitacora');

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function controlAcceso(reglas) {
  return (req, res, next) => {
    const ruta = req.baseUrl + req.path;
    const regla = reglas.find((r) => r.metodo === req.method && r.patron.test(ruta));
    if (!regla) return res.status(404).json({ error: 'Recurso no encontrado' });   // no declarado
    if (regla.roles === PUBLICO) return next();
    return autenticar(req, res, () => {
      if (regla.roles.includes(req.usuario.rol)) return next();
      registrar(req, 'ACCESO_DENEGADO', 'FALLO', req.usuario).catch(console.error);
      return res.status(403).json({ error: 'No autorizado' });
    });
  };
}

// Registra los módulos de rutas: primero el control de acceso para todo /api y luego cada ruta
function montarApi(app, modulos) {
  const reglas = [];
  for (const { nombre, roles, rutas } of modulos) {
    if (roles !== PUBLICO && !(Array.isArray(roles) && roles.length)) {
      throw new Error(`El módulo de rutas "${nombre}" no declara roles`);
    }
    for (const [metodo, ruta] of rutas) {
      if (!METODOS.includes(metodo) || !ruta.startsWith('/api/')) throw new Error(`Ruta mal declarada: ${metodo} ${ruta}`);
      if (reglas.some((r) => r.metodo === metodo && r.ruta === ruta)) throw new Error(`Ruta duplicada: ${metodo} ${ruta}`);
      reglas.push({ metodo, ruta, roles, modulo: nombre,
                    patron: new RegExp('^' + ruta.replace(/:\w+/g, '[^/]+') + '/?$') });
    }
  }
  app.use('/api', controlAcceso(reglas));
  for (const { rutas } of modulos) {
    for (const [metodo, ruta, ...manejadores] of rutas) app[metodo.toLowerCase()](ruta, ...manejadores);
  }
  return reglas;
}

// Tabla legible de la matriz, armada con las mismas declaraciones (npm run permisos)
function imprimirMatriz(modulos) {
  const filas = modulos.flatMap(({ nombre, roles, rutas }) => rutas.map(([metodo, ruta]) =>
    [`${metodo} ${ruta}`, roles === PUBLICO ? 'PÚBLICO' : roles.join(', '), `rutas/${nombre}`]));
  const ancho = Math.max(...filas.map((f) => f[0].length));
  for (const [ruta, roles, modulo] of filas) console.log(`${ruta.padEnd(ancho)}  ${roles.padEnd(44)} ${modulo}`);
}

module.exports = { montarApi, imprimirMatriz };
