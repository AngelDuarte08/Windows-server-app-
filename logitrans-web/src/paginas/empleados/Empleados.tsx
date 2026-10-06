import { useCallback, useEffect, useState } from 'react';
import { api, fecha } from '../../api';

interface Empleado {
  id: string; usuarioAD: string; nombre: string; rol: string; activo: boolean; ultimoAcceso: string | null;
}

export default function Empleados() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get<Empleado[]>('/api/empleados').then(setEmpleados).catch((e) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);

  const cambiar = async (emp: Empleado) => {
    const accion = emp.activo ? 'revocar' : 'reactivar';
    const aviso = emp.activo
      ? `¿Revocar el acceso de ${emp.nombre}? Su sesión se invalidará de inmediato.\n\nRecuerda deshabilitar también la cuenta en Active Directory (Disable-ADAccount).`
      : `¿Reactivar el acceso de ${emp.nombre} en el portal?`;
    if (!confirm(aviso)) return;
    try {
      await api.post(`/api/empleados/${emp.id}/${accion}`);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="tarjeta">
      <h2>Empleados y accesos</h2>
      <p className="tenue">Los empleados se registran aquí en su primer inicio de sesión con Active Directory.</p>
      {error && <p className="alerta">{error}</p>}
      <table>
        <thead><tr><th>Usuario AD</th><th>Nombre</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th /></tr></thead>
        <tbody>
          {empleados.map((e) => (
            <tr key={e.id}>
              <td className="mono">{e.usuarioAD}</td>
              <td>{e.nombre}</td>
              <td>{e.rol}</td>
              <td className="tenue">{fecha(e.ultimoAcceso)}</td>
              <td>
                <span className={`insignia ${e.activo ? 'insignia-entregado' : 'insignia-cancelado'}`}>
                  {e.activo ? 'Activo' : 'Revocado'}
                </span>
              </td>
              <td>
                <button className={e.activo ? 'peligro' : 'secundario'} onClick={() => cambiar(e)}>
                  {e.activo ? 'Revocar acceso' : 'Reactivar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
