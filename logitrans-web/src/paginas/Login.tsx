import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, type Usuario } from '../api';
import { useSesion } from '../sesion';

// Panel al que va cada quien después de iniciar sesión
export const inicioDe = (u: Pick<Usuario, 'rol'>) => (u.rol === 'CLIENTE' ? '/clientes/envios' : '/empleados');

// Login único: el servidor busca primero en clientes y luego en empleados (Active Directory).
// Si es cliente, pide además el código de su app autenticadora.
export default function Login() {
  const { usuario: sesion, recargar } = useSesion();
  const navegar = useNavigate();
  const [paso, setPaso] = useState<'credenciales' | 'codigo'>('credenciales');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (sesion) return <Navigate to={inicioDe(sesion)} replace />;

  const entrar = async (u: Usuario) => {
    await recargar();
    navegar(inicioDe(u), { replace: true });
  };

  const enviarCredenciales = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await api.post<Usuario & { requiere2FA?: boolean }>('/api/auth/login', { usuario, password });
      setPassword('');
      if (r.requiere2FA) setPaso('codigo');
      else await entrar(r);
    } catch (err) {
      setError((err as Error).message);   // siempre genérico: no revela si la cuenta existe
      setPassword('');
    } finally {
      setEnviando(false);
    }
  };

  const enviarCodigo = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await entrar(await api.post<Usuario>('/api/auth/login/2fa', { codigo }));
    } catch (err) {
      setError((err as Error).message);
      setCodigo('');
      if ((err as Error).message.includes('expiró')) setPaso('credenciales');
    } finally {
      setEnviando(false);
    }
  };

  if (paso === 'codigo') {
    return (
      <form className="tarjeta formulario angosto" onSubmit={enviarCodigo}>
        <h1>Verificación en dos pasos</h1>
        <p className="tenue">Escribe el código de 6 dígitos de tu app autenticadora.</p>
        <label>Código
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                 inputMode="numeric" autoComplete="one-time-code" placeholder="123456" pattern="\d{6}" autoFocus required />
        </label>
        {error && <p className="alerta">{error}</p>}
        <button disabled={enviando}>{enviando ? 'Verificando…' : 'Entrar'}</button>
        <button type="button" className="secundario" onClick={() => { setPaso('credenciales'); setError(''); }}>
          Volver
        </button>
      </form>
    );
  }

  return (
    <form className="tarjeta formulario angosto" onSubmit={enviarCredenciales}>
      <h1>Iniciar sesión</h1>
      <p className="tenue">Clientes: usa tu correo. Personal de LogiTrans: usa tu usuario del dominio (nombre.apellido).</p>
      <label>Correo o usuario
        <input value={usuario} onChange={(e) => setUsuario(e.target.value.trim())}
               autoComplete="username" maxLength={120} autoFocus required />
      </label>
      <label>Contraseña
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
               autoComplete="current-password" maxLength={128} required />
      </label>
      {error && <p className="alerta">{error}</p>}
      <button disabled={enviando}>{enviando ? 'Validando…' : 'Continuar'}</button>
      <p className="tenue">¿Eres cliente nuevo? <Link to="/clientes/registro">Crea tu cuenta</Link></p>
    </form>
  );
}
