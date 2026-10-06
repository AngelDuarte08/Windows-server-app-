import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

export default function NuevoEnvio() {
  const [direccionOrigen, setOrigen] = useState('');
  const [direccionDestino, setDestino] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [peso, setPeso] = useState('');
  const [error, setError] = useState('');
  const [folio, setFolio] = useState('');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const pesoKg = Number(peso);
    if (!(pesoKg > 0 && pesoKg <= 25000)) return setError('El peso debe estar entre 0.01 y 25,000 kg');
    try {
      const r = await api.post<{ folioRastreo: string }>('/api/envios', { direccionOrigen, direccionDestino, descripcion, pesoKg });
      setFolio(r.folioRastreo);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (folio) {
    return (
      <div className="tarjeta angosto">
        <h1>Envío solicitado</h1>
        <p>Tu folio de rastreo es:</p>
        <p className="folio mono">{folio}</p>
        <Link to={`/clientes/envios/${folio}`} className="boton">Ver rastreo</Link>
      </div>
    );
  }

  return (
    <form className="tarjeta formulario angosto" onSubmit={enviar}>
      <h1>Solicitar envío</h1>
      <label>Dirección de recolección
        <textarea value={direccionOrigen} onChange={(e) => setOrigen(e.target.value)} minLength={10} maxLength={250} rows={2} required />
      </label>
      <label>Dirección de entrega
        <textarea value={direccionDestino} onChange={(e) => setDestino(e.target.value)} minLength={10} maxLength={250} rows={2} required />
      </label>
      <label>Descripción de la mercancía
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} minLength={3} maxLength={250} required />
      </label>
      <label>Peso (kg)
        <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} min="0.01" max="25000" step="0.01" required />
      </label>
      {error && <p className="alerta">{error}</p>}
      <button>Solicitar</button>
    </form>
  );
}
