const { pool } = require('../config/db');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function requireUuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, `${label} debe ser un UUID válido.`);
  }
  return value;
}

function requireNumber(value, label, { min = 0, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const number = Number(value);
  if (
    !Number.isFinite(number)
    || number < min
    || number > 99999999.99
    || Math.abs(number - Math.round(number * 100) / 100) > 1e-8
  ) {
    throw new ApiError(400, `${label} debe ser un número válido con hasta dos decimales.`);
  }
  return number;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function getNegocioId(req, client = pool) {
  const requestedId = req.get('x-negocio-id')
    || req.query.negocio_id
    || req.session?.activeBusinessId
    || process.env.NEGOCIO_ID;
  if (requestedId) {
    const negocioId = requireUuid(requestedId, 'negocio_id');
    if (req.user && !req.user.business_ids.includes(negocioId)) {
      throw new ApiError(403, 'No tienes acceso a esta sucursal.');
    }
    const result = await client.query('SELECT id FROM negocios WHERE id = $1', [negocioId]);
    if (!result.rowCount) throw new ApiError(404, 'El negocio seleccionado no existe.');
    return negocioId;
  }

  if (req.user) {
    if (req.user.business_ids.length === 1) return req.user.business_ids[0];
    if (req.user.business_ids.length > 1) {
      throw new ApiError(400, 'Selecciona la sucursal activa antes de continuar.');
    }
    throw new ApiError(403, 'Tu usuario no tiene sucursales asignadas.');
  }

  const result = await client.query('SELECT id FROM negocios ORDER BY creado_en ASC, id ASC LIMIT 2');
  if (result.rowCount === 0) throw new ApiError(503, 'No hay negocios registrados para operar.');
  if (result.rowCount > 1) {
    throw new ApiError(400, 'Selecciona un negocio enviando el encabezado X-Negocio-Id.');
  }
  return result.rows[0].id;
}

function readSaleItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, 'La venta debe incluir al menos un producto.');
  }
  const quantities = new Map();
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new ApiError(400, 'Cada producto de la venta debe ser válido.');
    const productId = requireUuid(item.producto_id || item.productId, 'producto_id');
    const quantity = requireNumber(item.cantidad ?? item.quantity, 'cantidad', { min: Number.EPSILON });
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  return [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function readPurchaseItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, 'La compra debe incluir al menos un producto.');
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new ApiError(400, 'Cada producto de la compra debe ser válido.');
    return {
      productId: requireUuid(item.producto_id || item.productId, 'producto_id'),
      quantity: requireNumber(item.cantidad ?? item.quantity, 'cantidad', { min: Number.EPSILON }),
      unitCost: requireNumber(item.precio_costo_unitario ?? item.costo_unitario ?? item.unitCost, 'costo unitario'),
      expirationDate: item.fecha_vencimiento == null || item.fecha_vencimiento === ''
        ? null
        : (() => {
          const value = String(item.fecha_vencimiento);
          const parsed = new Date(`${value}T00:00:00Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
            || Number.isNaN(parsed.getTime())
            || parsed.toISOString().slice(0, 10) !== value) {
            throw new ApiError(400, 'fecha_vencimiento debe tener formato YYYY-MM-DD.');
          }
          return value;
        })(),
    };
  });
}

async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (error) {
    console.error('No se pudo revertir la transacción POS:', error);
  }
}

module.exports = {
  ApiError,
  asyncHandler,
  getNegocioId,
  readPurchaseItems,
  readSaleItems,
  requireNumber,
  requireUuid,
  rollback,
  roundMoney,
};
