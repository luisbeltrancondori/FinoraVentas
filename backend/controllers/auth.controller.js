const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { pool } = require('../config/db');
const { ApiError, requireUuid } = require('../utils/http');
const { effectivePermissions, loadUser } = require('../utils/auth');

// Hash dummy generado en arranque para mantener el patrón anti-timing-attack
// en el login (SEC-12): evita que el hash fijo en el repo sea un oráculo.
let _dummyHash = null;
(async () => {
  _dummyHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
})();

const MIN_PASSWORD_LENGTH = 12;
const DEFAULT_SESSION_DURATION = 8 * 60 * 60 * 1000;
const REMEMBERED_SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    permissions: user.permissions || {},
    permisos: effectivePermissions(user.role, user.permissions),
    negocios: user.business_ids,
  };
}

async function status(_req, res) {
  const result = await pool.query('SELECT EXISTS (SELECT 1 FROM pos_users) AS configured');
  res.json({ needs_setup: !result.rows[0].configured });
}

function validateCredentials(email, password, name) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
    throw new ApiError(400, 'Ingresa un correo electrónico válido.');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new ApiError(400, `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y 128 caracteres.`);
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 150)) {
    throw new ApiError(400, 'El nombre debe tener entre 1 y 150 caracteres.');
  }
}

async function setup(req, res) {
  const { email, password, nombre } = req.body;
  validateCredentials(email, password, nombre);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pos-initial-admin')::bigint)");
    const userCount = await client.query('SELECT COUNT(*)::int AS count FROM pos_users');
    if (userCount.rows[0].count > 0) throw new ApiError(409, 'El administrador inicial ya fue configurado.');
    const business = await client.query('SELECT id FROM negocios ORDER BY creado_en, id LIMIT 1');
    if (!business.rowCount) throw new ApiError(503, 'Primero registra una sucursal en la base de datos.');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await client.query(
      `INSERT INTO pos_users (email, nombre, password_hash, role)
       VALUES ($1, $2, $3, 'administrador')
       RETURNING id, email, nombre, role, permissions`,
      [email.trim().toLowerCase(), nombre.trim(), passwordHash],
    );
    const businesses = await client.query('SELECT id FROM negocios');
    for (const row of businesses.rows) {
      await client.query(
        'INSERT INTO pos_user_negocios (usuario_id, negocio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.rows[0].id, row.id],
      );
    }
    await client.query('COMMIT');

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.rows[0].id;
    req.session.activeBusinessId = business.rows[0].id;
    const createdUser = await loadUser(user.rows[0].id);
    res.status(201).json({ user: publicUser(createdUser) });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('No se pudo revertir la configuración inicial:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function login(req, res) {
  const { email, password, remember_me: rememberMe } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new ApiError(400, 'Correo y contraseña son obligatorios.');
  }
  const result = await pool.query(
    `SELECT id, password_hash FROM pos_users
      WHERE LOWER(email) = LOWER($1) AND activo = TRUE`,
    [email.trim()],
  );
  const matches = result.rowCount
    ? await bcrypt.compare(password, result.rows[0].password_hash)
    : await bcrypt.compare(password, _dummyHash || await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12));
  if (!result.rowCount || !matches) throw new ApiError(401, 'Correo o contraseña incorrectos.');

  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
  req.session.userId = result.rows[0].id;
  req.session.cookie.maxAge = rememberMe === true
    ? REMEMBERED_SESSION_DURATION
    : DEFAULT_SESSION_DURATION;
  const user = await loadUser(req.session.userId);
  req.session.activeBusinessId = user.business_ids[0] || null;
  res.json({ user: publicUser(user) });
}

async function me(req, res) {
  const businesses = await pool.query(
    `SELECT n.id, n.nombre, n.nit, n.direccion, n.telefono, n.moneda
       FROM negocios n JOIN pos_user_negocios un ON un.negocio_id = n.id
      WHERE un.usuario_id = $1 ORDER BY n.nombre`,
    [req.user.id],
  );
  res.json({
    user: publicUser(req.user),
    active_business_id: req.session.activeBusinessId || req.user.business_ids[0] || null,
    negocios: businesses.rows,
  });
}

async function switchBusiness(req, res) {
  const businessId = requireUuid(req.body.negocio_id, 'negocio_id');
  if (!req.user.business_ids.includes(businessId)) {
    throw new ApiError(403, 'No tienes acceso a esta sucursal.');
  }
  req.session.activeBusinessId = businessId;
  res.json({ active_business_id: businessId });
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('pos.sid');
    return res.json({ ok: true });
  });
}

module.exports = { login, logout, me, setup, status, switchBusiness };
