const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/db');
const { ApiError, getNegocioId, requireNumber, requireUuid } = require('../utils/http');

const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
const imageTypes = {
  'image/jpeg': { extension: 'jpg', signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', signature: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', signature: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
};

async function storeImage(file) {
  if (!file) return null;
  const imageType = imageTypes[file.mimetype];
  if (!imageType || !imageType.signature(file.buffer)) {
    throw new ApiError(400, 'El contenido del archivo no corresponde a una imagen JPG, PNG o WebP válida.');
  }
  const filename = `${crypto.randomUUID()}.${imageType.extension}`;
  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadDirectory, filename), file.buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}

async function removeStoredImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  const filename = imageUrl.slice('/uploads/'.length);
  if (path.basename(filename) !== filename) return;
  await fs.rm(path.join(uploadDirectory, filename), { force: true });
}

function validateImageUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) {
    throw new ApiError(400, 'La URL de imagen no puede superar 2000 caracteres.');
  }
  let parsedImageUrl;
  try { parsedImageUrl = new URL(value); } catch {
    throw new ApiError(400, 'Ingresa una URL de imagen válida.');
  }
  if (!['http:', 'https:'].includes(parsedImageUrl.protocol)) {
    throw new ApiError(400, 'La URL de imagen debe usar HTTP o HTTPS.');
  }
  return value;
}

async function validateProductFields(body, negocioId) {
  const { nombre } = body;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
    throw new ApiError(400, 'El nombre del producto es obligatorio y no puede superar 150 caracteres.');
  }
  if (body.codigo_barras && String(body.codigo_barras).length > 50) {
    throw new ApiError(400, 'El código de barras no puede superar 50 caracteres.');
  }
  const values = {
    nombre: nombre.trim(),
    codigo_barras: body.codigo_barras || null,
    descripcion_larga: readOptionalText(body.descripcion_larga, 'descripcion_larga', 5000),
    especificaciones: readOptionalText(body.especificaciones, 'especificaciones', 3000),
    precio_compra: requireNumber(body.precio_compra ?? 0, 'precio_compra'),
    precio_venta: requireNumber(body.precio_venta, 'precio_venta'),
    en_oferta: body.en_oferta === true || body.en_oferta === 'true',
    precio_oferta: requireNumber(body.precio_oferta, 'precio_oferta', { optional: true }),
    precio_mayorista: requireNumber(body.precio_mayorista, 'precio_mayorista', { optional: true }),
    stock_actual: requireNumber(body.stock_actual ?? 0, 'stock_actual'),
    stock_minimo: requireNumber(body.stock_minimo ?? 5, 'stock_minimo'),
    fecha_vencimiento: body.fecha_vencimiento || null,
    imagen_url: validateImageUrl(body.imagen_url),
  };
  if (values.en_oferta && (values.precio_oferta === null || values.precio_oferta >= values.precio_venta)) {
    throw new ApiError(400, 'El precio de oferta debe ser menor que el precio de venta.');
  }
  if (!values.en_oferta) values.precio_oferta = null;
  const references = {
    categoria_id: 'categorias',
    marca_id: 'marcas',
    presentacion_id: 'presentaciones',
    proveedor_id: 'proveedores',
  };
  for (const [field, table] of Object.entries(references)) {
    const value = body[field];
    if (!value) {
      values[field] = null;
      continue;
    }
    const referenceId = requireUuid(value, field);
    const exists = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1 AND negocio_id = $2`, [referenceId, negocioId]);
    if (!exists.rowCount) throw new ApiError(400, `${field} no pertenece al negocio seleccionado.`);
    values[field] = referenceId;
  }
  return values;
}

function readOptionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ApiError(400, `${label} debe ser texto de hasta ${maxLength} caracteres.`);
  }
  return value.trim() || null;
}

async function list(req, res) {
  const negocioId = await getNegocioId(req);
  const search = String(req.query.search ?? req.query.q ?? '').trim();
  const barcode = String(req.query.codigo_barras || '').trim();
  const brand = String(req.query.marca || '').trim();
  const category = String(req.query.categoria || '').trim();
  const autocomplete = req.query.autocomplete === '1';
  if ([search, barcode, brand, category].some((value) => value.length > 150)) {
    throw new ApiError(400, 'Los filtros de producto no pueden superar 150 caracteres.');
  }
  if (autocomplete) {
    const result = await pool.query(
      `SELECT p.id, p.nombre, p.codigo_barras, p.stock_actual AS stock
         FROM productos p
         LEFT JOIN marcas m ON m.id = p.marca_id AND m.negocio_id = p.negocio_id
         LEFT JOIN categorias c ON c.id = p.categoria_id AND c.negocio_id = p.negocio_id
        WHERE p.negocio_id = $1
          AND p.activo IS DISTINCT FROM FALSE
          AND ($2 = '' OR p.nombre ILIKE '%' || $2 || '%' OR p.codigo_barras = $2)
          AND ($3 = '' OR p.codigo_barras = $3)
          AND ($4 = '' OR m.id::text = $4 OR LOWER(m.nombre) = LOWER($4))
          AND ($5 = '' OR c.id::text = $5 OR LOWER(c.nombre) = LOWER($5))
        ORDER BY p.nombre ASC
        LIMIT 20`,
      [negocioId, search, barcode, brand, category],
    );
    return res.json(result.rows);
  }
  const result = await pool.query(
    `SELECT p.*, c.nombre AS categoria_nombre, m.nombre AS marca_nombre,
            ps.nombre AS presentacion_nombre, pr.nombre_empresa AS proveedor_nombre
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id AND c.negocio_id = p.negocio_id
       LEFT JOIN marcas m ON m.id = p.marca_id AND m.negocio_id = p.negocio_id
       LEFT JOIN presentaciones ps ON ps.id = p.presentacion_id AND ps.negocio_id = p.negocio_id
       LEFT JOIN proveedores pr ON pr.id = p.proveedor_id AND pr.negocio_id = p.negocio_id
      WHERE p.negocio_id = $1
        AND ($2 = '' OR p.nombre ILIKE '%' || $2 || '%' OR p.codigo_barras = $2)
        AND ($3 = '' OR p.codigo_barras = $3)
        AND ($4 = '' OR m.id::text = $4 OR LOWER(m.nombre) = LOWER($4))
        AND ($5 = '' OR c.id::text = $5 OR LOWER(c.nombre) = LOWER($5))
      ORDER BY p.nombre ASC`,
    [negocioId, search, barcode, brand, category],
  );
  res.json(result.rows);
}

async function create(req, res) {
  const negocioId = await getNegocioId(req);
  const values = await validateProductFields(req.body, negocioId);
  const imageUrl = req.file ? await storeImage(req.file) : values.imagen_url;
  try {
    const result = await pool.query(
      `INSERT INTO productos
         (negocio_id, categoria_id, marca_id, presentacion_id, proveedor_id, codigo_barras,
          nombre, descripcion_larga, especificaciones, precio_compra, precio_venta,
          en_oferta, precio_oferta, precio_mayorista, stock_actual, stock_minimo,
          fecha_vencimiento, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        negocioId, values.categoria_id, values.marca_id, values.presentacion_id, values.proveedor_id,
        values.codigo_barras, values.nombre, values.descripcion_larga, values.especificaciones,
        values.precio_compra, values.precio_venta, values.en_oferta, values.precio_oferta,
        values.precio_mayorista, values.stock_actual, values.stock_minimo, values.fecha_vencimiento, imageUrl,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (req.file && imageUrl) await removeStoredImage(imageUrl);
    throw error;
  }
}

async function update(req, res) {
  const negocioId = await getNegocioId(req);
  const productId = requireUuid(req.params.id, 'producto_id');
  const currentResult = await pool.query(
    'SELECT * FROM productos WHERE id = $1 AND negocio_id = $2',
    [productId, negocioId],
  );
  if (!currentResult.rowCount) throw new ApiError(404, 'El producto solicitado no existe.');
  const current = currentResult.rows[0];
  const values = await validateProductFields(req.body, negocioId);
  const newImageUrl = req.file
    ? await storeImage(req.file)
    : req.body.quitar_imagen === 'true'
      ? null
      : current.imagen_url;

  let updatedProduct;
  try {
    const result = await pool.query(
      `UPDATE productos
          SET categoria_id = $1, marca_id = $2, presentacion_id = $3, proveedor_id = $4,
              codigo_barras = $5, nombre = $6, descripcion_larga = $7, especificaciones = $8,
              precio_compra = $9, precio_venta = $10, en_oferta = $11, precio_oferta = $12,
              precio_mayorista = $13, stock_actual = $14, stock_minimo = $15,
              fecha_vencimiento = $16, imagen_url = $17
        WHERE id = $18 AND negocio_id = $19 RETURNING *`,
      [
        values.categoria_id, values.marca_id, values.presentacion_id, values.proveedor_id,
        values.codigo_barras, values.nombre, values.descripcion_larga, values.especificaciones,
        values.precio_compra, values.precio_venta, values.en_oferta, values.precio_oferta,
        values.precio_mayorista, values.stock_actual, values.stock_minimo,
        values.fecha_vencimiento, newImageUrl, productId, negocioId,
      ],
    );
    if (!result.rowCount) throw new ApiError(404, 'El producto solicitado no existe.');
    updatedProduct = result.rows[0];
  } catch (error) {
    if (req.file && newImageUrl) await removeStoredImage(newImageUrl);
    throw error;
  }
  if (current.imagen_url !== newImageUrl) {
    try {
      await removeStoredImage(current.imagen_url);
    } catch (error) {
      console.error(`No se pudo borrar la imagen anterior del producto ${productId}:`, error);
    }
  }
  res.json(updatedProduct);
}

async function listCategories(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    'SELECT id, nombre FROM categorias WHERE negocio_id = $1 ORDER BY nombre',
    [negocioId],
  );
  res.json(result.rows);
}

function readReferenceName(req, singular) {
  const name = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!name || name.length > 100) {
    throw new ApiError(400, `El nombre de ${singular} es obligatorio (máximo 100 caracteres).`);
  }
  return name;
}

async function listBrands(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT m.id, m.nombre, COUNT(p.id)::int AS productos
       FROM marcas m
       LEFT JOIN productos p ON p.marca_id = m.id AND p.negocio_id = m.negocio_id
      WHERE m.negocio_id = $1
      GROUP BY m.id ORDER BY m.nombre`,
    [negocioId],
  );
  res.json(result.rows);
}

async function createBrand(req, res) {
  const negocioId = await getNegocioId(req);
  const name = readReferenceName(req, 'marca');
  const result = await pool.query(
    'INSERT INTO marcas (negocio_id, nombre) VALUES ($1, $2) RETURNING id, nombre',
    [negocioId, name],
  );
  res.status(201).json(result.rows[0]);
}

async function updateBrand(req, res) {
  const negocioId = await getNegocioId(req);
  const brandId = requireUuid(req.params.id, 'marca_id');
  const name = readReferenceName(req, 'marca');
  const result = await pool.query(
    'UPDATE marcas SET nombre = $1 WHERE id = $2 AND negocio_id = $3 RETURNING id, nombre',
    [name, brandId, negocioId],
  );
  if (!result.rowCount) throw new ApiError(404, 'La marca no existe en este negocio.');
  res.json(result.rows[0]);
}

async function deleteBrand(req, res) {
  const negocioId = await getNegocioId(req);
  const brandId = requireUuid(req.params.id, 'marca_id');
  const brand = await pool.query('SELECT id FROM marcas WHERE id = $1 AND negocio_id = $2', [brandId, negocioId]);
  if (!brand.rowCount) throw new ApiError(404, 'La marca no existe en este negocio.');
  const products = await pool.query(
    'SELECT 1 FROM productos WHERE marca_id = $1 AND negocio_id = $2 LIMIT 1',
    [brandId, negocioId],
  );
  if (products.rowCount) throw new ApiError(400, 'No se puede eliminar porque tiene productos asociados.');
  await pool.query('DELETE FROM marcas WHERE id = $1 AND negocio_id = $2', [brandId, negocioId]);
  res.status(204).end();
}

async function listPresentations(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT p.id, p.nombre, COUNT(pr.id)::int AS productos
       FROM presentaciones p
       LEFT JOIN productos pr ON pr.presentacion_id = p.id AND pr.negocio_id = p.negocio_id
      WHERE p.negocio_id = $1
      GROUP BY p.id ORDER BY p.nombre`,
    [negocioId],
  );
  res.json(result.rows);
}

async function createPresentation(req, res) {
  const negocioId = await getNegocioId(req);
  const name = readReferenceName(req, 'presentación');
  const result = await pool.query(
    'INSERT INTO presentaciones (negocio_id, nombre) VALUES ($1, $2) RETURNING id, nombre',
    [negocioId, name],
  );
  res.status(201).json(result.rows[0]);
}

async function updatePresentation(req, res) {
  const negocioId = await getNegocioId(req);
  const presentationId = requireUuid(req.params.id, 'presentacion_id');
  const name = readReferenceName(req, 'presentación');
  const result = await pool.query(
    'UPDATE presentaciones SET nombre = $1 WHERE id = $2 AND negocio_id = $3 RETURNING id, nombre',
    [name, presentationId, negocioId],
  );
  if (!result.rowCount) throw new ApiError(404, 'La presentación no existe en este negocio.');
  res.json(result.rows[0]);
}

async function deletePresentation(req, res) {
  const negocioId = await getNegocioId(req);
  const presentationId = requireUuid(req.params.id, 'presentacion_id');
  const presentation = await pool.query(
    'SELECT id FROM presentaciones WHERE id = $1 AND negocio_id = $2',
    [presentationId, negocioId],
  );
  if (!presentation.rowCount) throw new ApiError(404, 'La presentación no existe en este negocio.');
  const products = await pool.query(
    'SELECT 1 FROM productos WHERE presentacion_id = $1 AND negocio_id = $2 LIMIT 1',
    [presentationId, negocioId],
  );
  if (products.rowCount) throw new ApiError(400, 'No se puede eliminar porque tiene productos asociados.');
  await pool.query(
    'DELETE FROM presentaciones WHERE id = $1 AND negocio_id = $2',
    [presentationId, negocioId],
  );
  res.status(204).end();
}

async function remove(req, res) {
  const negocioId = await getNegocioId(req);
  const productId = requireUuid(req.params.id, 'producto_id');
  const result = await pool.query(
    `UPDATE productos SET activo = FALSE
      WHERE id = $1 AND negocio_id = $2 AND activo IS DISTINCT FROM FALSE
      RETURNING id, activo`,
    [productId, negocioId],
  );
  if (!result.rowCount) {
    const existing = await pool.query(
      'SELECT id FROM productos WHERE id = $1 AND negocio_id = $2',
      [productId, negocioId],
    );
    if (!existing.rowCount) throw new ApiError(404, 'El producto no existe en este negocio.');
    throw new ApiError(409, 'El producto ya está inactivo.');
  }
  res.json({ ok: true, ...result.rows[0] });
}

async function listSuppliers(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    'SELECT id, nombre_empresa, contacto_nombre, telefono, nit_ci FROM proveedores WHERE negocio_id = $1 ORDER BY nombre_empresa',
    [negocioId],
  );
  res.json(result.rows);
}

module.exports = {
  create,
  update,
  createBrand,
  createPresentation,
  deleteBrand,
  deletePresentation,
  list,
  listBrands,
  listCategories,
  listPresentations,
  listSuppliers,
  remove,
  updateBrand,
  updatePresentation,
};
