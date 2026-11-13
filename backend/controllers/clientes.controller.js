const { pool } = require('../config/db');
const { ApiError, getNegocioId, rollback } = require('../utils/http');

async function list(req, res) {
  const negocioId = await getNegocioId(req);
  const search = String(req.query.search || '').trim();
  if (search.length > 100) throw new ApiError(400, 'La búsqueda no puede superar 100 caracteres.');
  const limit = req.query.limit === undefined ? null : Number(req.query.limit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
    throw new ApiError(400, 'limit debe ser un número entero entre 1 y 1000.');
  }
  const limitClause = limit === null ? '' : 'LIMIT $3';
  const result = await pool.query(
    `SELECT id, nombre_completo, nombre_completo AS nombre, telefono, nit_ci, email,
            direccion, fecha_registro
       FROM clientes
      WHERE negocio_id = $1
        AND ($2 = '' OR nombre_completo ILIKE '%' || $2 || '%'
             OR COALESCE(telefono, '') ILIKE '%' || $2 || '%'
             OR COALESCE(nit_ci, '') ILIKE '%' || $2 || '%')
      ORDER BY nombre_completo ${limitClause}`,
    limit === null ? [negocioId, search] : [negocioId, search, limit],
  );
  res.json(result.rows);
}

async function detail(req, res) {
  const negocioId = await getNegocioId(req);
  const customerId = Number(req.params.id);
  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new ApiError(400, 'cliente_id debe ser un identificador válido.');
  }
  const result = await pool.query(
    `SELECT id, nombre_completo, nombre_completo AS nombre, nit_ci, telefono, email,
            direccion, fecha_registro
       FROM clientes
      WHERE id = $1 AND negocio_id = $2`,
    [customerId, negocioId],
  );
  if (!result.rowCount) throw new ApiError(404, 'El cliente solicitado no existe.');
  res.json(result.rows[0]);
}

function readCustomer(body = {}) {
  const rawName = body.nombre_completo ?? body.nombre;
  const nombre = typeof rawName === 'string' ? rawName.trim() : '';
  const nitCi = typeof body.nit_ci === 'string' ? body.nit_ci.trim() : '';
  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const direccion = typeof body.direccion === 'string' ? body.direccion.trim() : '';
  if (!nombre || nombre.length > 150) {
    throw new ApiError(400, 'El nombre completo es obligatorio y admite hasta 150 caracteres.');
  }
  if (nitCi.length > 50 || telefono.length > 50) {
    throw new ApiError(400, 'El NIT/CI y teléfono admiten hasta 50 caracteres.');
  }
  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new ApiError(400, 'Ingresa un correo electrónico válido de hasta 254 caracteres.');
  }
  if (direccion.length > 1000) throw new ApiError(400, 'La dirección no puede superar 1000 caracteres.');
  return { nombre, nitCi, telefono, email, direccion };
}

async function ensureUniqueDocument(negocioId, nitCi, excludeId = null) {
  if (!nitCi) return;
  const result = await pool.query(
    `SELECT 1 FROM clientes
      WHERE negocio_id = $1
        AND LOWER(BTRIM(nit_ci)) = LOWER(BTRIM($2))
        AND ($3::integer IS NULL OR id <> $3)
      LIMIT 1`,
    [negocioId, nitCi, excludeId],
  );
  if (result.rowCount) throw new ApiError(409, 'Ya existe un cliente con ese NIT/CI en esta sucursal.');
}

async function create(req, res) {
  const negocioId = await getNegocioId(req);
  const { nombre, nitCi, telefono, email, direccion } = readCustomer(req.body || {});
  await ensureUniqueDocument(negocioId, nitCi);

  const result = await pool.query(
    `INSERT INTO clientes
       (negocio_id, nombre, nombre_completo, telefono, nit_ci, email, direccion)
     VALUES ($1, $2, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''))
     RETURNING id, nombre_completo, nombre_completo AS nombre, telefono, nit_ci, email, direccion, fecha_registro`,
    [negocioId, nombre, telefono, nitCi, email, direccion],
  );
  res.status(201).json(result.rows[0]);
}

async function update(req, res) {
  const negocioId = await getNegocioId(req);
  const customerId = Number(req.params.id);
  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new ApiError(400, 'cliente_id debe ser un identificador válido.');
  }
  const { nombre, nitCi, telefono, email, direccion } = readCustomer(req.body || {});
  await ensureUniqueDocument(negocioId, nitCi, customerId);
  const result = await pool.query(
    `UPDATE clientes
        SET nombre = $1, nombre_completo = $1, nit_ci = NULLIF($2, ''),
            telefono = NULLIF($3, ''), email = NULLIF($4, ''),
            direccion = NULLIF($5, '')
      WHERE id = $6 AND negocio_id = $7
      RETURNING id, nombre_completo, nombre_completo AS nombre, telefono, nit_ci, email, direccion, fecha_registro`,
    [nombre, nitCi, telefono, email, direccion, customerId, negocioId],
  );
  if (!result.rowCount) throw new ApiError(404, 'El cliente solicitado no existe.');
  res.json(result.rows[0]);
}

async function remove(req, res) {
  const customerId = Number(req.params.id);
  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new ApiError(400, 'cliente_id debe ser un identificador válido.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const existing = await client.query(
      'SELECT id FROM clientes WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [customerId, negocioId],
    );
    if (!existing.rowCount) throw new ApiError(404, 'El cliente solicitado no existe.');
    const sales = await client.query(
      'SELECT 1 FROM ventas WHERE cliente_id = $1 AND negocio_id = $2 LIMIT 1',
      [customerId, negocioId],
    );
    if (sales.rowCount) {
      throw new ApiError(400, 'No se puede eliminar este cliente porque tiene ventas asociadas, incluidas posibles deudas pendientes.');
    }
    await client.query('DELETE FROM clientes WHERE id = $1 AND negocio_id = $2', [customerId, negocioId]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { create, detail, list, remove, update };
