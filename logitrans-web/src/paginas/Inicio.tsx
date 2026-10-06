import { Navigate } from 'react-router-dom';
import { useSesion } from '../sesion';
import { inicioDe } from './Login';

// La raíz manda al panel de cada quien o al login único
export default function Inicio() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="tenue">Cargando…</p>;
  return <Navigate to={usuario ? inicioDe(usuario) : '/login'} replace />;
}
