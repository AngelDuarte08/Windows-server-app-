// Módulos de rutas, uno por rol. Cada módulo declara { nombre, roles, rutas };
// seguridad/permisos.js arma con ellos la matriz de permisos y registra las rutas en Express.
module.exports = [
  require('./publico'),         // sin sesión
  require('./sesion'),          // cualquier sesión
  require('./cliente'),         // CLIENTE
  require('./chofer'),          // CHOFER
  require('./empleado'),        // EMPLEADO
  require('./consultas'),       // EMPLEADO + ADMINISTRADOR (solo lectura)
  require('./administrador'),   // ADMINISTRADOR
];
