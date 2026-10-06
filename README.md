# LogiTrans del Centro · Shipment Management System

A secure web application for a (fictional) transport company, built as a project for the **Cybersecurity**
course (Software Engineering, Universidad Politécnica de Pénjamo).

Employees manage routes and shipments with their **Active Directory** account, and external customers
request and track their shipments with **email, password and 2FA**. Everything is designed to run on a
single **Windows Server 2022** host (SRV-LOGI01), applying the CIA triad, least privilege and the
OWASP Top 10.

> The code, UI and database are in Spanish (route names, roles, table names). This README is in English.

## Features

- **Single login:** the app first looks the user up among customers; if not found, it treats them as an employee and validates them against Active Directory (LDAPS). Each user lands on their own dashboard.
- **Four roles** with a central, *deny-by-default* permission matrix: ADMINISTRADOR, EMPLEADO, CHOFER (driver) and CLIENTE (customer).
- **2FA (TOTP)** for customers, with email verification and account lockout after 5 failed attempts.
- **Tamper-proof audit log:** the app's database role has no UPDATE/DELETE on it, and a trigger rejects any change.
- **Immediate revocation** of employees: their session is invalidated on the next request.
- **IDOR protection:** the owner of every resource comes from the token, never from the URL.
- **UUID v7 identifiers** and random tracking numbers.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (Vite) |
| Backend | Node.js 24 + Express 5 (Servidor.js) |
| ORM | Prisma 6 |
| Database | PostgreSQL 18 |
| Identity | Active Directory (LDAPS) + JWT in an HttpOnly cookie |
| Web server | IIS 10 + URL Rewrite + ARR (HTTPS reverse proxy) |
| Operating system | Windows Server 2022 |

## Project structure

```
.
├── base-de-datos/
│   └── crear_base_de_datos.sql     Tables, PostgreSQL roles, permissions and triggers
├── logitrans-api/                  BACKEND
│   ├── Servidor.js                 Entry point: global middleware and route mounting
│   ├── src/
│   │   ├── config.js               Reads .env and validates secrets
│   │   ├── roles.js                Roles and AD groups
│   │   ├── seguridad/              Session (JWT), permission matrix, audit log, encryption, rate limiting
│   │   ├── servicios/              Active Directory and scheduled tasks
│   │   └── rutas/                  One file per role (publico, sesion, cliente, chofer,
│   │                               empleado, consultas, administrador)
│   ├── pruebas/matriz-permisos.js  Tests every endpoint against every role
│   ├── prisma/schema.prisma        Data model
│   └── .env.example                Configuration template
└── logitrans-web/                  FRONTEND
    ├── src/paginas/                Login, staff dashboard and customer portal
    └── public/web.config           IIS configuration (HTTPS, /api proxy, security headers)
```

## Running locally

Requirements: **Node.js 24** and **PostgreSQL 18**. Without Active Directory, the backend uses a simulated AD.

**1. Database** (as a PostgreSQL superuser):

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
npm run generar-clave        # run it twice: paste the values into JWT_SECRET and CLAVE_CIFRADO
npx prisma generate
npm run dev                  # http://127.0.0.1:3000
```

Locally, set `COOKIE_SECURE=false` in `.env` (there is no HTTPS) and make sure `DATABASE_URL` uses the
`app_logitrans` password from step 1.

**3. Frontend** (in another terminal):

```bash
cd logitrans-web
npm install
npm run dev                  # http://localhost:5173
```

### Test users

With `AD_SIMULADO=true`, employees use the password set in `AD_SIMULADO_PASSWORD` in `.env`:

| User | Role | Dashboard |
|---|---|---|
| `ana.torres` | ADMINISTRADOR | Employees and access, audit log, reports, routes |
| `maria.lopez` | EMPLEADO | Routes, assign route, reports |
| `juan.perez`, `carlos.ruiz` | CHOFER | My routes |

**Customers** sign up from the login screen (**Crea tu cuenta**). There is no mail server: the
verification link is printed in the backend terminal, on the line starting with `[CORREO]`. Then they
scan the QR code with Google or Microsoft Authenticator.

## Roles and permissions

| Role | Source | Can |
|---|---|---|
| ADMINISTRADOR | AD group `GG_Administradores` | Revoke and restore access, view the audit log, reports and routes. Cannot modify shipments. |
| EMPLEADO | AD group `GG_Empleados` | Create routes and assign shipments, drivers and vehicles; view routes and reports. |
| CHOFER | AD group `GG_Choferes` | View their own routes and update the status of shipments on those routes. |
| CLIENTE | Portal account (no AD) | Request, list and track only their own shipments; change their password. |

Each file in `logitrans-api/src/rutas/` declares its roles, and the matrix is built from those
declarations. An undeclared endpoint returns 404, and the server refuses to start if a route has no roles.

```bash
cd logitrans-api
npm run permisos                                   # prints the full matrix
node Servidor.js > servidor.log 2>&1 &             # against a lab database:
npm run prueba:permisos -- servidor.log            # 107 checks (roles, IDOR, login, revocation)
```

## Deploying to Windows Server

In production, everything runs on SRV-LOGI01:

1. **Active Directory and AD CS:** domain `logitrans.local`, `GG_*` groups, LDAPS and a certificate for `portal.logitrans.local`.
2. **PostgreSQL 18:** listens only on `127.0.0.1`, running as a service under NetworkService.
3. **Servidor.js:** Windows service (NSSM) under `LocalService`, on `127.0.0.1:3000`, with `NODE_ENV=production` and `AD_SIMULADO=false`.
4. **IIS:** serves `logitrans-web/dist` over HTTPS and forwards `/api` to Node.
5. **Windows Firewall:** only port 443 is allowed from the customer network.

## Repository security

- The real `.env` file is **never** committed: it holds the secrets (JWT, encryption key, database and LDAP passwords). Only `.env.example` is versioned.
- The passwords shown in this README and in `.env.example` are **lab examples only**. Generate new ones on the server.
- Certificates and keys (`*.cer`, `*.pem`, `*.pfx`…) are not committed either.
