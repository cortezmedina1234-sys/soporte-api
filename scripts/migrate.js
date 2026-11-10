'use strict';

/**
 * Aplica db/schema.sql contra la base configurada en DATABASE_URL.
 * Uso: npm run db:migrate
 */
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/db');

(async () => {
  const archivo = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(archivo, 'utf8');
  const client = await pool.connect();
  try {
    console.log('[migrate] Aplicando esquema...');
    await client.query(sql);
    console.log('[migrate] Esquema aplicado correctamente.');
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error('[migrate] Error:', err.message);
  process.exit(1);
});
