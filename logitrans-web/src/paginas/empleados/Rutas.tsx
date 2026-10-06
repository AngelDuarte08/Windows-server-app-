import { useEffect, useState } from 'react';
import { api, fecha } from '../../api';
import Insignia from '../../componentes/Insignia';

interface Ruta {
  id: string;
  nombre: string;
  fecha: string;
  estado: string;
  creadoEn: string;
  chofer: { nombre: string };
  vehiculo: { placas: string };
  _count: { envios: number };
}

export default function Rutas() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Ruta[]>('/api/rutas').then(setRutas).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alerta">{error}</p>;

  return (
    <div className="tarjeta">
      <h2>Rutas</h2>
      {!rutas.length ? <p className="tenue">Aún no hay rutas.</p> : (
        <table>
          <thead>
            <tr><th>Ruta</th><th>Fecha</th><th>Chofer</th><th>Vehículo</th><th>Envíos</th><th>Estado</th><th>Creada</th></tr>
          </thead>
          <tbody>
            {rutas.map((r) => (
              <tr key={r.id}>
                <td>{r.nombre}</td>
                <td>{new Date(r.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</td>
                <td>{r.chofer.nombre}</td>
                <td className="mono">{r.vehiculo.placas}</td>
                <td>{r._count.envios}</td>
                <td><Insignia estado={r.estado} /></td>
                <td className="tenue">{fecha(r.creadoEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
