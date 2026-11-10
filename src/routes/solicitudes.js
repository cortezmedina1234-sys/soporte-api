'use strict';

const express = require('express');
const { query } = require('../db');
const v = require('../lib/validate');

const router = express.Router();

const COLUMNAS = `id, folio, nombre, correo, telefono, categoria, prioridad, descripcion,
                  ubicacion, estado, origen, clave_origen, fila_sheet, notificado, respuesta,
                  fecha_solicitud, fecha_actualizacion`;

function fail(res, status, code, message, details) {
  return res.status(status).json({
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}

function mapSolicitud(row) {
  return {
    id: Number(row.id),
    folio: row.folio,
    nombre: row.nombre,
    correo: row.correo,
    telefono: row.telefono,
    categoria: row.categoria,
    prioridad: row.prioridad,
    descripcion: row.descripcion,
    ubicacion: row.ubicacion,
    estado: row.estado,
    origen: row.origen,
    notificado: row.notificado,
    respuesta: row.respuesta,
    fecha_solicitud: row.fecha_solicitud,
    fecha_actualizacion: row.fecha_actualizacion,
  };
}

/* ---------------------------------------------------------------- */
/* POST /api/solicitudes  -> registra una solicitud y genera folio   */
/* ---------------------------------------------------------------- */
router.post('/solicitudes', async (req, res, next) => {
  try {
    const body = req.body || {};

    const nombre = v.clean(v.pick(body, 'nombre', 'Nombre', 'Nombre completo', 'name'), 150);
    const correo = v.normalizeEmail(
      v.pick(body, 'correo', 'Correo electrónico', 'Correo electronico', 'Correo', 'email')
    );
    const telefono = v.clean(v.pick(body, 'telefono', 'Teléfono', 'Telefono', 'phone'), 40);
    const categoria = v.normalizeCategoria(
      v.pick(body, 'categoria', 'Categoría', 'Categoria', 'Categoría de la solicitud', 'category')
    );
    const prioridad = v.normalizePrioridad(v.pick(body, 'prioridad', 'Prioridad', 'priority'));
    const descripcion = v.cleanMultiline(
      v.pick(body, 'descripcion', 'Descripción', 'Descripcion', 'Descripción del problema', 'description'),
      5000
    );
    const ubicacion = v.clean(v.pick(body, 'ubicacion', 'Ubicación', 'Ubicacion', 'Ubicación / equipo', 'location'), 200);
    const origen = v.clean(v.pick(body, 'origen', 'source'), 60) || 'Google Forms';
    const claveOrigen = v.clean(v.pick(body, 'clave_origen', 'claveOrigen', 'source_key'), 200);
    const filaSheetRaw = v.pick(body, 'fila_sheet', 'filaSheet', 'row_number');
    const filaSheet = filaSheetRaw !== null && Number.isFinite(Number(filaSheetRaw)) ? Number(filaSheetRaw) : null;

    const errors = {};
    if (!nombre) errors.nombre = 'El nombre es obligatorio.';
    if (!correo) errors.correo = 'El correo es obligatorio.';
    else if (!v.isEmail(correo)) errors.correo = 'El correo no tiene un formato valido.';
    if (!categoria) errors.categoria = 'La categoria es obligatoria.';
    if (!prioridad) errors.prioridad = `La prioridad debe ser una de: ${v.PRIORIDADES.join(', ')}.`;
    if (!descripcion) errors.descripcion = 'La descripcion es obligatoria.';

    if (Object.keys(errors).length > 0) {
      return fail(res, 400, 'VALIDACION', 'Los datos de la solicitud no son validos.', errors);
    }

    const insertSql = `
      INSERT INTO soporte.solicitudes
        (folio, nombre, correo, telefono, categoria, prioridad, descripcion,
         ubicacion, origen, clave_origen, fila_sheet)
      VALUES (soporte.generar_folio(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (clave_origen) WHERE clave_origen IS NOT NULL DO NOTHING
      RETURNING ${COLUMNAS}`;

    const params = [nombre, correo, telefono, categoria, prioridad, descripcion, ubicacion, origen, claveOrigen, filaSheet];
    const { rows } = await query(insertSql, params);

    if (rows.length > 0) {
      return res.status(201).json({
        ok: true,
        data: { ...mapSolicitud(rows[0]), duplicado: false },
      });
    }

    // Ya existia una solicitud con la misma clave de origen (reintento de n8n)
    const existente = await query(
      `SELECT ${COLUMNAS} FROM soporte.solicitudes WHERE clave_origen = $1 LIMIT 1`,
      [claveOrigen]
    );

    if (existente.rows.length === 0) {
      return fail(res, 409, 'CONFLICTO', 'No se pudo registrar la solicitud.');
    }

    return res.status(200).json({
      ok: true,
      data: { ...mapSolicitud(existente.rows[0]), duplicado: true },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- */
/* GET /api/solicitudes  -> consulta con filtros y paginacion        */
/* ---------------------------------------------------------------- */
router.get('/solicitudes', async (req, res, next) => {
  try {
    const where = [];
    const params = [];

    const estado = v.normalizeEstado(req.query.estado);
    if (req.query.estado && !estado) {
      return fail(res, 400, 'VALIDACION', `Estado invalido. Use: ${v.ESTADOS.join(', ')}.`);
    }
    if (estado) {
      params.push(estado);
      where.push(`estado = $${params.length}`);
    }

    const prioridad = v.normalizePrioridad(req.query.prioridad);
    if (req.query.prioridad && !prioridad) {
      return fail(res, 400, 'VALIDACION', `Prioridad invalida. Use: ${v.PRIORIDADES.join(', ')}.`);
    }
    if (prioridad) {
      params.push(prioridad);
      where.push(`prioridad = $${params.length}`);
    }

    const categoria = v.normalizeCategoria(req.query.categoria);
    if (categoria) {
      params.push(categoria);
      where.push(`categoria = $${params.length}`);
    }

    const correo = v.normalizeEmail(req.query.correo);
    if (correo) {
      params.push(correo);
      where.push(`lower(correo) = $${params.length}`);
    }

    const folio = v.clean(req.query.folio, 40);
    if (folio) {
      params.push(`%${folio}%`);
      where.push(`folio ILIKE $${params.length}`);
    }

    const q = v.clean(req.query.q, 120);
    if (q) {
      params.push(`%${q}%`);
      where.push(`(nombre ILIKE $${params.length} OR correo ILIKE $${params.length} OR descripcion ILIKE $${params.length})`);
    }

    const desde = v.clean(req.query.desde, 40);
    if (desde) {
      params.push(desde);
      where.push(`fecha_solicitud >= $${params.length}::timestamptz`);
    }

    const hasta = v.clean(req.query.hasta, 40);
    if (hasta) {
      params.push(hasta);
      where.push(`fecha_solicitud <= $${params.length}::timestamptz`);
    }

    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

    params.push(limit, offset);
    const sql = `
      SELECT ${COLUMNAS}, COUNT(*) OVER() AS total
      FROM soporte.solicitudes
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY fecha_solicitud DESC, id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await query(sql, params);
    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    return res.json({
      ok: true,
      total,
      limit,
      offset,
      data: rows.map(mapSolicitud),
    });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- */
/* GET /api/solicitudes/:folio                                       */
/* ---------------------------------------------------------------- */
router.get('/solicitudes/:folio', async (req, res, next) => {
  try {
    const folio = v.clean(req.params.folio, 40);
    const { rows } = await query(
      `SELECT ${COLUMNAS} FROM soporte.solicitudes WHERE folio = $1 LIMIT 1`,
      [folio]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'NO_ENCONTRADA', `No existe una solicitud con folio ${folio}.`);
    }
    return res.json({ ok: true, data: mapSolicitud(rows[0]) });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- */
/* PATCH /api/solicitudes/:folio  -> cambia estado / respuesta       */
/* ---------------------------------------------------------------- */
router.patch('/solicitudes/:folio', async (req, res, next) => {
  try {
    const folio = v.clean(req.params.folio, 40);
    const body = req.body || {};

    const sets = [];
    const params = [];

    if (body.estado !== undefined) {
      const estado = v.normalizeEstado(body.estado);
      if (!estado) return fail(res, 400, 'VALIDACION', `Estado invalido. Use: ${v.ESTADOS.join(', ')}.`);
      params.push(estado);
      sets.push(`estado = $${params.length}`);
    }

    if (body.prioridad !== undefined) {
      const prioridad = v.normalizePrioridad(body.prioridad);
      if (!prioridad) return fail(res, 400, 'VALIDACION', `Prioridad invalida. Use: ${v.PRIORIDADES.join(', ')}.`);
      params.push(prioridad);
      sets.push(`prioridad = $${params.length}`);
    }

    if (body.respuesta !== undefined) {
      params.push(v.cleanMultiline(body.respuesta, 5000));
      sets.push(`respuesta = $${params.length}`);
    }

    if (body.notificado !== undefined) {
      params.push(Boolean(body.notificado));
      sets.push(`notificado = $${params.length}`);
    }

    if (sets.length === 0) {
      return fail(res, 400, 'SIN_CAMBIOS', 'No se enviaron campos para actualizar (estado, prioridad, respuesta, notificado).');
    }

    params.push(folio);
    const { rows } = await query(
      `UPDATE soporte.solicitudes SET ${sets.join(', ')}
       WHERE folio = $${params.length}
       RETURNING ${COLUMNAS}`,
      params
    );

    if (rows.length === 0) {
      return fail(res, 404, 'NO_ENCONTRADA', `No existe una solicitud con folio ${folio}.`);
    }

    return res.json({ ok: true, data: mapSolicitud(rows[0]) });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- */
/* GET /api/estadisticas  -> datos para el dashboard                 */
/* ---------------------------------------------------------------- */
router.get('/estadisticas', async (req, res, next) => {
  try {
    const [resumen, porCategoria, porPrioridad, porEstado, porDia, recientes] = await Promise.all([
      query('SELECT * FROM soporte.vw_resumen'),
      query('SELECT * FROM soporte.vw_por_categoria'),
      query('SELECT * FROM soporte.vw_por_prioridad'),
      query('SELECT * FROM soporte.vw_por_estado'),
      query('SELECT * FROM soporte.vw_por_dia ORDER BY dia DESC LIMIT 30'),
      query(
        `SELECT id, folio, nombre, correo, categoria, prioridad, estado, fecha_solicitud
         FROM soporte.solicitudes ORDER BY fecha_solicitud DESC LIMIT 10`
      ),
    ]);

    const r = resumen.rows[0] || {};

    return res.json({
      ok: true,
      data: {
        total: Number(r.total || 0),
        abiertas: Number(r.abiertas || 0),
        en_proceso: Number(r.en_proceso || 0),
        resueltas: Number(r.resueltas || 0),
        canceladas: Number(r.canceladas || 0),
        prioritarias: Number(r.prioritarias || 0),
        ultimas_24h: Number(r.ultimas_24h || 0),
        ultimos_7d: Number(r.ultimos_7d || 0),
        por_categoria: porCategoria.rows.map((x) => ({ categoria: x.categoria, total: Number(x.total) })),
        por_prioridad: porPrioridad.rows.map((x) => ({ prioridad: x.prioridad, total: Number(x.total) })),
        por_estado: porEstado.rows.map((x) => ({ estado: x.estado, total: Number(x.total) })),
        por_dia: porDia.rows.map((x) => ({ dia: x.dia, total: Number(x.total) })),
        recientes: recientes.rows.map(mapSolicitud),
        generado_en: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- */
/* GET /api/catalogos  -> valores permitidos                         */
/* ---------------------------------------------------------------- */
router.get('/catalogos', (_req, res) => {
  res.json({
    ok: true,
    data: {
      categorias: v.CATEGORIAS,
      prioridades: v.PRIORIDADES,
      estados: v.ESTADOS,
    },
  });
});

module.exports = router;
