import { ETIQUETA_ESTADO } from '../api';

export default function Insignia({ estado }: { estado: string }) {
  return <span className={`insignia insignia-${estado.toLowerCase()}`}>{ETIQUETA_ESTADO[estado] ?? estado}</span>;
}
