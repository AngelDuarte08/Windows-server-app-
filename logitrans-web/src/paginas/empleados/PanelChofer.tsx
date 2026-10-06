import { useCallback, useEffect, useState } from 'react';
import { api, type Envio } from '../../api';
import Insignia from '../../componentes/Insignia';

interface RutaChofer {
  id: string;
  nombre: string;
  fecha: string;
  estado: string;
  vehiculo: { placas: string; descripcion: string };
  envios: Envio[];
}

const SIGUIENTE: Record<string, { estado: string; texto: string } | undefined> = {
  SOLICITADO: { estado: 'EN_RUTA', texto: 'Marcar en ruta' },
  EN_RUTA: { estado: 'ENTREGADO', texto: 'Marcar entregado' },
};

export default function PanelChofer() {
  const [rutas, setRutas] = useState<RutaChofer[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get<RutaChofer[]>('/api/rutas/mias').then(setRutas).catch((e) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);

  const avanzar = async (envio: Envio, estado: string) => {
    const comentario = estado === 'ENTREGADO' ? prompt('Comentario de entrega (opcional):') ?? undefined : undefined;
    try {
      await api.patch(`/api/envios/${envio.id}/estado`, { estado, comentario: comentario || undefined });
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error) return <p className="alerta">{error}</p>;
  if (!rutas.length) return <p className="tenue">No tienes rutas asignadas.</p>;

  return (
    <>
      {rutas.map((r) => (
        <div key={r.id} className="tarjeta">
          <h2>{r.nombre} <Insignia estado={r.estado} /></h2>
          <p className="tenue">
            {new Date(r.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })} · {r.vehiculo.descripcion} ({r.vehiculo.placas})
          </p>
          <table>
            <thead>
              <tr><th>Folio</th><th>Origen</th><th>Destino</th><th>Peso</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {r.envios.map((e) => {
                const sig = SIGUIENTE[e.estado];
                return (
                  <tr key={e.id}>
                    <td className="mono">{e.folioRastreo}</td>
                    <td>{e.direccionOrigen}</td>
                    <td>{e.direccionDestino}</td>
                    <td>{e.pesoKg} kg</td>
                    <td><Insignia estado={e.estado} /></td>
                    <td>{sig && <button onClick={() => avanzar(e, sig.estado)}>{sig.texto}</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
