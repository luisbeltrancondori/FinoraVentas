const { pool } = require('../config/db');
const { ApiError, getNegocioId, requireUuid } = require('../utils/http');

function readName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 100) {
    throw new ApiError(400, 'El nombre de la categoría es obligatorio y admite hasta 100 caracteres.');
  }
  return name;
}

async function list(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT c.id, c.negocio_id, c.nombre,
            COUNT(p.id)::int AS productos
       FROM categorias c
       LEFT JOIN productos p ON p.categoria_id = c.id AND p.negocio_id = c.negocio_id
      WHERE c.negocio_id = $1
      GROUP BY c.id
      ORDER BY c.nombre`,
    [negocioId],
  );
  res.json(result.rows);
}

async function detail(req, res) {
  const negocioId = await getNegocioId(req);
  const categoryId = requireUuid(req.params.id, 'categoria_id');
  const result = await pool.query(
    `SELECT c.id, c.negocio_id, c.nombre,
            COUNT(p.id)::int AS productos
       FROM categorias c
       LEFT JOIN productos p ON p.categoria_id = c.id AND p.negocio_id = c.negocio_id
      WHERE c.id = $1 AND c.negocio_id = $2
      GROUP BY c.id`,
    [categoryId, negocioId],
  );
  if (!result.rowCount) throw new ApiError(404, 'La categoría no existe en este negocio.');
  res.json(result.rows[0]);
}

async function create(req, res) {
  const negocioId = await getNegocioId(req);
  const name = readName(req.body?.nombre);
  const result = await pool.query(
    'INSERT INTO categorias (negocio_id, nombre) VALUES ($1, $2) RETURNING id, negocio_id, nombre',
    [negocioId, name],
  );
  res.status(201).json(result.rows[0]);
}

async function update(req, res) {
  const negocioId = await getNegocioId(req);
  const categoryId = requireUuid(req.params.id, 'categoria_id');
  const name = readName(req.body?.nombre);
  const result = await pool.query(
    `UPDATE categorias SET nombre = $1
      WHERE id = $2 AND negocio_id = $3
      RETURNING id, negocio_id, nombre`,
    [name, categoryId, negocioId],
  );
  if (!result.rowCount) throw new ApiError(404, 'La categoría no existe en este negocio.');
  res.json(result.rows[0]);
}

async function remove(req, res) {
  const negocioId = await getNegocioId(req);
  const categoryId = requireUuid(req.params.id, 'categoria_id');
  const category = await pool.query(
    'SELECT id FROM categorias WHERE id = $1 AND negocio_id = $2',
    [categoryId, negocioId],
  );
  if (!category.rowCount) throw new ApiError(404, 'La categoría no existe en este negocio.');
  const products = await pool.query(
    'SELECT 1 FROM productos WHERE categoria_id = $1 AND negocio_id = $2 LIMIT 1',
    [categoryId, negocioId],
  );
  if (products.rowCount) {
    throw new ApiError(400, 'No se puede eliminar porque tiene productos asociados');
  }
  await pool.query(
    'DELETE FROM categorias WHERE id = $1 AND negocio_id = $2',
    [categoryId, negocioId],
  );
  res.status(204).end();
}

module.exports = { create, detail, list, remove, update };
