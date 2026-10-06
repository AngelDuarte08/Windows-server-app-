# LogiTrans del Centro · Sistema de Gestión de Envíos

Aplicación web segura para una empresa de transporte (ficticia), desarrollada como práctica de la materia de
**Ciberseguridad** (Ingeniería en Software, Universidad Politécnica de Pénjamo).

Los empleados gestionan rutas y envíos con su cuenta de **Active Directory**, y los clientes externos
solicitan y rastrean sus envíos con **correo, contraseña y 2FA**. Todo está diseñado para correr en un
solo servidor **Windows Server 2022** (SRV-LOGI01), aplicando la tríada CIA, el mínimo privilegio y el
OWASP Top 10.

## Características

- **Login único:** la app busca primero en los clientes y, si no lo encuentra, trata al usuario como empleado y lo valida contra Active Directory (LDAPS). Cada quien llega a su panel.
- **Cuatro roles** con una matriz de permisos central (*deny by default*): ADMINISTRADOR, EMPLEADO, CHOFER y CLIENTE.
- **2FA (TOTP)** para clientes, con verificación de correo y bloqueo tras 5 intentos.
- **Bitácora de auditoría inalterable:** sin permisos de UPDATE/DELETE para la app y un trigger que rechaza cambios.
- **Revocación inmediata** de empleados: la sesión se invalida en su siguiente petición.
- **Protección contra IDOR:** el dueño de cada recurso sale del token, nunca de la URL.
- **Identificadores UUID v7** y folios de rastreo aleatorios.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript (Vite) |
| Backend | Node.js 24 + Express 5 (Servidor.js) |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL 18 |
| Identidad | Active Directory (LDAPS) + JWT en cookie HttpOnly |
| Servidor web | IIS 10 + URL Rewrite + ARR (proxy inverso con HTTPS) |
| Sistema operativo | Windows Server 2022 |

## Estructura

```
.
├── base-de-datos/
│   └── crear_base_de_datos.sql     Tablas, roles de PostgreSQL, permisos y triggers
├── logitrans-api/                  BACKEND
│   ├── Servidor.js                 Arranque: middlewares globales y montaje de rutas
│   ├── src/
│   │   ├── config.js               Lee el .env y valida los secretos
│   │   ├── roles.js                Roles y grupos de AD
│   │   ├── seguridad/              Sesión (JWT), matriz de permisos, bitácora, cifrado, rate limit
│   │   ├── servicios/              Active Directory y tareas periódicas
│   │   └── rutas/                  Un archivo por rol (publico, sesion, cliente, chofer,
│   │                               empleado, consultas, administrador)
│   ├── pruebas/matriz-permisos.js  Prueba cada endpoint contra cada rol
│   ├── prisma/schema.prisma        Modelo de datos
│   └── .env.example                Plantilla de configuración
└── logitrans-web/                  FRONTEND
    ├── src/paginas/                Login, panel del personal y portal de clientes
    └── public/web.config           Configuración de IIS (HTTPS, proxy /api, cabeceras de seguridad)
```

## Correr en local

Requisitos: **Node.js 24** y **PostgreSQL 18**. Sin Active Directory, el backend usa un AD simulado.

**1. Base de datos** (como superusuario de PostgreSQL):

```bash
psql -h 127.0.0.1 -U postgres \
  -v app_password="AppLogiTrans-2026.Segura" \
  -v respaldo_password="RespLogiTrans-2026.Segura" \
  -f base-de-datos/crear_base_de_datos.sql
```

**2. Backend:**

```bash
cd logitrans-api
npm install
cp .env.example .env
npm run generar-clave        # ejecútalo dos veces: pega los valores en JWT_SECRET y CLAVE_CIFRADO
npx prisma generate
npm run dev                  # http://127.0.0.1:3000
```

En local pon `COOKIE_SECURE=false` en el `.env` (no hay HTTPS) y revisa que `DATABASE_URL` use la
contraseña de `app_logitrans` del paso 1.

**3. Frontend** (en otra terminal):

```bash
cd logitrans-web
npm install
npm run dev                  # http://localhost:5173
```

### Usuarios de prueba

Con `AD_SIMULADO=true`, los empleados usan la contraseña de `AD_SIMULADO_PASSWORD` del `.env`:

| Usuario | Rol | Llega a |
|---|---|---|
| `ana.torres` | ADMINISTRADOR | Empleados y accesos, bitácora, reportes, rutas |
| `maria.lopez` | EMPLEADO | Rutas, asignar ruta, reportes |
| `juan.perez`, `carlos.ruiz` | CHOFER | Mis rutas |

Los **clientes** se registran en la pantalla de login (**Crea tu cuenta**). No hay servidor de correo:
el enlace de verificación aparece en la terminal del backend, en la línea que empieza con `[CORREO]`.
Después se escanea el QR con Google o Microsoft Authenticator.

## Roles y permisos

| Rol | Origen | Puede |
|---|---|---|
| ADMINISTRADOR | Grupo de AD `GG_Administradores` | Revocar y reactivar accesos, ver la bitácora, reportes y rutas. No modifica envíos. |
| EMPLEADO | Grupo de AD `GG_Empleados` | Crear rutas y asignar envíos, choferes y vehículos; ver rutas y reportes. |
| CHOFER | Grupo de AD `GG_Choferes` | Ver sus rutas y cambiar el estado de los envíos de esas rutas. |
| CLIENTE | Cuenta del portal (sin AD) | Solicitar, listar y rastrear solo sus envíos; cambiar su contraseña. |

Cada archivo de `logitrans-api/src/rutas/` declara sus roles; con esas declaraciones se arma la matriz.
Un endpoint no declarado responde 404, y el servidor no arranca si una ruta queda sin roles.

```bash
cd logitrans-api
npm run permisos                                   # imprime la matriz completa
node Servidor.js > servidor.log 2>&1 &             # en una base de laboratorio:
npm run prueba:permisos -- servidor.log            # 107 comprobaciones (roles, IDOR, login, revocación)
```

## Despliegue en Windows Server

En producción, todo vive en SRV-LOGI01:

1. **Active Directory y AD CS:** dominio `logitrans.local`, grupos `GG_*`, LDAPS y certificado para `portal.logitrans.local`.
2. **PostgreSQL 18:** escucha solo en `127.0.0.1`, como servicio con NetworkService.
3. **Servidor.js:** servicio de Windows (NSSM) con `LocalService`, en `127.0.0.1:3000`, con `NODE_ENV=production` y `AD_SIMULADO=false`.
4. **IIS:** sirve `logitrans-web/dist` por HTTPS y reenvía `/api` a Node.
5. **Firewall de Windows:** desde la red de clientes solo se permite el puerto 443.

## Seguridad del repositorio

- El archivo `.env` real **nunca** se sube: contiene los secretos (JWT, clave de cifrado, contraseñas de la base y de LDAP). Solo se versiona `.env.example`.
- Las contraseñas que aparecen en este README y en `.env.example` son **de ejemplo para laboratorio**. En el servidor, genera contraseñas nuevas.
- Los certificados y llaves (`*.cer`, `*.pem`, `*.pfx`…) tampoco se suben.
