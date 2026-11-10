# Documentación técnica

## Sistema automatizado de gestión de solicitudes de soporte técnico

**Materia:** Programación en ambiente cliente servidor — 2do. parcial
**Alumno:** Fernando Medina Cortez
**Docente:** Ing. Alex Ramírez Galindo

---

## 1. Introducción

El sistema automatiza el ciclo completo de una solicitud de soporte técnico: el usuario la captura en
un **Google Form**, la respuesta se guarda en **Google Sheets**, **n8n** la procesa y la envía a una
**API REST** desplegada en **Render**, que la valida y la almacena en **PostgreSQL (Neon)** generando
un **folio único**. Finalmente n8n escribe el folio de vuelta en la hoja y envía un **correo de
confirmación con Gmail**. Un **dashboard** en Google Sheets resume la información con gráficas.

### Objetivos

1. Digitalizar y centralizar la captura de solicitudes de soporte.
2. Garantizar un identificador único (folio) por solicitud.
3. Automatizar el registro, la notificación y el seguimiento sin intervención manual.
4. Ofrecer indicadores visuales (totales, por categoría y por prioridad).

---

## 2. Arquitectura

```
┌──────────────┐     ┌─────────────────┐     ┌───────────┐     ┌──────────────────┐     ┌──────────────┐
│ Google Forms │ ──> │ Google Sheets   │ ──> │    n8n    │ ──> │ API REST (Render)│ ──> │ PostgreSQL   │
│  (captura)   │     │ (respuestas)    │     │ (orquesta)│     │  Node.js/Express │     │   (Neon)     │
└──────────────┘     └─────────────────┘     └─────┬─────┘     └──────────────────┘     └──────────────┘
                                                    │
                            ┌───────────────────────┴───────────────────────┐
                            ▼                                               ▼
                    ┌───────────────┐                              ┌─────────────────┐
                    │ Gmail (aviso) │                              │ Dashboard Sheets│
                    └───────────────┘                              └─────────────────┘
```

**Flujo detallado**

1. El usuario llena el formulario (nombre, correo, teléfono, categoría, prioridad, descripción y ubicación).
2. Google Forms agrega una fila a la hoja de respuestas.
3. n8n se ejecuta cada 2 minutos, lee la hoja y filtra las filas **sin folio**.
4. n8n arma el JSON y hace `POST /api/solicitudes`.
5. La API valida los datos, genera el folio (`SOL-AAAA-NNNN`) y guarda en Neon.
6. n8n escribe en la hoja el folio, el estado, la fecha de registro y la marca de notificado.
7. n8n envía el correo de confirmación con Gmail (con copia al área de soporte).
8. El dashboard se actualiza con fórmulas y gráficas de la misma hoja.

---

## 3. Tecnologías utilizadas

| Capa | Tecnología | Versión |
| --- | --- | --- |
| Captura | Google Forms | — |
| Almacenamiento intermedio / dashboard | Google Sheets | — |
| Orquestación | n8n | 2.43.5 |
| API REST | Node.js + Express | Node 20+, Express 4.21 |
| Base de datos | PostgreSQL en Neon | 18 |
| Despliegue | Render | Web Service (free) |
| Notificaciones | Gmail (OAuth2) | — |

---

## 4. Base de datos (Neon)

La base se organiza en el esquema **`soporte`** para no mezclarse con otros objetos del proyecto Neon.

### 4.1 Tabla `soporte.solicitudes`

| Columna | Tipo | Descripción |
| --- | --- | --- |
| `id` | BIGSERIAL | Llave primaria |
| `folio` | TEXT UNIQUE | Folio generado (`SOL-2026-0001`) |
| `nombre` | TEXT | Nombre del solicitante |
| `correo` | TEXT | Correo electrónico |
| `telefono` | TEXT | Teléfono (opcional) |
| `categoria` | TEXT | Categoría del problema |
| `prioridad` | TEXT | `Baja`, `Media`, `Alta`, `Crítica` |
| `descripcion` | TEXT | Descripción del problema |
| `ubicacion` | TEXT | Ubicación o equipo |
| `estado` | TEXT | `Abierta`, `En proceso`, `Resuelta`, `Cancelada` |
| `origen` | TEXT | Origen del registro (Google Forms) |
| `clave_origen` | TEXT | Clave de idempotencia (`sheet:<id>:<fila>`) |
| `fila_sheet` | INTEGER | Fila en la hoja de respuestas |
| `notificado` | BOOLEAN | Indica si ya se envió el correo |
| `respuesta` | TEXT | Respuesta o solución del técnico |
| `fecha_solicitud` | TIMESTAMPTZ | Fecha de creación |
| `fecha_actualizacion` | TIMESTAMPTZ | Actualizada por trigger |

### 4.2 Generación de folios

```sql
CREATE SEQUENCE soporte.folio_seq;

CREATE FUNCTION soporte.generar_folio() RETURNS TEXT AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('soporte.folio_seq');
  RETURN 'SOL-' || to_char(NOW(), 'YYYY') || '-' || lpad(n::text, 4, '0');
END;
$$ LANGUAGE plpgsql;
```

La secuencia es atómica, por lo que dos solicitudes simultáneas **nunca** reciben el mismo folio.

### 4.3 Idempotencia

Existe un índice único parcial sobre `clave_origen`. La API usa:

```sql
INSERT INTO soporte.solicitudes (...) VALUES (...)
ON CONFLICT (clave_origen) WHERE clave_origen IS NOT NULL DO NOTHING
RETURNING ...
```

Si n8n reintenta la misma fila, la API devuelve el folio existente con `duplicado: true` en lugar de
crear un registro repetido.

### 4.4 Vistas para reportes

| Vista | Contenido |
| --- | --- |
| `soporte.vw_resumen` | Total, abiertas, en proceso, resueltas, prioritarias, últimas 24 h y 7 días |
| `soporte.vw_por_categoria` | Conteo agrupado por categoría |
| `soporte.vw_por_prioridad` | Conteo agrupado por prioridad |
| `soporte.vw_por_estado` | Conteo agrupado por estado |
| `soporte.vw_por_dia` | Conteo por día |

### 4.5 Migración

```bash
npm run db:migrate
```

El script `scripts/migrate.js` ejecuta `db/schema.sql` (creación idempotente con `IF NOT EXISTS`).

---

## 5. API REST

**URL base:** `__API_URL__`

### 5.1 Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado del servicio y conexión a la base |
| POST | `/api/solicitudes` | Registra una solicitud y genera el folio |
| GET | `/api/solicitudes` | Consulta con filtros y paginación |
| GET | `/api/solicitudes/:folio` | Detalle por folio |
| PATCH | `/api/solicitudes/:folio` | Actualiza estado, prioridad, respuesta o notificado |
| GET | `/api/estadisticas` | Datos agregados para el dashboard |
| GET | `/api/catalogos` | Categorías, prioridades y estados permitidos |

### 5.2 Filtros de `GET /api/solicitudes`

`estado`, `categoria`, `prioridad`, `correo`, `folio`, `q` (búsqueda libre), `desde`, `hasta`,
`limit` (máx. 200) y `offset`.

### 5.3 Ejemplos

**Registrar**

```bash
curl -X POST __API_URL__/api/solicitudes \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana López",
    "correo": "ana.lopez@escuela.edu.mx",
    "telefono": "555-100-2000",
    "categoria": "Hardware",
    "prioridad": "Alta",
    "descripcion": "La computadora del laboratorio 3 no enciende.",
    "ubicacion": "Laboratorio 3",
    "clave_origen": "sheet:abc123:2"
  }'
```

```json
{
  "ok": true,
  "data": {
    "folio": "SOL-2026-0001",
    "estado": "Abierta",
    "categoria": "Hardware",
    "prioridad": "Alta",
    "fecha_solicitud": "2026-11-10T22:37:56.162Z",
    "duplicado": false
  }
}
```

**Consultar**

```bash
curl "__API_URL__/api/solicitudes?prioridad=Alta&limit=10"
curl "__API_URL__/api/solicitudes/SOL-2026-0001"
```

**Actualizar**

```bash
curl -X PATCH __API_URL__/api/solicitudes/SOL-2026-0001 \
  -H "Content-Type: application/json" \
  -d '{"estado": "En proceso", "respuesta": "Se revisó el equipo y se reemplazó la fuente."}'
```

**Estadísticas**

```json
{
  "ok": true,
  "data": {
    "total": 12,
    "abiertas": 7,
    "en_proceso": 3,
    "resueltas": 2,
    "prioritarias": 4,
    "por_categoria": [{ "categoria": "Hardware", "total": 5 }],
    "por_prioridad": [{ "prioridad": "Alta", "total": 4 }],
    "por_estado": [{ "estado": "Abierta", "total": 7 }]
  }
}
```

### 5.4 Códigos de error

| Código | Significado |
| --- | --- |
| 400 | Datos inválidos (`VALIDACION`) |
| 404 | Folio inexistente (`NO_ENCONTRADA`) |
| 409 | Conflicto al registrar (`CONFLICTO`) |
| 500 | Error interno |
| 503 | Sin conexión a la base (`/health`) |

Formato de error:

```json
{ "ok": false, "error": { "code": "VALIDACION", "message": "...", "details": { "correo": "..." } } }
```

---

## 6. Google Forms y Google Sheets

### 6.1 Campos del formulario

| # | Pregunta | Tipo | Obligatoria |
| --- | --- | --- | --- |
| 1 | Nombre completo | Respuesta corta | Sí |
| 2 | Correo electrónico | Respuesta corta (validación de correo) | Sí |
| 3 | Teléfono | Respuesta corta | No |
| 4 | Categoría | Lista: Hardware, Software, Redes e Internet, Impresoras, Accesos y contraseñas, Correo institucional, Telefonía, Otro | Sí |
| 5 | Prioridad | Opción múltiple: Baja, Media, Alta, Crítica | Sí |
| 6 | Descripción del problema | Párrafo | Sí |
| 7 | Ubicación / equipo | Respuesta corta | No |

El formulario está **vinculado a una hoja de cálculo** (Respuestas → Vincular a Hojas de cálculo).

### 6.2 Columnas de la hoja de respuestas

`Marca temporal`, `Nombre completo`, `Correo electrónico`, `Teléfono`, `Categoría`, `Prioridad`,
`Descripción del problema`, `Ubicación / equipo` y, agregadas por el sistema, `Folio`, `Estado`,
`Fecha de registro` y `Notificado`.

---

## 7. Automatización con n8n

El workflow se entrega en `n8n/workflow-solicitudes.json` y se importa desde
**n8n → Workflows → Import from File**.

### 7.1 Nodos

| Nodo | Tipo | Función |
| --- | --- | --- |
| Cada 2 minutos | Schedule Trigger | Ejecuta el flujo periódicamente |
| Leer respuestas | Google Sheets | Lee la hoja de respuestas |
| Solo solicitudes nuevas | Filter | Descarta filas ya procesadas (con folio) o incompletas |
| Preparar solicitud | Code | Normaliza campos y arma `clave_origen` |
| Registrar en la API | HTTP Request | `POST /api/solicitudes` con reintentos (3 intentos) |
| Guardar folio en la hoja | Google Sheets | Escribe folio, estado, fecha y notificado |
| Notificar por Gmail | Gmail | Envía el correo de confirmación con copia a soporte |

### 7.2 Credenciales

- **Google Sheets OAuth2** — lectura y escritura de la hoja.
- **Gmail OAuth2** — envío de notificaciones.

### 7.3 Manejo de errores

- El nodo HTTP reintenta 3 veces con 2 segundos de espera.
- Si la API falla, la fila **no** se marca con folio y se reintenta en la siguiente ejecución.
- `clave_origen` garantiza que un reintento no duplique registros.

---

## 8. Dashboard

En la misma hoja de cálculo se agrega la pestaña **Dashboard**, con:

- **Total de solicitudes** (conteo general).
- **Solicitudes abiertas / en proceso / resueltas**.
- **Tabla y gráfica de barras por categoría**.
- **Tabla y gráfica de pastel por prioridad**.
- **Solicitudes por día** (últimos 14 días).

Las cifras se calculan con fórmulas `COUNTIF`/`COUNTA` sobre la pestaña `Respuestas`, por lo que se
actualizan automáticamente con cada respuesta nueva.

---

## 9. Despliegue

### 9.1 Neon

1. Crear el proyecto en <https://console.neon.tech>.
2. Copiar la cadena de conexión (pooler, `sslmode=require`).
3. Ejecutar `npm run db:migrate` con esa cadena en `DATABASE_URL`.

### 9.2 Render

1. Repositorio en GitHub con el código (`src/`, `db/`, `package.json`, etc.).
2. **New → Web Service**, runtime **Node**.
3. Build: `npm ci` · Start: `npm start` · Health check: `/health`.
4. Variables: `DATABASE_URL` (Neon) y `DB_SSL=true`.
5. El archivo `render.yaml` permite desplegar como Blueprint.

### 9.3 n8n

1. Importar `n8n/workflow-solicitudes.json`.
2. Configurar la hoja de respuestas y la URL de la API.
3. Asignar las credenciales de Google Sheets y Gmail.
4. Activar el workflow.

---

## 10. Pruebas realizadas

| Prueba | Resultado |
| --- | --- |
| `GET /health` contra Neon | `200` — base `neondb` conectada |
| `POST /api/solicitudes` | `201` — folio `SOL-2026-0004` |
| `POST` repetido con la misma `clave_origen` | `200` — `duplicado: true`, mismo folio |
| `GET /api/solicitudes?prioridad=Alta` | Lista filtrada correctamente |
| `GET /api/estadisticas` | Totales y agrupaciones correctas |
| `PATCH /api/solicitudes/:folio` | Actualiza estado y `fecha_actualizacion` |
| Workflow n8n con una respuesta real | Folio escrito en la hoja y correo enviado |

---

## 11. Estructura del proyecto

```
.
├── src/
│   ├── index.js
│   ├── db.js
│   ├── routes/solicitudes.js
│   └── lib/validate.js
├── db/schema.sql
├── scripts/migrate.js
├── n8n/workflow-solicitudes.json
├── docs/documentacion-tecnica.md
├── Dockerfile
├── render.yaml
├── package.json
└── README.md
```

---

## 12. Conclusiones

- La separación **captura (Forms) → orquestación (n8n) → lógica de negocio (API) → persistencia (Neon)**
  facilita mantener y escalar cada parte por separado.
- El folio generado en la base garantiza unicidad y trazabilidad incluso con ejecuciones simultáneas.
- La idempotencia por `clave_origen` evita duplicados ante reintentos de la automatización.
- El dashboard con fórmulas se mantiene actualizado sin procesos adicionales.

### Trabajo futuro

- Autenticación con API Key o JWT para los endpoints de escritura.
- Panel web propio (fuera de Sheets) consumiendo `/api/estadisticas`.
- Notificaciones por WhatsApp o Telegram.
- Tiempos de atención (SLA) y encuestas de satisfacción.
