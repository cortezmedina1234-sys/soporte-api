# Base de datos — Neon (proyecto del parcial)

**Servidor:** PostgreSQL 18.6 (ac70818)
**Base:** `neondb` · **Usuario:** `neondb_owner`
**Proyecto:** `proyecto segundo corte` (`wandering-waterfall-56332798`)
**Rama:** `production` (`br-crimson-hat-bdflz944`) · **Región:** AWS US East 2 (Ohio)
**Endpoint:** `ep-super-cake-bdm9ovcp-pooler.c-8.us-east-2.aws.neon.tech`

## Objetos del esquema `soporte`

| Objeto | Tipo |
| --- | --- |
| `solicitudes` | TABLA |
| `vw_por_categoria` | VISTA |
| `vw_por_dia` | VISTA |
| `vw_por_estado` | VISTA |
| `vw_por_prioridad` | VISTA |
| `vw_resumen` | VISTA |

## Estructura de `soporte.solicitudes`

| Columna | Tipo | Nulo | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | NO | `nextval('soporte.solicitudes_id_seq'::regclass)` |
| `folio` | `text` | NO | — |
| `nombre` | `text` | NO | — |
| `correo` | `text` | NO | — |
| `telefono` | `text` | YES | — |
| `categoria` | `text` | NO | — |
| `prioridad` | `text` | NO | `'Media'::text` |
| `descripcion` | `text` | NO | — |
| `ubicacion` | `text` | YES | — |
| `estado` | `text` | NO | `'Abierta'::text` |
| `origen` | `text` | NO | `'Google Forms'::text` |
| `clave_origen` | `text` | YES | — |
| `fila_sheet` | `integer` | YES | — |
| `notificado` | `boolean` | NO | `false` |
| `respuesta` | `text` | YES | — |
| `fecha_solicitud` | `timestamp with time zone` | NO | `now()` |
| `fecha_actualizacion` | `timestamp with time zone` | NO | `now()` |

## Datos: 5 solicitudes (secuencia de folios en `13`)

| Folio | Nombre | Correo | Categoría | Prioridad | Estado | Fecha |
| --- | --- | --- | --- | --- | --- | --- |
| SOL-2026-0008 | Fernando Medina Cortez | cortez.medina1234@gmail.com | Hardware | Alta | Abierta | 2026-11-11 13:24 |
| SOL-2026-0009 | Sofia Herrera | sofia.herrera@escuela.edu.mx | Software | Media | Abierta | 2026-11-11 13:32 |
| SOL-2026-0010 | Diego Fuentes | diego.fuentes@escuela.edu.mx | Redes e Internet | Crítica | Abierta | 2026-11-11 13:34 |
| SOL-2026-0011 | Camila Ruiz | camila.ruiz@escuela.edu.mx | Impresoras | Baja | Abierta | 2026-11-11 13:36 |
| SOL-2026-0012 | Jorge Salinas | jorge.salinas@escuela.edu.mx | Accesos y contraseñas | Alta | Abierta | 2026-11-11 13:38 |

## Vistas (resultado actual)

### `vw_resumen`

| total | abiertas | en_proceso | resueltas | canceladas | prioritarias | ultimas_24h | ultimos_7d |
|---|---|---|---|---|---|---|---|
| 5 | 5 | 0 | 0 | 0 | 3 | 5 | 5 |

### `vw_por_categoria`

| categoria | total |
|---|---|
| Accesos y contraseñas | 1 |
| Hardware | 1 |
| Impresoras | 1 |
| Redes e Internet | 1 |
| Software | 1 |

### `vw_por_prioridad`

| prioridad | total |
|---|---|
| Crítica | 1 |
| Alta | 2 |
| Media | 1 |
| Baja | 1 |

### `vw_por_estado`

| estado | total |
|---|---|
| Abierta | 5 |

### `vw_por_dia`

| dia | total |
|---|---|
| 2026-11-11 | 5 |
