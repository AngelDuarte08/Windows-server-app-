import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api';

export default function Configurar2FA() {
  const datos = useLocation().state as { qr: string; secreto: string } | null;
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  if (!datos) {
    return (
      <div className="tarjeta angosto">
        <h1>Configurar 2FA</h1>
        <p className="tenue">Abre el enlace de verificación que recibiste por correo para configurar tu segundo factor.</p>
      </div>
    );
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/clientes/2fa/confirmar', { codigo });
      setListo(true);
    } catch (err) {
      setError((err as Error).message);
      setCodigo('');
    }
  };

  if (listo) {
    return (
      <div className="tarjeta angosto">
        <h1>¡Cuenta lista!</h1>
        <p>Tu segundo factor quedó configurado. Ya puedes iniciar sesión.</p>
        <Link to="/login" className="boton">Ir a iniciar sesión</Link>
      </div>
    );
  }

  return (
    <form className="tarjeta formulario angosto" onSubmit={enviar}>
      <h1>Configura tu segundo factor</h1>
      <ol>
        <li>Abre Google Authenticator o Microsoft Authenticator.</li>
        <li>Escanea este código QR.</li>
        <li>Escribe el código de 6 dígitos que aparece.</li>
      </ol>
      <img src={datos.qr} alt="Código QR para la app autenticadora" className="qr" />
      <details>
        <summary>¿No puedes escanear? Captura la clave manualmente</summary>
        <code className="mono">{datos.secreto}</code>
      </details>
      <label>Código de 6 dígitos
        <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
               inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required />
      </label>
      {error && <p className="alerta">{error}</p>}
      <button>Confirmar</button>
    </form>
  );
}
