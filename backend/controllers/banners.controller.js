const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/db');
const { findPublicStoreBusiness } = require('./public.controller');
const { ApiError, getNegocioId } = require('../utils/http');

const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
const imageTypes = {
  'image/jpeg': {
    extension: 'jpg',
    signature: (buffer) => buffer.length >= 3
      && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    signature: (buffer) => buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    signature: (buffer) => buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
};

async function storeImage(file) {
  const imageType = imageTypes[file?.mimetype];
  if (!file || !imageType || !imageType.signature(file.buffer)) {
    throw new ApiError(400, 'El contenido del archivo no corresponde a una imagen JPG, PNG o WebP válida.');
  }
  const filename = `${crypto.randomUUID()}.${imageType.extension}`;
  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadDirectory, filename), file.buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}

async function removeStoredImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return;
  const filename = imageUrl.slice('/uploads/'.length);
  if (path.basename(filename) !== filename) return;
  await fs.rm(path.join(uploadDirectory, filename), { force: true });
}

function readTitle(value, optional = true) {
  if (value === undefined) return optional ? undefined : null;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 150) {
    throw new ApiError(400, 'El título debe tener hasta 150 caracteres.');
  }
  return value.trim() || null;
}

function readOrder(value, optional = true) {
  if (value === undefined && optional) return undefined;
  const order = Number(value);
  if (!Number.isSafeInteger(order) || order < 0 || order > 1000000) {
    throw new ApiError(400, 'El orden debe ser un entero entre 0 y 1000000.');
  }
  return order;
}

function readActive(value, optional = true) {
  if (value === undefined && optional) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new ApiError(400, 'activo debe ser verdadero o falso.');
}

function requireBannerId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) throw new ApiError(400, 'El identificador del banner no es válido.');
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new ApiError(400, 'El identificador del banner no es válido.');
  return id;
}

async function listPublic(_req, res) {
  const business = await findPublicStoreBusiness();
  const result = await pool.query(
    `SELECT id, titulo, imagen_url, orden
       FROM public.banners_carrusel
      WHERE negocio_id = $1 AND activo = TRUE
      ORDER BY orden, id`,
    [business.id],
  );
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(result.rows);
}

async function listAdmin(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT id, titulo, imagen_url, orden, activo, created_at
       FROM public.banners_carrusel
      WHERE negocio_id = $1
      ORDER BY orden, id`,
    [negocioId],
  );
  res.json(result.rows);
}

async function create(req, res) {
  const negocioId = await getNegocioId(req);
  const title = readTitle(req.body?.titulo, false);
  const order = req.body?.orden === undefined || req.body.orden === ''
    ? 0
    : readOrder(req.body.orden, false);
  const active = req.body?.activo === undefined ? true : readActive(req.body.activo, false);
  if (!req.file) throw new ApiError(400, 'Selecciona una imagen para el banner.');
  const imageUrl = await storeImage(req.file);
  try {
    const result = await pool.query(
      `INSERT INTO public.banners_carrusel (negocio_id, titulo, imagen_url, orden, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, titulo, imagen_url, orden, activo, created_at`,
      [negocioId, title, imageUrl, order, active],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await removeStoredImage(imageUrl);
    throw error;
  }
}

async function update(req, res) {
  const id = requireBannerId(req.params.id);
  const negocioId = await getNegocioId(req);
  const title = readTitle(req.body?.titulo);
  const order = readOrder(req.body?.orden);
  const active = readActive(req.body?.activo);
  if (title === undefined && order === undefined && active === undefined && !req.file) {
    throw new ApiError(400, 'Indica al menos un campo para actualizar.');
  }
  const existing = await pool.query(
    'SELECT imagen_url FROM public.banners_carrusel WHERE id = $1 AND negocio_id = $2',
    [id, negocioId],
  );
  if (!existing.rowCount) throw new ApiError(404, 'El banner no existe en la sucursal seleccionada.');
  const replacementImage = req.file ? await storeImage(req.file) : null;
  let updatedBanner;
  try {
    const result = await pool.query(
      `UPDATE public.banners_carrusel
          SET titulo = COALESCE($1, titulo),
              orden = COALESCE($2, orden),
              activo = COALESCE($3, activo),
              imagen_url = COALESCE($4, imagen_url)
        WHERE id = $5 AND negocio_id = $6
        RETURNING id, titulo, imagen_url, orden, activo, created_at`,
      [title, order, active, replacementImage, id, negocioId],
    );
    if (!result.rowCount) throw new ApiError(404, 'El banner ya no existe en la sucursal seleccionada.');
    updatedBanner = result.rows[0];
  } catch (error) {
    if (replacementImage) await removeStoredImage(replacementImage);
    throw error;
  }
  if (replacementImage) await removeStoredImage(existing.rows[0].imagen_url);
  res.json(updatedBanner);
}

async function remove(req, res) {
  const id = requireBannerId(req.params.id);
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `DELETE FROM public.banners_carrusel
      WHERE id = $1 AND negocio_id = $2
      RETURNING imagen_url`,
    [id, negocioId],
  );
  if (!result.rowCount) throw new ApiError(404, 'El banner no existe en la sucursal seleccionada.');
  await removeStoredImage(result.rows[0].imagen_url);
  res.status(204).end();
}

async function getOffersDeadline(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    'SELECT ofertas_hasta FROM public.configuracion_tienda_publica WHERE negocio_id = $1',
    [negocioId],
  );
  res.json({ ofertas_hasta: result.rows[0]?.ofertas_hasta || null });
}

async function updateOffersDeadline(req, res) {
  const negocioId = await getNegocioId(req);
  const value = req.body?.ofertas_hasta;
  let deadline = null;
  if (value !== null && value !== '') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      || Number.isNaN(Date.parse(value))) {
      throw new ApiError(400, 'ofertas_hasta debe ser una fecha ISO 8601 válida con zona horaria.');
    }
    deadline = new Date(value).toISOString();
    if (Date.parse(deadline) <= Date.now()) {
      throw new ApiError(400, 'La fecha de finalización debe ser futura.');
    }
  }
  const result = await pool.query(
    `INSERT INTO public.configuracion_tienda_publica (negocio_id, ofertas_hasta, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (negocio_id)
     DO UPDATE SET ofertas_hasta = EXCLUDED.ofertas_hasta, updated_at = NOW()
     RETURNING ofertas_hasta`,
    [negocioId, deadline],
  );
  res.json({ ofertas_hasta: result.rows[0].ofertas_hasta });
}

async function getPublicOffersDeadline(_req, res) {
  const business = await findPublicStoreBusiness();
  const result = await pool.query(
    'SELECT ofertas_hasta FROM public.configuracion_tienda_publica WHERE negocio_id = $1',
    [business.id],
  );
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ ofertas_hasta: result.rows[0]?.ofertas_hasta || null });
}

module.exports = {
  create,
  getOffersDeadline,
  getPublicOffersDeadline,
  listAdmin,
  listPublic,
  remove,
  update,
  updateOffersDeadline,
};
