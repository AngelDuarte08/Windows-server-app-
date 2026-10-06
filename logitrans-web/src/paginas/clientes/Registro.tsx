import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import MedidorPassword, { evaluarPassword } from '../../componentes/MedidorPassword';

export default function Registro() {
  const [razonSocial, setRazonSocial] = useState('');
  const [rfc, setRfc] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!evaluarPassword(password).valida) return setError('La contraseña no cumple los requisitos');
    if (password !== confirmacion) return setError('Las contraseñas no coinciden');
    if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) return setError('El RFC no tiene un formato válido');
    setEnviando(true);
    try {
      const r = await api.post<{ mensaje: string }>('/api/clientes/registro', { razonSocial, rfc, email, password });
      setMensaje(r.mensaje);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (mensaje) {
    return (
      <div className="tarjeta angosto">
        <h1>Revisa tu correo</h1>
        <p>{mensaje}. El enlace vence en 24 horas.</p>
        <p className="tenue">Después de confirmarlo configurarás tu segundo factor de autenticación (2FA).</p>
      </div>
    );
  }

  return (
    <form className="tarjeta formulario angosto" onSubmit={enviar}>
      <h1>Crear cuenta</h1>
      <label>Razón social o nombre
        <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} minLength={3} maxLength={150} required />
      </label>
      <label>RFC (opcional)
        <input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase().trim())} maxLength={13} />
      </label>
      <label>Correo electrónico
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} required />
      </label>
      <label>Contraseña
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={128} required />
      </label>
      <MedidorPassword password={password} />
      <label>Confirmar contraseña
        <input type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" maxLength={128} required />
      </label>
      {error && <p className="alerta">{error}</p>}
      <button disabled={enviando}>{enviando ? 'Enviando…' : 'Registrarme'}</button>
      <p className="tenue">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </form>
  );
}
