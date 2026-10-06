import { useEffect, useState } from 'react';
import { api, fecha } from '../../api';

interface Registro {
  id: string; fecha: string; tipoUsuario: string; usuarioId: string | null;
  accion: string; recurso: string; ip: string; resultado: 'EXITO' | 'FALLO';
}

export default function Bitacora() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [soloFallos, setSoloFallos] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Registro[]>('/api/bitacora').then(setRegistros).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alerta">{error}</p>;
  const visibles = soloFallos ? registros.filter((r) => r.resultado === 'FALLO') : registros;

  return (
    <div className="tarjeta">
      <h2>Bitácora de auditoría</h2>
      <p className="tenue">Últimos 200 eventos. Solo lectura: la cuenta de la aplicación no puede modificar ni borrar registros.</p>
      <label className="en-linea">
        <input type="checkbox" checked={soloFallos} onChange={(e) => setSoloFallos(e.target.checked)} /> Mostrar solo fallos
      </label>
      <table>
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Recurso</th><th>IP</th><th>Resultado</th></tr></thead>
        <tbody>
          {visibles.map((r) => (
            <tr key={r.id}>
              <td className="tenue">{fecha(r.fecha)}</td>
              <td title={r.usuarioId ?? undefined}>{r.tipoUsuario}{r.usuarioId && <span className="mono tenue"> {r.usuarioId.slice(0, 8)}…</span>}</td>
              <td className="mono">{r.accion}</td>
              <td className="mono">{r.recurso}</td>
              <td className="mono">{r.ip}</td>
              <td><span className={`insignia ${r.resultado === 'EXITO' ? 'insignia-entregado' : 'insignia-cancelado'}`}>{r.resultado}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
