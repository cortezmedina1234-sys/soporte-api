-- ============================================================
--  Sistema automatizado de gestion de solicitudes de soporte
--  PostgreSQL (Neon) - esquema "soporte"
--  Ejecutar: psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================

CREATE SCHEMA IF NOT EXISTS soporte;

-- Secuencia global para folios consecutivos
CREATE SEQUENCE IF NOT EXISTS soporte.folio_seq START WITH 1 INCREMENT BY 1;

-- ------------------------------------------------------------
-- Tabla principal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soporte.solicitudes (
  id                  BIGSERIAL PRIMARY KEY,
  folio               TEXT        NOT NULL UNIQUE,
  nombre              TEXT        NOT NULL,
  correo              TEXT        NOT NULL,
  telefono            TEXT,
  categoria           TEXT        NOT NULL,
  prioridad           TEXT        NOT NULL DEFAULT 'Media'
                      CHECK (prioridad IN ('Baja', 'Media', 'Alta', 'Crítica')),
  descripcion         TEXT        NOT NULL,
  ubicacion           TEXT,
  estado              TEXT        NOT NULL DEFAULT 'Abierta'
                      CHECK (estado IN ('Abierta', 'En proceso', 'Resuelta', 'Cancelada')),
  origen              TEXT        NOT NULL DEFAULT 'Google Forms',
  clave_origen        TEXT,                 -- idempotencia: "sheet:<id>:<fila>"
  fila_sheet          INTEGER,              -- fila en la hoja de respuestas
  notificado          BOOLEAN     NOT NULL DEFAULT FALSE,
  respuesta           TEXT,
  fecha_solicitud     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un registro por fila de la hoja (evita duplicados si n8n reintenta)
CREATE UNIQUE INDEX IF NOT EXISTS ux_solicitudes_clave_origen
  ON soporte.solicitudes (clave_origen)
  WHERE clave_origen IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_solicitudes_estado     ON soporte.solicitudes (estado);
CREATE INDEX IF NOT EXISTS ix_solicitudes_categoria  ON soporte.solicitudes (categoria);
CREATE INDEX IF NOT EXISTS ix_solicitudes_prioridad  ON soporte.solicitudes (prioridad);
CREATE INDEX IF NOT EXISTS ix_solicitudes_fecha      ON soporte.solicitudes (fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS ix_solicitudes_correo     ON soporte.solicitudes (lower(correo));

-- ------------------------------------------------------------
-- Generacion de folios:  SOL-2026-0001
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION soporte.generar_folio()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('soporte.folio_seq');
  RETURN 'SOL-' || to_char(NOW(), 'YYYY') || '-' || lpad(n::text, 4, '0');
END;
$$;

-- ------------------------------------------------------------
-- fecha_actualizacion automatica
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION soporte.tocar_fecha_actualizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fecha_actualizacion := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solicitudes_actualizacion ON soporte.solicitudes;
CREATE TRIGGER trg_solicitudes_actualizacion
  BEFORE UPDATE ON soporte.solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION soporte.tocar_fecha_actualizacion();

-- ------------------------------------------------------------
-- Vistas para el dashboard / reportes
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW soporte.vw_resumen AS
SELECT
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE estado = 'Abierta')            AS abiertas,
  COUNT(*) FILTER (WHERE estado = 'En proceso')         AS en_proceso,
  COUNT(*) FILTER (WHERE estado = 'Resuelta')           AS resueltas,
  COUNT(*) FILTER (WHERE estado = 'Cancelada')          AS canceladas,
  COUNT(*) FILTER (WHERE prioridad IN ('Alta', 'Crítica')) AS prioritarias,
  COUNT(*) FILTER (WHERE fecha_solicitud >= NOW() - INTERVAL '24 hours') AS ultimas_24h,
  COUNT(*) FILTER (WHERE fecha_solicitud >= NOW() - INTERVAL '7 days')   AS ultimos_7d
FROM soporte.solicitudes;

CREATE OR REPLACE VIEW soporte.vw_por_categoria AS
SELECT categoria, COUNT(*)::INT AS total
FROM soporte.solicitudes
GROUP BY categoria
ORDER BY total DESC, categoria;

CREATE OR REPLACE VIEW soporte.vw_por_prioridad AS
SELECT prioridad, COUNT(*)::INT AS total
FROM soporte.solicitudes
GROUP BY prioridad
ORDER BY CASE prioridad
           WHEN 'Crítica' THEN 1
           WHEN 'Alta'    THEN 2
           WHEN 'Media'   THEN 3
           WHEN 'Baja'    THEN 4
         END;

CREATE OR REPLACE VIEW soporte.vw_por_estado AS
SELECT estado, COUNT(*)::INT AS total
FROM soporte.solicitudes
GROUP BY estado
ORDER BY total DESC;

CREATE OR REPLACE VIEW soporte.vw_por_dia AS
SELECT date_trunc('day', fecha_solicitud)::date AS dia, COUNT(*)::INT AS total
FROM soporte.solicitudes
GROUP BY 1
ORDER BY 1;

-- ------------------------------------------------------------
-- Datos de ejemplo (opcional, se pueden borrar)
-- ------------------------------------------------------------
INSERT INTO soporte.solicitudes
  (folio, nombre, correo, telefono, categoria, prioridad, descripcion, ubicacion, origen, clave_origen)
VALUES
  (soporte.generar_folio(), 'Ana Lopez', 'ana.lopez@ejemplo.com', '555-100-2000',
   'Hardware', 'Alta', 'La computadora del laboratorio 3 no enciende.', 'Laboratorio 3', 'Demo', 'demo:1'),
  (soporte.generar_folio(), 'Luis Ramirez', 'luis.ramirez@ejemplo.com', NULL,
   'Redes e Internet', 'Crítica', 'Sin conexion a internet en el area administrativa.', 'Administracion', 'Demo', 'demo:2'),
  (soporte.generar_folio(), 'Maria Torres', 'maria.torres@ejemplo.com', '555-300-4000',
   'Impresoras', 'Media', 'La impresora marca error de papel atascado.', 'Coordinacion', 'Demo', 'demo:3')
ON CONFLICT DO NOTHING;
