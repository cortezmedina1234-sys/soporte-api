# Sistema automatizado de gestión de solicitudes de soporte técnico

Proyecto del **2do. parcial — Programación en ambiente cliente servidor**.

El sistema captura solicitudes con **Google Forms**, las almacena en **Google Sheets**, las procesa
con **n8n**, las registra en una **API REST (Node.js + Express)** desplegada en **Render** y las
persiste en **PostgreSQL (Neon)**. Cada solicitud recibe un **folio** y se envía una **notificación
automática por Gmail**. Un **dashboard** en Google Sheets muestra los totales y gráficas.

```
Google Forms  ->  Google Sheets  ->  n8n  ->  API REST (Render)  ->  PostgreSQL (Neon)
                                       |
                                       +-->  Gmail (notificación con folio)
                                       |
                                       +-->  Google Sheets (folio + estado)
                                                |
                                                +-->  Dashboard (gráficas)
```

## Enlaces del proyecto (instancia funcional)

| Recurso | URL |
| --- | --- |
| API REST (Render) | https://soporte-api-1oox.onrender.com |
| Health check | https://soporte-api-1oox.onrender.com/health |
| Repositorio (GitHub) | https://github.com/cortezmedina1234-sys/soporte-api |
| Google Form (responder) | https://docs.google.com/forms/d/e/1FAIpQLSdN0-eA9ZUf063S9MAwIKDnl7BkWIHOk8mGxUx2iMI4A7GJ0g/viewform |
| Google Form (editar) | https://docs.google.com/forms/d/17dgSzPNtKv76yYcpKMxqkip9KuPLi71vo2GQt-rzgSk/edit |
| Hoja de respuestas + Dashboard | https://docs.google.com/spreadsheets/d/1Dlw6NM9jl7WNqjEXgLv3KHmYl5ZWPSCdxzJubgVj3pU/edit#gid=1262206621 |
| Base de datos (Neon) | Proyecto **proyecto segundo corte** (`wandering-waterfall-56332798`), rama `production` (`br-crimson-hat-bdflz944`), endpoint `ep-super-cake-bdm9ovcp-pooler.c-8.us-east-2.aws.neon.tech`, base `neondb`, esquema `soporte` |
| Workflow n8n | http://localhost:5678/workflow/6TYccmWgSj3tAjYx |

## Estructura del repositorio

```
.
├── src/
│   ├── index.js              # Servidor Express, /health y página de inicio
│   ├── db.js                 # Pool de conexiones a Neon
│   ├── routes/solicitudes.js # Endpoints de la API
│   └── lib/validate.js       # Normalización y validación de datos
├── db/
│   └── schema.sql            # Tabla, secuencia de folios, triggers y vistas
├── scripts/
│   └── migrate.js            # Aplica el esquema (npm run db:migrate)
├── n8n/
│   └── workflow-solicitudes.json  # Workflow listo para importar en n8n
├── docs/
│   └── documentacion-tecnica.md
├── Dockerfile
├── render.yaml
└── package.json
```

## Requisitos

- Node.js 20 o superior
- Una base de datos PostgreSQL en [Neon](https://neon.tech)
- n8n (local o en la nube)
- Cuenta de Google con Google Forms, Google Sheets y Gmail

## Puesta en marcha local

```bash
npm install
cp .env.example .env      # coloca tu DATABASE_URL de Neon
npm run db:migrate        # crea la tabla, vistas y datos de ejemplo
npm start                 # http://localhost:3000
```

Comprobar:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/estadisticas
```

## API REST

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado del servicio y de la base de datos |
| POST | `/api/solicitudes` | Registra una solicitud y genera el folio |
| GET | `/api/solicitudes` | Lista con filtros y paginación |
| GET | `/api/solicitudes/:folio` | Detalle de una solicitud |
| PATCH | `/api/solicitudes/:folio` | Actualiza estado, prioridad, respuesta o notificado |
| GET | `/api/estadisticas` | Totales y agrupaciones para el dashboard |
| GET | `/api/catalogos` | Categorías, prioridades y estados permitidos |

### Ejemplo: registrar una solicitud

```bash
curl -X POST https://soporte-api-1oox.onrender.com/api/solicitudes \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana López",
    "correo": "ana.lopez@escuela.edu.mx",
    "telefono": "555-100-2000",
    "categoria": "Hardware",
    "prioridad": "Alta",
    "descripcion": "La computadora del laboratorio 3 no enciende.",
    "ubicacion": "Laboratorio 3"
  }'
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "folio": "SOL-2026-0001",
    "estado": "Abierta",
    "prioridad": "Alta",
    "categoria": "Hardware",
    "fecha_solicitud": "2026-11-10T22:37:56.162Z",
    "duplicado": false
  }
}
```

El campo `clave_origen` hace la operación **idempotente**: si n8n reintenta la misma fila, la API
devuelve el folio existente en lugar de crear un duplicado.

## Despliegue en Render

1. Subir el repositorio a GitHub.
2. En Render: **New → Web Service** y seleccionar el repositorio.
3. Runtime **Node**, build `npm ci`, start `npm start`, health check `/health`.
4. Variable de entorno `DATABASE_URL` con la cadena de conexión de Neon y `DB_SSL=true`.
5. (Alternativa) usar el Blueprint con `render.yaml`.

## Documentación

La documentación técnica completa está en [`docs/documentacion-tecnica.md`](docs/documentacion-tecnica.md).
