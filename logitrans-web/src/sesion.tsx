import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Usuario } from './api';

interface Sesion {
  usuario: Usuario | null;
  cargando: boolean;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    try {
      setUsuario(await api.get<Usuario>('/api/auth/yo'));
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  const salir = useCallback(async () => {
    await api.post('/api/auth/salir').catch(() => {});
    setUsuario(null);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return <Contexto.Provider value={{ usuario, cargando, recargar, salir }}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSesion fuera de ProveedorSesion');
  return s;
}
