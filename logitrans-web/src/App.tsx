import { Navigate, Route, Routes } from 'react-router-dom';
import Encabezado from './componentes/Encabezado';
import RutaProtegida from './componentes/RutaProtegida';
import Inicio from './paginas/Inicio';
import Login from './paginas/Login';
import PanelEmpleado from './paginas/empleados/PanelEmpleado';
import Registro from './paginas/clientes/Registro';
import Verificar from './paginas/clientes/Verificar';
import Configurar2FA from './paginas/clientes/Configurar2FA';
import MisEnvios from './paginas/clientes/MisEnvios';
import NuevoEnvio from './paginas/clientes/NuevoEnvio';
import DetalleEnvio from './paginas/clientes/DetalleEnvio';
import Cuenta from './paginas/clientes/Cuenta';

const EMPLEADOS = ['ADMINISTRADOR', 'EMPLEADO', 'CHOFER'] as const;

export default function App() {
  return (
    <>
      <Encabezado />
      <main className="contenedor">
        <Routes>
          <Route path="/" element={<Inicio />} />

          {/* Login único: clientes (correo + 2FA) y personal (Active Directory) */}
          <Route path="/login" element={<Login />} />
          <Route path="/empleados/login" element={<Navigate to="/login" replace />} />
          <Route path="/clientes/login" element={<Navigate to="/login" replace />} />

          {/* Panel del personal: las pestañas dependen del rol */}
          <Route
            path="/empleados"
            element={
              <RutaProtegida roles={[...EMPLEADOS]} login="/login">
                <PanelEmpleado />
              </RutaProtegida>
            }
          />

          {/* Portal de clientes */}
          <Route path="/clientes/registro" element={<Registro />} />
          <Route path="/clientes/verificar/:token" element={<Verificar />} />
          <Route path="/clientes/2fa" element={<Configurar2FA />} />
          <Route
            path="/clientes/envios"
            element={<RutaProtegida roles={['CLIENTE']} login="/login"><MisEnvios /></RutaProtegida>}
          />
          <Route
            path="/clientes/envios/nuevo"
            element={<RutaProtegida roles={['CLIENTE']} login="/login"><NuevoEnvio /></RutaProtegida>}
          />
          <Route
            path="/clientes/envios/:folio"
            element={<RutaProtegida roles={['CLIENTE']} login="/login"><DetalleEnvio /></RutaProtegida>}
          />
          <Route
            path="/clientes/cuenta"
            element={<RutaProtegida roles={['CLIENTE']} login="/login"><Cuenta /></RutaProtegida>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
