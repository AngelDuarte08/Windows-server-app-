import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fecha, type Envio } from '../../api';
import Insignia from '../../componentes/Insignia';

export default function MisEnvios() {
  const [envios, setEnvios] = useState<Envio[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Envio[]>('/api/envios').then(setEnvios).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alerta">{error}</p>;
  if (!envios) return <p className="tenue">Cargando…</p>;

  return (
    <div className="tarjeta">
      <div className="fila-titulo">
        <h1>Mis envíos</h1>
        <Link to="/clientes/envios/nuevo" className="boton">Solicitar envío</Link>
      </div>
      {!envios.length ? <p className="tenue">Todavía no has solicitado envíos.</p> : (
        <table>
          <thead><tr><th>Folio</th><th>Descripción</th><th>Destino</th><th>Estado</th><th>Solicitado</th></tr></thead>
          <tbody>
            {envios.map((e) => (
              <tr key={e.folioRastreo}>
                <td><Link to={`/clientes/envios/${e.folioRastreo}`} className="mono">{e.folioRastreo}</Link></td>
                <td>{e.descripcion}</td>
                <td>{e.direccionDestino}</td>
                <td><Insignia estado={e.estado} /></td>
                <td className="tenue">{fecha(e.creadoEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
