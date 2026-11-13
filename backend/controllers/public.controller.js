const { pool } = require('../config/db');
const { ApiError, requireUuid } = require('../utils/http');

async function catalog(_req, res) {
  const configuredBusinessId = process.env.PUBLIC_STORE_BUSINESS_ID;
  const requestedBusinessId = configuredBusinessId || '';

  let business;
  if (requestedBusinessId) {
    const businessId = requireUuid(requestedBusinessId, 'negocio_id');
    const result = await pool.query(
      'SELECT id, nombre, nit, direccion, telefono FROM negocios WHERE id = $1',
      [businessId],
    );
    business = result.rows[0];
  } else {
    const result = await pool.query(
      `SELECT id, nombre, nit, direccion, telefono
         FROM negocios
        WHERE LOWER(BTRIM(nombre)) = LOWER($1)
        ORDER BY creado_en, id
        LIMIT 2`,
      ['Tienda Forty'],
    );
    if (result.rowCount > 1) {
      throw new ApiError(503, 'Hay más de una tienda llamada Tienda Forty. Configura PUBLIC_STORE_BUSINESS_ID.');
    }
    business = result.rows[0];
  }

  if (!business) throw new ApiError(404, 'No se encontró la tienda pública configurada.');

  const products = await pool.query(
    `SELECT p.id, p.nombre, p.codigo_barras, p.imagen_url,
            p.descripcion_larga, p.especificaciones,
            p.precio_venta, p.en_oferta, p.precio_oferta, p.stock_actual,
            p.presentacion_id, ps.nombre AS presentacion_nombre,
            p.categoria_id, c.nombre AS categoria_nombre,
            p.marca_id, m.nombre AS marca_nombre
       FROM productos p
       LEFT JOIN categorias c
         ON c.id = p.categoria_id AND c.negocio_id = p.negocio_id
       LEFT JOIN presentaciones ps
         ON ps.id = p.presentacion_id AND ps.negocio_id = p.negocio_id
       LEFT JOIN marcas m
         ON m.id = p.marca_id AND m.negocio_id = p.negocio_id
      WHERE p.negocio_id = $1
        AND p.activo IS DISTINCT FROM FALSE
        AND p.stock_actual > 0
      ORDER BY p.en_oferta DESC, c.nombre NULLS LAST, p.nombre`,
    [business.id],
  );

  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ negocio: business, productos: products.rows });
}

async function createContactMessage(req, res) {
  const { nombre, email, mensaje } = req.body || {};
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
    throw new ApiError(400, 'Ingresa tu nombre (máximo 150 caracteres).');
  }
  if (typeof email !== 'string' || email.trim().length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new ApiError(400, 'Ingresa un correo electrónico válido.');
  }
  if (typeof mensaje !== 'string' || !mensaje.trim() || mensaje.trim().length > 5000) {
    throw new ApiError(400, 'Escribe tu mensaje (máximo 5000 caracteres).');
  }

  const result = await pool.query(
    `INSERT INTO public.contactos_mensajes (nombre, email, mensaje)
     VALUES ($1, $2, $3)
     RETURNING id, fecha_creacion`,
    [nombre.trim(), email.trim().toLowerCase(), mensaje.trim()],
  );
  res.status(201).json({
    success: true,
    message: 'Tu mensaje fue enviado correctamente.',
    contacto: result.rows[0],
  });
}

module.exports = { catalog, createContactMessage };
