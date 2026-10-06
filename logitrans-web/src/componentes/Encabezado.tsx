import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '../sesion';

const NOMBRE_ROL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador', EMPLEADO: 'Empleado', CHOFER: 'Chofer', CLIENTE: 'Cliente',
};

export default function Encabezado() {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();

  const cerrar = async () => {
    await salir();
    navegar('/login');
  };

  return (
    <header className="encabezado">
      <Link to="/" className="marca">LogiTrans <span>del Centro</span></Link>
      {usuario && (
        <nav>
          {usuario.tipo === 'CLIENTE' ? (
            <>
              <Link to="/clientes/envios">Mis envíos</Link>
              <Link to="/clientes/envios/nuevo">Solicitar envío</Link>
              <Link to="/clientes/cuenta">Mi cuenta</Link>
            </>
          ) : (
            <Link to="/empleados">Panel</Link>
          )}
          <span className="tenue">{usuario.nombre} · {NOMBRE_ROL[usuario.rol]}</span>
          <button className="secundario" onClick={cerrar}>Cerrar sesión</button>
        </nav>
      )}
    </header>
  );
}
