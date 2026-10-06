import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Rol } from '../api';
import { useSesion } from '../sesion';

// Solo oculta pantallas: la autorización real la hace Servidor.js en cada endpoint
export default function RutaProtegida({ roles, login, children }: { roles: Rol[]; login: string; children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="tenue">Cargando…</p>;
  if (!usuario) return <Navigate to={login} replace />;
  if (!roles.includes(usuario.rol)) return <p className="alerta">No tienes permiso para ver esta página.</p>;
  return <>{children}</>;
}
