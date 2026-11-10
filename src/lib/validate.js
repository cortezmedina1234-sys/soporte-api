'use strict';

const CATEGORIAS = [
  'Hardware',
  'Software',
  'Redes e Internet',
  'Impresoras',
  'Accesos y contraseñas',
  'Correo institucional',
  'Telefonía',
  'Otro',
];

const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
const ESTADOS = ['Abierta', 'En proceso', 'Resuelta', 'Cancelada'];

const PRIORIDAD_MAP = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
  crítica: 'Crítica',
  critico: 'Crítica',
  crítico: 'Crítica',
  urgente: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  critical: 'Crítica',
};

const ESTADO_MAP = {
  abierta: 'Abierta',
  nuevo: 'Abierta',
  nueva: 'Abierta',
  open: 'Abierta',
  'en proceso': 'En proceso',
  proceso: 'En proceso',
  'en_proceso': 'En proceso',
  'in progress': 'En proceso',
  resuelta: 'Resuelta',
  resuelto: 'Resuelta',
  cerrada: 'Resuelta',
  cerrado: 'Resuelta',
  closed: 'Resuelta',
  cancelada: 'Cancelada',
  cancelado: 'Cancelada',
};

const CATEGORIA_MAP = {
  hardware: 'Hardware',
  equipo: 'Hardware',
  software: 'Software',
  aplicaciones: 'Software',
  redes: 'Redes e Internet',
  'redes e internet': 'Redes e Internet',
  internet: 'Redes e Internet',
  red: 'Redes e Internet',
  impresoras: 'Impresoras',
  impresora: 'Impresoras',
  accesos: 'Accesos y contraseñas',
  'accesos y contraseñas': 'Accesos y contraseñas',
  contrasenas: 'Accesos y contraseñas',
  contraseñas: 'Accesos y contraseñas',
  correo: 'Correo institucional',
  'correo institucional': 'Correo institucional',
  telefonia: 'Telefonía',
  telefonía: 'Telefonía',
  otro: 'Otro',
};

/** Devuelve el primer valor no vacio de la lista de claves. */
function pick(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function clean(value, max = 500) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function cleanMultiline(value, max = 5000) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function normalizeEmail(value) {
  const email = clean(value, 254);
  if (!email) return null;
  return email.toLowerCase();
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function normalizePrioridad(value) {
  const raw = clean(value, 40);
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (PRIORIDAD_MAP[key]) return PRIORIDAD_MAP[key];
  const found = PRIORIDADES.find((p) => p.toLowerCase() === key);
  return found || null;
}

function normalizeEstado(value) {
  const raw = clean(value, 40);
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (ESTADO_MAP[key]) return ESTADO_MAP[key];
  const found = ESTADOS.find((e) => e.toLowerCase() === key);
  return found || null;
}

function normalizeCategoria(value) {
  const raw = clean(value, 80);
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (CATEGORIA_MAP[key]) return CATEGORIA_MAP[key];
  const found = CATEGORIAS.find((c) => c.toLowerCase() === key);
  return found || raw;
}

module.exports = {
  CATEGORIAS,
  PRIORIDADES,
  ESTADOS,
  pick,
  clean,
  cleanMultiline,
  normalizeEmail,
  isEmail,
  normalizePrioridad,
  normalizeEstado,
  normalizeCategoria,
};
