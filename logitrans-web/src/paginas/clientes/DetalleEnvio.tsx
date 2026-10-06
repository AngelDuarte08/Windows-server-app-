import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ETIQUETA_ESTADO, fecha, type Envio } from '../../api';
import Insignia from '../../componentes/Insignia';

export default function DetalleEnvio() {
  const { folio } = useParams();
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Envio>(`/api/envios/${encodeURIComponent(folio ?? '')}`).then(setEnvio).catch((e) => setError(e.message));
  }, [folio]);

  if (error) return <div className="tarjeta angosto"><p className="alerta">{error}</p><Link to="/clientes/envios">Volver</Link></div>;
  if (!envio) return <p className="tenue">Cargando…</p>;

  return (
    <div className="tarjeta">
      <div className="fila-titulo">
        <h1 className="mono">{envio.folioRastreo}</h1>
        <Insignia estado={envio.estado} />
      </div>
      <dl className="datos">
        <dt>Mercancía</dt><dd>{envio.descripcion} · {envio.pesoKg} kg</dd>
        <dt>Origen</dt><dd>{envio.direccionOrigen}</dd>
        <dt>Destino</dt><dd>{envio.direccionDestino}</dd>
        <dt>Solicitado</dt><dd>{fecha(envio.creadoEn)}</dd>
        <dt>Entregado</dt><dd>{fecha(envio.entregadoEn)}</dd>
      </dl>
      <h2>Historial</h2>
      <ol className="linea-tiempo">
        {envio.historial?.map((h, i) => (
          <li key={i}>
            <strong>{ETIQUETA_ESTADO[h.estado]}</strong>
            <span className="tenue"> · {fecha(h.fecha)}</span>
            {h.comentario && <p>{h.comentario}</p>}
          </li>
        ))}
      </ol>
      <Link to="/clientes/envios">← Mis envíos</Link>
    </div>
  );
}
