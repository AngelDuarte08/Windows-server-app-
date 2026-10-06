import { useState, type FormEvent } from 'react';
import { api } from '../../api';
import MedidorPassword, { evaluarPassword } from '../../componentes/MedidorPassword';
import { useSesion } from '../../sesion';

export default function Cuenta() {
  const { usuario } = useSesion();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setOk(false);
    if (!evaluarPassword(nueva).valida) return setError('La nueva contraseña no cumple los requisitos');
    if (nueva !== confirmacion) return setError('Las contraseñas no coinciden');
    try {
      await api.post('/api/clientes/password', { actual, nueva });
      setOk(true);
      setActual(''); setNueva(''); setConfirmacion('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="tarjeta formulario angosto" onSubmit={enviar}>
      <h1>Mi cuenta</h1>
      <p className="tenue">{usuario?.nombre}</p>
      <h2>Cambiar contraseña</h2>
      <label>Contraseña actual
        <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
      </label>
      <label>Nueva contraseña
        <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" maxLength={128} required />
      </label>
      <MedidorPassword password={nueva} />
      <label>Confirmar nueva contraseña
        <input type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p className="alerta">{error}</p>}
      {ok && <p className="exito">Contraseña actualizada.</p>}
      <button>Guardar</button>
    </form>
  );
}
