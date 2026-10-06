// Medidor de fortaleza (mismas reglas que valida Servidor.js con zod)
export function evaluarPassword(p: string) {
  const reglas = [
    { ok: p.length >= 12, texto: 'Mínimo 12 caracteres' },
    { ok: /[a-z]/.test(p) && /[A-Z]/.test(p), texto: 'Mayúsculas y minúsculas' },
    { ok: /\d/.test(p), texto: 'Al menos un número' },
    { ok: /[^A-Za-z0-9]/.test(p), texto: 'Al menos un símbolo' },
  ];
  const puntos = reglas.filter((r) => r.ok).length + (p.length >= 16 ? 1 : 0);
  return { reglas, puntos, valida: reglas.every((r) => r.ok) };
}

const NIVELES = ['Muy débil', 'Débil', 'Regular', 'Aceptable', 'Fuerte', 'Muy fuerte'];

export default function MedidorPassword({ password }: { password: string }) {
  const { reglas, puntos } = evaluarPassword(password);
  return (
    <div className="medidor">
      <div className="barra"><div className={`relleno nivel-${puntos}`} style={{ width: `${(puntos / 5) * 100}%` }} /></div>
      <small>{NIVELES[puntos]}</small>
      <ul>
        {reglas.map((r) => (
          <li key={r.texto} className={r.ok ? 'ok' : ''}>{r.ok ? '✓' : '·'} {r.texto}</li>
        ))}
      </ul>
    </div>
  );
}
