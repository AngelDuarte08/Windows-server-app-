import { useEffect, useState } from 'react';
import { api, ETIQUETA_ESTADO } from '../../api';

interface Reporte {
  total: number;
  entregados30: number;
  rutasActivas: number;
  porEstado: { estado: string; cantidad: number; pesoKg: string | null }[];
}

export default function Reportes() {
  const [r, setR] = useState<Reporte | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Reporte>('/api/reportes/envios').then(setR).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alerta">{error}</p>;
  if (!r) return <p className="tenue">Cargando…</p>;

  const maximo = Math.max(1, ...r.porEstado.map((e) => e.cantidad));

  return (
    <>
      <div className="rejilla-3">
        <div className="tarjeta kpi"><small>Envíos totales</small><strong>{r.total}</strong></div>
        <div className="tarjeta kpi"><small>Entregados (30 días)</small><strong>{r.entregados30}</strong></div>
        <div className="tarjeta kpi"><small>Rutas activas</small><strong>{r.rutasActivas}</strong></div>
      </div>
      <div className="tarjeta">
        <h2>Envíos por estado</h2>
        {r.porEstado.map((e) => (
          <div key={e.estado} className="fila-barra">
            <span>{ETIQUETA_ESTADO[e.estado] ?? e.estado}</span>
            <div className="barra"><div className="relleno" style={{ width: `${(e.cantidad / maximo) * 100}%` }} /></div>
            <span>{e.cantidad} · {Number(e.pesoKg ?? 0).toLocaleString('es-MX')} kg</span>
          </div>
        ))}
        {!r.porEstado.length && <p className="tenue">Sin datos todavía.</p>}
      </div>
    </>
  );
}
