/* =====================================================================
   LogiTrans del Centro · Sistema de Gestión de Envíos
   Script de creación de la base de datos (PostgreSQL 18)
   =====================================================================

   La base de datos corre en el MISMO servidor que la aplicación
   (SRV-LOGI01) y solo escucha en 127.0.0.1:5432: nunca se expone a la red.

   CÓMO EJECUTARLO
   ---------------------------------------------------------------------
   A) En Windows Server (SRV-LOGI01), PowerShell como administrador:

      1. Instalar PostgreSQL 18: en Server Core sigue la fase 7 de
         docs/instalacion-windows-server.md (binarios + initdb + servicio
         con NetworkService). Ahí se define la contraseña de "postgres".

      2. Ejecutar este script (las contraseñas se pasan como variables
         para que nunca queden escritas en el archivo):

         & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 `
             -v app_password="AppLogiTrans-2026.Segura" `
             -v respaldo_password="RespLogiTrans-2026.Segura" `
             -f crear_base_de_datos.sql

      3. Endurecer la configuración (sección 7 de este archivo) y reiniciar
         el servicio:
            Restart-Service postgresql-x64-18

   B) En laboratorio con Docker (Mac / Linux):

      1. Levantar PostgreSQL publicado SOLO en localhost:

         docker run -d --name pg-logitrans \
           -e POSTGRES_PASSWORD="AdminLogiTrans-2026.Segura" \
           -p 127.0.0.1:5432:5432 \
           -v pg-logitrans:/var/lib/postgresql \
           postgres:18

      2. Ejecutar el script:

         docker exec -i pg-logitrans psql -U postgres \
           -v app_password="AppLogiTrans-2026.Segura" \
           -v respaldo_password="RespLogiTrans-2026.Segura" \
           -f - < crear_base_de_datos.sql

      3. Comprobar que la app puede conectarse con su cuenta:

         docker exec -it pg-logitrans psql \
           "postgresql://app_logitrans:AppLogiTrans-2026.Segura@127.0.0.1:5432/logitrans" -c "\dt"

   4. Poner la cadena de conexión en logitrans-api/.env
      (si la contraseña lleva caracteres como # o @, escríbelos codificados: %23, %40):

      DATABASE_URL="postgresql://app_logitrans:AppLogiTrans-2026.Segura@127.0.0.1:5432/logitrans?schema=public"
   ===================================================================== */

\set ON_ERROR_STOP on

/* ---------------------------------------------------------------------
   1. Roles (mínimo privilegio)
   ---------------------------------------------------------------------
   logitrans_admin    : dueño de las tablas. NOLOGIN: nadie entra con él;
                        un administrador lo usa con SET ROLE para cambios
                        de estructura.
   app_logitrans      : cuenta de Servidor.js. Solo lee y escribe datos.
   logitrans_respaldo : solo lectura, para pg_dump.
   --------------------------------------------------------------------- */
CREATE ROLE logitrans_admin NOLOGIN;
CREATE ROLE app_logitrans LOGIN PASSWORD :'app_password' CONNECTION LIMIT 20;
CREATE ROLE logitrans_respaldo LOGIN PASSWORD :'respaldo_password' CONNECTION LIMIT 2;

/* ---------------------------------------------------------------------
   2. Base de datos
   --------------------------------------------------------------------- */
CREATE DATABASE logitrans OWNER logitrans_admin ENCODING 'UTF8' TEMPLATE template0;

REVOKE ALL ON DATABASE logitrans FROM PUBLIC;
GRANT CONNECT ON DATABASE logitrans TO app_logitrans, logitrans_respaldo;

\connect logitrans

-- Nadie más que el dueño puede crear objetos en el esquema
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_logitrans, logitrans_respaldo;

-- Todo lo que sigue queda a nombre de logitrans_admin
SET ROLE logitrans_admin;

/* ---------------------------------------------------------------------
   3. Tablas
   ---------------------------------------------------------------------
   Todas las llaves primarias son UUID versión 7 (uuidv7(), nativo desde
   PostgreSQL 18):
   - No son secuenciales ni adivinables: no revelan cuántos clientes o
     envíos hay y no se pueden enumerar (defensa en profundidad contra IDOR;
     la protección principal sigue siendo la autorización en Servidor.js).
   - Están ordenadas por tiempo, así que el índice de la llave primaria no
     se fragmenta como con UUID aleatorios (v4).
   --------------------------------------------------------------------- */

-- Usuarios externos del portal de clientes
CREATE TABLE clientes (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    razon_social      VARCHAR(150) NOT NULL,
    rfc               VARCHAR(13),
    email             VARCHAR(120) NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash     VARCHAR(100) NOT NULL,                  -- bcrypt costo 12
    totp_secreto      BYTEA,                                  -- AES-256-GCM (IV + tag + datos)
    totp_activo       BOOLEAN      NOT NULL DEFAULT FALSE,
    email_verificado  BOOLEAN      NOT NULL DEFAULT FALSE,
    intentos_fallidos INTEGER      NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    bloqueado_hasta   TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Tokens de un solo uso para verificar el correo (se guarda solo el SHA-256)
CREATE TABLE tokens_verificacion (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    cliente_id  UUID        NOT NULL REFERENCES clientes(id),
    token_hash  CHAR(64)    NOT NULL UNIQUE,
    expira_en   TIMESTAMPTZ NOT NULL,
    usado       BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Copia mínima del empleado de Active Directory (SIN contraseña)
CREATE TABLE empleados (
    id             UUID PRIMARY KEY DEFAULT uuidv7(),
    ad_object_guid UUID         NOT NULL UNIQUE,
    usuario_ad     VARCHAR(20)  NOT NULL,
    nombre         VARCHAR(120) NOT NULL,
    rol            VARCHAR(20)  NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'EMPLEADO', 'CHOFER')),
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso  TIMESTAMPTZ
);

-- Flotilla
CREATE TABLE vehiculos (
    id           UUID PRIMARY KEY DEFAULT uuidv7(),
    placas       VARCHAR(10)   NOT NULL UNIQUE,
    descripcion  VARCHAR(100)  NOT NULL,
    capacidad_kg NUMERIC(10,2) NOT NULL CHECK (capacidad_kg > 0),
    activo       BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Rutas asignadas a chofer y vehículo
CREATE TABLE rutas (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    nombre      VARCHAR(100) NOT NULL,
    fecha       DATE         NOT NULL,
    chofer_id   UUID         NOT NULL REFERENCES empleados(id),
    vehiculo_id UUID         NOT NULL REFERENCES vehiculos(id),
    estado      VARCHAR(20)  NOT NULL DEFAULT 'PLANEADA'
                CHECK (estado IN ('PLANEADA', 'EN_CURSO', 'FINALIZADA')),
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Envíos solicitados por clientes
CREATE TABLE envios (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    folio_rastreo     VARCHAR(16)  NOT NULL UNIQUE,              -- aleatorio, no secuencial
    cliente_id        UUID         NOT NULL REFERENCES clientes(id),
    ruta_id           UUID         REFERENCES rutas(id),
    direccion_origen  VARCHAR(250) NOT NULL,
    direccion_destino VARCHAR(250) NOT NULL,
    descripcion       VARCHAR(250) NOT NULL,
    peso_kg           NUMERIC(8,2) NOT NULL CHECK (peso_kg > 0),
    estado            VARCHAR(20)  NOT NULL DEFAULT 'SOLICITADO'
                      CHECK (estado IN ('SOLICITADO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO')),
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    entregado_en      TIMESTAMPTZ
);

-- Historial de cambios de estado (integridad: quién y cuándo)
CREATE TABLE historial_envio (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    envio_id    UUID         NOT NULL REFERENCES envios(id),
    estado      VARCHAR(20)  NOT NULL
                CHECK (estado IN ('SOLICITADO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO')),
    comentario  VARCHAR(250),
    empleado_id UUID         REFERENCES empleados(id),
    fecha       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Bitácora de auditoría (solo inserción)
CREATE TABLE bitacora (
    id           UUID PRIMARY KEY DEFAULT uuidv7(),
    fecha        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    tipo_usuario VARCHAR(10)  NOT NULL CHECK (tipo_usuario IN ('EMPLEADO', 'CLIENTE', 'ANONIMO')),
    usuario_id   UUID,
    accion       VARCHAR(50)  NOT NULL,
    recurso      VARCHAR(250) NOT NULL,
    ip           VARCHAR(45)  NOT NULL,
    resultado    VARCHAR(10)  NOT NULL CHECK (resultado IN ('EXITO', 'FALLO'))
);

-- Sesiones cerradas o revocadas (se depuran al expirar)
CREATE TABLE tokens_revocados (
    jti        VARCHAR(64) PRIMARY KEY,
    usuario_id UUID        NOT NULL,
    expira_en  TIMESTAMPTZ NOT NULL
);

/* ---------------------------------------------------------------------
   4. Índices
   --------------------------------------------------------------------- */
CREATE INDEX ix_envios_cliente_id        ON envios(cliente_id);
CREATE INDEX ix_envios_ruta_id           ON envios(ruta_id);
CREATE INDEX ix_envios_estado            ON envios(estado);
CREATE INDEX ix_rutas_chofer_id          ON rutas(chofer_id);
CREATE INDEX ix_historial_envio_id       ON historial_envio(envio_id);
CREATE INDEX ix_bitacora_fecha           ON bitacora(fecha DESC);
CREATE INDEX ix_empleados_usuario_ad     ON empleados(usuario_ad);
CREATE INDEX ix_tokens_revocados_expira  ON tokens_revocados(expira_en);

/* ---------------------------------------------------------------------
   5. Bitácora e historial inalterables
   ---------------------------------------------------------------------
   Doble barrera: (a) a la cuenta de la app se le quitan UPDATE y DELETE
   (sección 6) y (b) un trigger rechaza cualquier modificación o borrado,
   incluso si alguien llegara a usar el rol dueño de las tablas.
   --------------------------------------------------------------------- */
CREATE FUNCTION impedir_modificacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo inserción (operación % rechazada)', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER tr_bitacora_inalterable
    BEFORE UPDATE OR DELETE ON bitacora
    FOR EACH ROW EXECUTE FUNCTION impedir_modificacion();
CREATE TRIGGER tr_bitacora_sin_truncate
    BEFORE TRUNCATE ON bitacora
    FOR EACH STATEMENT EXECUTE FUNCTION impedir_modificacion();

CREATE TRIGGER tr_historial_inalterable
    BEFORE UPDATE OR DELETE ON historial_envio
    FOR EACH ROW EXECUTE FUNCTION impedir_modificacion();
CREATE TRIGGER tr_historial_sin_truncate
    BEFORE TRUNCATE ON historial_envio
    FOR EACH STATEMENT EXECUTE FUNCTION impedir_modificacion();

/* ---------------------------------------------------------------------
   6. Permisos de las cuentas
   --------------------------------------------------------------------- */
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_logitrans;
REVOKE UPDATE, DELETE ON bitacora, historial_envio FROM app_logitrans;   -- solo inserción

GRANT SELECT ON ALL TABLES IN SCHEMA public TO logitrans_respaldo;

/* Datos iniciales: catálogo de vehículos */
INSERT INTO vehiculos (placas, descripcion, capacidad_kg) VALUES
    ('GTO-1234', 'Camión Isuzu ELF 400',      4000),
    ('GTO-5678', 'Camioneta Nissan NP300',    1200),
    ('GTO-9012', 'Tractocamión Freightliner', 25000);

RESET ROLE;

-- Límites de la sesión de la app: evita consultas colgadas (disponibilidad)
ALTER ROLE app_logitrans IN DATABASE logitrans SET statement_timeout = '30s';
ALTER ROLE app_logitrans IN DATABASE logitrans SET idle_in_transaction_session_timeout = '60s';

\echo 'Base de datos logitrans creada correctamente.'

/* ---------------------------------------------------------------------
   7. Endurecimiento del servidor (SRV-LOGI01)
   ---------------------------------------------------------------------
   Archivo C:\Program Files\PostgreSQL\18\data\postgresql.conf:

      listen_addresses = 'localhost'          # solo 127.0.0.1 y ::1
      port = 5432
      password_encryption = scram-sha-256
      log_connections = on
      log_disconnections = on
      log_line_prefix = '%m [%p] %u@%d %h '

   Archivo pg_hba.conf (borra las demás líneas "host"):

      # TIPO  BASE        USUARIO             DIRECCIÓN      MÉTODO
      host    logitrans   app_logitrans       127.0.0.1/32   scram-sha-256
      host    logitrans   app_logitrans       ::1/128        scram-sha-256
      host    logitrans   logitrans_respaldo  127.0.0.1/32   scram-sha-256
      host    all         postgres            127.0.0.1/32   scram-sha-256

   Firewall de Windows: bloquear explícitamente el puerto desde la red
   (defensa en profundidad, aunque PostgreSQL ya solo escucha en localhost):

      New-NetFirewallRule -DisplayName "Bloquear PostgreSQL desde la red" `
          -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Block

   Permisos NTFS de la carpeta data: solo la cuenta del servicio
   (NT AUTHORITY\NetworkService) y Administradores.
   --------------------------------------------------------------------- */

/* ---------------------------------------------------------------------
   8. Respaldos (Programador de tareas de Windows)
   ---------------------------------------------------------------------
   La contraseña de logitrans_respaldo va en el archivo pgpass de la
   cuenta que ejecuta la tarea, con permisos NTFS solo para esa cuenta:
      %APPDATA%\postgresql\pgpass.conf
      127.0.0.1:5432:logitrans:logitrans_respaldo:RespLogiTrans-2026.Segura

   Respaldo completo diario (formato personalizado, comprimido):
      "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -U logitrans_respaldo `
          -d logitrans -Fc -f "D:\Respaldos\logitrans_$(Get-Date -f yyyyMMdd_HHmm).dump"

   Registrar la tarea cada 6 horas (PowerShell como administrador):
      $a = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\Scripts\respaldo_logitrans.ps1"
      $t = New-ScheduledTaskTrigger -Once -At 00:00 -RepetitionInterval (New-TimeSpan -Hours 6)
      Register-ScheduledTask -TaskName "Respaldo LogiTrans" -Action $a -Trigger $t -User "svc_respaldo"

   Restaurar (prueba mensual en otra base):
      createdb -h 127.0.0.1 -U postgres logitrans_prueba
      pg_restore -h 127.0.0.1 -U postgres -d logitrans_prueba "D:\Respaldos\logitrans_20261001_0000.dump"
   --------------------------------------------------------------------- */
