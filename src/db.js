'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[db] Falta la variable de entorno DATABASE_URL');
}

// Neon exige SSL. En local se puede desactivar con DB_SSL=false
const ssl = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString,
  ssl,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (err) => {
  console.error('[db] Error inesperado en el pool:', err.message);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - start;
  if (ms > 1500) console.warn(`[db] Consulta lenta (${ms} ms): ${text.slice(0, 80)}`);
  return res;
}

module.exports = { pool, query };
