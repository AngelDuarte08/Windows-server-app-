// Cliente HTTP mínimo. La sesión viaja en una cookie HttpOnly: el JS nunca ve el token.
export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje);
  }
}

async function pedir<T>(metodo: string, url: string, cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    credentials: 'same-origin',
    headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(res.status, datos.error ?? 'Ocurrió un error');
  return datos as T;
}

export const api = {
  get: <T>(url: string) => pedir<T>('GET', url),
  post: <T>(url: string, cuerpo: unknown = {}) => pedir<T>('POST', url, cuerpo),
  patch: <T>(url: string, cuerpo: unknown) => pedir<T>('PATCH', url, cuerpo),
};

export type Rol = 'ADMINISTRADOR' | 'EMPLEADO' | 'CHOFER' | 'CLIENTE';
export type EstadoEnvio = 'SOLICITADO' | 'EN_RUTA' | 'ENTREGADO' | 'CANCELADO';

export interface Usuario {
  tipo: 'EMPLEADO' | 'CLIENTE';
  rol: Rol;
  nombre: string;
}

export interface Envio {
  id?: string;
  folioRastreo: string;
  direccionOrigen: string;
  direccionDestino: string;
  descripcion: string;
  pesoKg: string;
  estado: EstadoEnvio;
  creadoEn: string;
  entregadoEn?: string | null;
  historial?: { estado: EstadoEnvio; comentario: string | null; fecha: string }[];
}

export const fecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const ETIQUETA_ESTADO: Record<string, string> = {
  SOLICITADO: 'Solicitado', EN_RUTA: 'En ruta', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado',
  PLANEADA: 'Planeada', EN_CURSO: 'En curso', FINALIZADA: 'Finalizada',
};
