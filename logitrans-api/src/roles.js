// Roles de la aplicación. Los de empleados salen del grupo de AD; CLIENTE es para cuentas del portal externo.
const ROLES = Object.freeze({
  ADMINISTRADOR: 'ADMINISTRADOR',
  EMPLEADO: 'EMPLEADO',
  CHOFER: 'CHOFER',
  CLIENTE: 'CLIENTE',
});

// Grupo de Active Directory → rol. Una cuenta debe pertenecer a exactamente uno.
const GRUPOS_ROL = Object.freeze({
  GG_Administradores: ROLES.ADMINISTRADOR,
  GG_Empleados: ROLES.EMPLEADO,
  GG_Choferes: ROLES.CHOFER,
});

// Valores especiales para declarar quién puede usar un grupo de rutas
const PUBLICO = 'PUBLICO';
const CUALQUIER_SESION = Object.freeze(Object.values(ROLES));

module.exports = { ROLES, GRUPOS_ROL, PUBLICO, CUALQUIER_SESION };
