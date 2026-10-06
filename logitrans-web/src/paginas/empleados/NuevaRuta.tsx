import { useEffect, useState, type FormEvent } from 'react';
import { api, fecha as formatoFecha } from '../../api';

interface Opcion { id: string; nombre?: string; placas?: string; descripcion?: string }
interface Pendiente {
  id: string; folioRastreo: string; direccionOrigen: string; direccionDestino: string;
  pesoKg: string; descripcion: string; creadoEn: string;
}

export default function NuevaRuta({ alCrear }: { alCrear: () => void }) {
  const [choferes, setChoferes] = useState<Opcion[]>([]);
  const [vehiculos, setVehiculos] = useState<Opcion[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [choferId, setChoferId] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Opcion[]>('/api/despacho/choferes'),
      api.get<Opcion[]>('/api/vehiculos'),
      api.get<Pendiente[]>('/api/despacho/envios'),
    ]).then(([c, v, p]) => { setChoferes(c); setVehiculos(v); setPendientes(p); })
      .catch((e) => setError(e.message));
  }, []);

  const alternar = (id: string) => {
    const s = new Set(seleccion);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSeleccion(s);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!seleccion.size) return setError('Selecciona al menos un envío');
    try {
      await api.post('/api/rutas', {
        nombre, fecha, choferId, vehiculoId, envioIds: [...seleccion],
      });
      alCrear();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h2>Asignar ruta</h2>
      {!choferes.length && (
        <p className="tenue">
          Los choferes aparecen aquí después de su primer inicio de sesión con Active Directory.
        </p>
      )}
      <div className="rejilla-2">
        <label>Nombre de la ruta
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} minLength={3} maxLength={100}
                 placeholder="León – Irapuato matutina" required />
        </label>
        <label>Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label>Chofer
          <select value={choferId} onChange={(e) => setChoferId(e.target.value)} required>
            <option value="">Selecciona…</option>
            {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>Vehículo
          <select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} required>
            <option value="">Selecciona…</option>
            {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.placas} · {v.descripcion}</option>)}
          </select>
        </label>
      </div>

      <h3>Envíos pendientes de asignar</h3>
      {!pendientes.length ? <p className="tenue">No hay envíos pendientes.</p> : (
        <table>
          <thead><tr><th /><th>Folio</th><th>Origen</th><th>Destino</th><th>Peso</th><th>Solicitado</th></tr></thead>
          <tbody>
            {pendientes.map((p) => (
              <tr key={p.id} onClick={() => alternar(p.id)} className="seleccionable">
                <td><input type="checkbox" checked={seleccion.has(p.id)} readOnly /></td>
                <td className="mono">{p.folioRastreo}</td>
                <td>{p.direccionOrigen}</td>
                <td>{p.direccionDestino}</td>
                <td>{p.pesoKg} kg</td>
                <td className="tenue">{formatoFecha(p.creadoEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="alerta">{error}</p>}
      <button>Crear ruta con {seleccion.size} envío(s)</button>
    </form>
  );
}
