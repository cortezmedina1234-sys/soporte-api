'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const rutas = require('./routes/solicitudes');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const startedAt = new Date();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Log sencillo de peticiones
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`);
  });
  next();
});

/* ------------------------- Salud ------------------------- */
app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS ahora, current_database() AS db');
    res.json({
      status: 'ok',
      uptime_segundos: Math.round((Date.now() - startedAt.getTime()) / 1000),
      base_de_datos: rows[0].db,
      hora_servidor: rows[0].ahora,
    });
  } catch (err) {
    res.status(503).json({ status: 'error', mensaje: 'Sin conexion a la base de datos', detalle: err.message });
  }
});

/* ------------------------- API --------------------------- */
app.use('/api', rutas);

/* --------------------- Pagina de inicio ------------------ */
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API - Gestion de solicitudes de soporte</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 2.5rem 1.25rem; line-height: 1.6; }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin-bottom: .25rem; }
  p.sub { margin-top: 0; opacity: .7; }
  code { background: rgba(127,127,127,.18); padding: .15rem .4rem; border-radius: .3rem; font-size: .9em; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: .55rem .6rem; border-bottom: 1px solid rgba(127,127,127,.25); vertical-align: top; }
  th { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
  .metodo { font-weight: 700; font-size: .8rem; white-space: nowrap; }
</style>
</head>
<body>
<main>
  <h1>Sistema automatizado de gestion de solicitudes de soporte</h1>
  <p class="sub">API REST &middot; Node.js + Express &middot; PostgreSQL (Neon)</p>
  <p>Servicio en linea. Documentacion interactiva de los endpoints:</p>
  <table>
    <tr><th>Metodo</th><th>Ruta</th><th>Descripcion</th></tr>
    <tr><td class="metodo">GET</td><td><code>/health</code></td><td>Estado del servicio y de la base de datos</td></tr>
    <tr><td class="metodo">POST</td><td><code>/api/solicitudes</code></td><td>Registra una solicitud y genera el folio</td></tr>
    <tr><td class="metodo">GET</td><td><code>/api/solicitudes</code></td><td>Consulta con filtros: estado, categoria, prioridad, correo, folio, q, desde, hasta, limit, offset</td></tr>
    <tr><td class="metodo">GET</td><td><code>/api/solicitudes/:folio</code></td><td>Detalle de una solicitud</td></tr>
    <tr><td class="metodo">PATCH</td><td><code>/api/solicitudes/:folio</code></td><td>Actualiza estado, prioridad, respuesta o notificado</td></tr>
    <tr><td class="metodo">GET</td><td><code>/api/estadisticas</code></td><td>Totales, por categoria, por prioridad y por estado</td></tr>
    <tr><td class="metodo">GET</td><td><code>/api/catalogos</code></td><td>Categorias, prioridades y estados permitidos</td></tr>
  </table>
  <p>Prueba rapida: <a href="/api/estadisticas">/api/estadisticas</a> &middot; <a href="/api/solicitudes">/api/solicitudes</a></p>
</main>
</body>
</html>`);
});

/* --------------------- 404 y errores --------------------- */
app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NO_ENCONTRADO', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: {
      code: err.code || 'ERROR_INTERNO',
      message: status === 500 ? 'Error interno del servidor.' : err.message,
      ...(process.env.NODE_ENV !== 'production' ? { detalle: err.message } : {}),
    },
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] Escuchando en http://0.0.0.0:${PORT}`);
});

async function shutdown(signal) {
  console.log(`[api] ${signal} recibido, cerrando...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
