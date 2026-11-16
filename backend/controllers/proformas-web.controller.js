const { pool } = require('../config/db');
const { findPublicStoreBusiness } = require('./public.controller');
const {
  ApiError,
  getNegocioId,
  readSaleItems,
  requireNumber,
  requireUuid,
  rollback,
  roundMoney,
} = require('../utils/http');

function readProformaItems(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new ApiError(400, 'El pedido debe incluir entre 1 y 100 productos.');
  }
  return readSaleItems(value.map((item) => ({
    producto_id: item?.producto_id || item?.productId || item?.id,
    cantidad: item?.cantidad ?? item?.quantity,
  })));
}

function getProductPrice(product) {
  const regularPrice = Number(product.precio_venta) || 0;
  const offerPrice = Number(product.precio_oferta);
  const hasOffer = product.en_oferta === true
    && product.precio_oferta !== null
    && product.precio_oferta !== undefined
    && Number.isFinite(offerPrice)
    && offerPrice >= 0
    && offerPrice < regularPrice;
  return hasOffer ? offerPrice : regularPrice;
}

async function create(req, res) {
  const items = readProformaItems(req.body?.items);
  const customerName = req.body?.cliente_nombre;
  const phone = req.body?.telefono;
  if (customerName !== undefined && typeof customerName !== 'string') {
    throw new ApiError(400, 'cliente_nombre debe ser texto.');
  }
  if (phone !== undefined && typeof phone !== 'string') {
    throw new ApiError(400, 'telefono debe ser texto.');
  }
  const name = customerName?.trim() || 'Cliente Web';
  const contact = phone?.trim() || null;
  if (name.length > 150 || (contact && contact.length > 50)) {
    throw new ApiError(400, 'El nombre admite hasta 150 caracteres y el teléfono hasta 50.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const business = await findPublicStoreBusiness(client);
    const productIds = items.map((item) => item.productId).sort();
    const productsResult = await client.query(
      `SELECT id, nombre, precio_venta, precio_compra, precio_oferta, en_oferta, stock_actual
         FROM public.productos
        WHERE negocio_id = $1 AND activo IS DISTINCT FROM FALSE AND id = ANY($2::uuid[])
        ORDER BY id FOR SHARE`,
      [business.id, productIds],
    );
    if (productsResult.rowCount !== productIds.length) {
      throw new ApiError(400, 'Uno o más productos ya no están disponibles en la tienda.');
    }

    const products = new Map(productsResult.rows.map((product) => [product.id, product]));
    const orderItems = items.map((item) => {
      const product = products.get(item.productId);
      if (Number(product.stock_actual) < item.quantity) {
        throw new ApiError(409, `Stock insuficiente para ${product.nombre}.`);
      }
      const unitPrice = getProductPrice(product);
      return {
        producto_id: item.productId,
        nombre: product.nombre,
        cantidad: item.quantity,
        precio_unitario: unitPrice,
        subtotal: roundMoney(unitPrice * item.quantity),
      };
    });
    const total = roundMoney(orderItems.reduce((sum, item) => sum + item.subtotal, 0));
    if (total > 99999999.99) throw new ApiError(400, 'El total del pedido supera el límite permitido.');
    const result = await client.query(
      `INSERT INTO public.proformas_web (negocio_id, cliente_nombre, telefono, items, total)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, cliente_nombre, telefono, items, total, estado, created_at`,
      [business.id, name, contact, JSON.stringify(orderItems), total],
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, proforma: result.rows[0] });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function list(req, res) {
  const status = String(req.query.estado || 'PENDIENTE').trim().toUpperCase();
  if (!['PENDIENTE', 'VENDIDO', 'CANCELADO', 'TODAS'].includes(status)) {
    throw new ApiError(400, 'El filtro estado debe ser PENDIENTE, VENDIDO, CANCELADO o TODAS.');
  }
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT id, cliente_nombre, telefono, items, total, estado, created_at
       FROM public.proformas_web
      WHERE negocio_id = $1 AND ($2 = 'TODAS' OR estado = $2)
      ORDER BY created_at DESC, id DESC
      LIMIT 500`,
    [negocioId, status],
  );
  res.json(result.rows);
}

async function convertToSale(req, res) {
  if (!/^[1-9]\d*$/.test(String(req.params.id))) {
    throw new ApiError(400, 'El identificador de la proforma no es válido.');
  }
  const proformaId = Number(req.params.id);
  if (!Number.isSafeInteger(proformaId)) throw new ApiError(400, 'El identificador de la proforma no es válido.');
  const requestedMethod = String(req.body?.metodo_pago || '').trim().toLowerCase();
  const method = requestedMethod === 'transferencia' ? 'qr' : requestedMethod;
  if (!['efectivo', 'qr', 'tarjeta', 'mixto', 'credito'].includes(method)) {
    throw new ApiError(400, 'metodo_pago debe ser efectivo, qr, tarjeta, mixto o credito.');
  }
  const requestedCustomerName = req.body?.cliente_nombre;
  const requestedCustomerContact = req.body?.cliente_contacto;
  if (requestedCustomerName !== undefined && typeof requestedCustomerName !== 'string') {
    throw new ApiError(400, 'cliente_nombre debe ser texto.');
  }
  if (requestedCustomerContact !== undefined && typeof requestedCustomerContact !== 'string') {
    throw new ApiError(400, 'cliente_contacto debe ser texto.');
  }
  const customerName = requestedCustomerName?.trim() || '';
  const customerContact = requestedCustomerContact?.trim() || '';
  if (customerName.length > 150 || customerContact.length > 50) {
    throw new ApiError(400, 'El nombre admite hasta 150 caracteres y el contacto hasta 50.');
  }
  const customerId = req.body?.cliente_id == null || req.body.cliente_id === ''
    ? null
    : Number(req.body.cliente_id);
  if (customerId !== null && (!Number.isSafeInteger(customerId) || customerId <= 0)) {
    throw new ApiError(400, 'cliente_id debe ser un identificador válido.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const proformaResult = await client.query(
      'SELECT * FROM public.proformas_web WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [proformaId, negocioId],
    );
    if (!proformaResult.rowCount) throw new ApiError(404, 'La proforma no existe en la sucursal seleccionada.');
    const proforma = proformaResult.rows[0];
    if (proforma.estado !== 'PENDIENTE') {
      throw new ApiError(409, 'La proforma ya fue procesada y no se puede vender nuevamente.');
    }

    let customer = null;
    if (customerId !== null) {
      const customerResult = await client.query(
        `SELECT id, nombre_completo, telefono, nit_ci
           FROM public.clientes
          WHERE id = $1 AND negocio_id = $2 FOR KEY SHARE`,
        [customerId, negocioId],
      );
      if (!customerResult.rowCount) throw new ApiError(400, 'El cliente no pertenece al negocio seleccionado.');
      customer = customerResult.rows[0];
    }
    if (method === 'credito' && !customer) {
      throw new ApiError(400, 'Selecciona un cliente registrado para vender a crédito.');
    }
    const saleCustomerName = customer?.nombre_completo
      || customerName
      || (proforma.cliente_nombre === 'Cliente Web' ? 'Cliente General' : proforma.cliente_nombre);
    const saleCustomerContact = customer?.telefono
      || customer?.nit_ci
      || customerContact
      || proforma.telefono
      || null;
    if (method === 'credito' && !saleCustomerContact) {
      throw new ApiError(400, 'El cliente de la venta a crédito debe tener teléfono o NIT/CI registrado.');
    }

    const turnResult = await client.query(
      `SELECT id FROM public.turnos_caja
        WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
        ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE`,
      [negocioId],
    );
    const turnId = turnResult.rows[0]?.id || null;
    if (!turnId && method !== 'credito') {
      throw new ApiError(409, 'Abre un turno de caja para registrar una venta con pago inmediato.');
    }

    const requestedItems = readSaleItems(proforma.items);
    const savedItems = new Map(proforma.items.map((item) => [
      requireUuid(item.producto_id || item.productId, 'producto_id'),
      {
        quantity: requireNumber(item.cantidad ?? item.quantity, 'cantidad', { min: Number.EPSILON }),
        unitPrice: requireNumber(item.precio_unitario ?? item.precio, 'precio_unitario'),
      },
    ]));
    if (requestedItems.length !== savedItems.size
      || requestedItems.some((item) => savedItems.get(item.productId)?.quantity !== item.quantity)) {
      throw new ApiError(409, 'Los productos guardados en la proforma no son válidos.');
    }

    const productIds = requestedItems.map((item) => item.productId).sort();
    const productsResult = await client.query(
      `SELECT id, nombre, codigo_barras, precio_compra, stock_actual
         FROM public.productos
        WHERE negocio_id = $1 AND activo IS DISTINCT FROM FALSE AND id = ANY($2::uuid[])
        ORDER BY id FOR UPDATE`,
      [negocioId, productIds],
    );
    if (productsResult.rowCount !== productIds.length) {
      throw new ApiError(409, 'Uno o más productos de la proforma ya no están disponibles.');
    }

    const products = new Map(productsResult.rows.map((product) => [product.id, product]));
    const lines = requestedItems.map((item) => {
      const product = products.get(item.productId);
      const saved = savedItems.get(item.productId);
      if (Number(product.stock_actual) < item.quantity) {
        throw new ApiError(409, `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_actual}.`);
      }
      return {
        ...item,
        product,
        unitPrice: saved.unitPrice,
        lineTotal: roundMoney(saved.unitPrice * item.quantity),
      };
    });
    const total = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    if (total !== roundMoney(Number(proforma.total))) {
      throw new ApiError(409, 'El total guardado en la proforma no coincide con sus productos.');
    }
    const cashTendered = method === 'efectivo'
      ? requireNumber(req.body?.monto_efectivo ?? req.body?.monto_recibido ?? total, 'monto_efectivo')
      : method === 'mixto'
        ? requireNumber(req.body?.monto_efectivo ?? 0, 'monto_efectivo')
        : 0;
    const qrPaid = method === 'qr'
      ? total
      : method === 'mixto'
        ? requireNumber(req.body?.monto_qr ?? 0, 'monto_qr')
        : 0;
    const cardPaid = method === 'tarjeta' ? total : 0;
    const creditPaid = method === 'credito' ? total : 0;
    if (method === 'efectivo' && cashTendered < total) {
      throw new ApiError(400, 'El efectivo recibido no alcanza para cubrir el total.');
    }
    if (method === 'mixto') {
      if (cashTendered <= 0 || qrPaid <= 0) {
        throw new ApiError(400, 'El pago mixto requiere un monto mayor a cero en efectivo y otro en QR.');
      }
      if (roundMoney(cashTendered + qrPaid) !== total) {
        throw new ApiError(400, 'La suma del efectivo y QR debe coincidir exactamente con el total.');
      }
    }

    const saleResult = await client.query(
      `INSERT INTO public.ventas
         (negocio_id, turno_id, usuario_id, cliente_id, cliente_nombre, cliente_contacto,
          subtotal, descuento, total, metodo_pago, monto_efectivo, monto_qr, monto_tarjeta,
          monto_credito, monto_recibido, estado, saldo_pendiente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        negocioId, turnId, req.user.id, customerId, saleCustomerName, saleCustomerContact,
        total, method,
        method === 'efectivo' ? total : cashTendered, qrPaid, cardPaid, creditPaid,
        cashTendered, method === 'credito' ? 'pendiente' : 'completada',
        method === 'credito' ? total : 0,
      ],
    );
    const sale = saleResult.rows[0];
    const receiptLines = [];
    for (const line of lines) {
      const detailResult = await client.query(
        `INSERT INTO public.venta_detalles
           (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [sale.id, line.productId, line.quantity, line.unitPrice, line.product.precio_compra, line.lineTotal],
      );
      receiptLines.push({
        ...detailResult.rows[0],
        nombre: line.product.nombre,
        codigo_barras: line.product.codigo_barras,
      });
      await client.query(
        `UPDATE public.productos SET stock_actual = stock_actual - $1
          WHERE id = $2 AND negocio_id = $3`,
        [line.quantity, line.productId, negocioId],
      );
    }
    if (turnId && cashTendered > 0) {
      await client.query(
        `UPDATE public.turnos_caja
            SET total_efectivo_esperado = COALESCE(total_efectivo_esperado, 0) + $1
          WHERE id = $2 AND negocio_id = $3`,
        [method === 'efectivo' ? total : cashTendered, turnId, negocioId],
      );
    }
    if (turnId && cardPaid > 0) {
      await client.query(
        `UPDATE public.turnos_caja
            SET total_tarjeta_esperado = COALESCE(total_tarjeta_esperado, 0) + $1
          WHERE id = $2 AND negocio_id = $3`,
        [cardPaid, turnId, negocioId],
      );
    }
    if (turnId && qrPaid > 0) {
      await client.query(
        `UPDATE public.turnos_caja
            SET total_qr_esperado = COALESCE(total_qr_esperado, 0) + $1
          WHERE id = $2 AND negocio_id = $3`,
        [qrPaid, turnId, negocioId],
      );
    }
    await client.query(
      `UPDATE public.proformas_web SET estado = 'VENDIDO'
        WHERE id = $1 AND negocio_id = $2 AND estado = 'PENDIENTE'`,
      [proformaId, negocioId],
    );
    const businessResult = await client.query(
      'SELECT nombre AS negocio_nombre, nit AS negocio_nit, direccion AS negocio_direccion, telefono AS negocio_telefono FROM public.negocios WHERE id = $1',
      [negocioId],
    );
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      venta: {
        ...sale,
        cajero_nombre: req.user.nombre,
        ...businessResult.rows[0],
      },
      detalles: receiptLines,
      pagos: [],
      cambio: method === 'efectivo' ? roundMoney(cashTendered - total) : 0,
      proforma_id: proformaId,
    });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { convertToSale, create, list };
