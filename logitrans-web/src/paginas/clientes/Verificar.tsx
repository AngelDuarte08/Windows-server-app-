import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';

// Confirma el correo con el token del enlace y pasa a configurar el 2FA
export default function Verificar() {
  const { token } = useParams();
  const navegar = useNavigate();
  const [error, setError] = useState('');
  const enviado = useRef(false);   // el token es de un solo uso: evita la doble llamada de StrictMode

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    api.get<{ qr: string; secreto: string }>(`/api/clientes/verificar/${encodeURIComponent(token ?? '')}`)
      .then((datos) => navegar('/clientes/2fa', { replace: true, state: datos }))
      .catch((e) => setError(e.message));
  }, [token, navegar]);

  return (
    <div className="tarjeta angosto">
      <h1>Confirmando tu correo…</h1>
      {error && <p className="alerta">{error}</p>}
    </div>
  );
}
