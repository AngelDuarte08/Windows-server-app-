import { useState } from 'react';
import { useSesion } from '../../sesion';
import PanelChofer from './PanelChofer';
import Rutas from './Rutas';
import NuevaRuta from './NuevaRuta';
import Reportes from './Reportes';
import Bitacora from './Bitacora';
import Empleados from './Empleados';

// Pestañas visibles por rol (Tabla 17. Matriz de permisos)
const PESTANAS: Record<string, { id: string; texto: string }[]> = {
  CHOFER: [{ id: 'mias', texto: 'Mis rutas' }],
  EMPLEADO: [
    { id: 'rutas', texto: 'Rutas' },
    { id: 'nueva', texto: 'Asignar ruta' },
    { id: 'reportes', texto: 'Reportes' },
  ],
  ADMINISTRADOR: [
    { id: 'empleados', texto: 'Empleados y accesos' },
    { id: 'bitacora', texto: 'Bitácora' },
    { id: 'reportes', texto: 'Reportes' },
    { id: 'rutas', texto: 'Rutas' },
  ],
};

export default function PanelEmpleado() {
  const { usuario } = useSesion();
  const pestanas = PESTANAS[usuario!.rol] ?? [];
  const [activa, setActiva] = useState(pestanas[0]?.id);

  return (
    <section>
      <div className="pestanas">
        {pestanas.map((p) => (
          <button key={p.id} className={p.id === activa ? 'activa' : 'secundario'} onClick={() => setActiva(p.id)}>
            {p.texto}
          </button>
        ))}
      </div>
      {activa === 'mias' && <PanelChofer />}
      {activa === 'rutas' && <Rutas />}
      {activa === 'nueva' && <NuevaRuta alCrear={() => setActiva('rutas')} />}
      {activa === 'reportes' && <Reportes />}
      {activa === 'bitacora' && <Bitacora />}
      {activa === 'empleados' && <Empleados />}
    </section>
  );
}
