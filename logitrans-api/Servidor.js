// Servidor.js — Sistema de Gestión de Envíos · LogiTrans del Centro
// Punto de entrada: middlewares globales, rutas por rol (src/rutas) y arranque.
const config = require('./src/config');          // primero: valida el .env antes de cargar lo demás
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { limiteGeneral } = require('./src/seguridad/limites');
const { montarApi } = require('./src/seguridad/permisos');
const manejadorErrores = require('./src/seguridad/errores');
const { iniciarTareas } = require('./src/servicios/tareas');
const modulosDeRutas = require('./src/rutas');

const app = express();

// Middlewares globales (cadena de seguridad, Tabla 5)
app.set('trust proxy', 1);                                   // IIS es el proxy inverso
app.disable('x-powered-by');
app.use(helmet());                                           // 1. cabeceras seguras
app.use(cors({ origin: config.ORIGEN, credentials: true })); // 2. solo nuestro dominio
app.use(express.json({ limit: '100kb' }));                   // 3. limita el tamaño del cuerpo
app.use(cookieParser());
app.use('/api', limiteGeneral);                              // 4. rate limit general

// 5-6. Matriz de permisos (deny by default) + rutas de cada rol
montarApi(app, modulosDeRutas);

app.use(manejadorErrores);                                   // 9. sin detalles internos

iniciarTareas();
app.listen(config.PUERTO, '127.0.0.1', () => {
  console.log(`Servidor.js escuchando en 127.0.0.1:${config.PUERTO}`);
  if (config.AD_SIMULADO) console.warn('ADVERTENCIA: AD_SIMULADO activo (solo laboratorio)');
});
