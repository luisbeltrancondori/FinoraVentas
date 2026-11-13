const { pool } = require('../config/db');
const {
  ApiError,
  getNegocioId,
  readSaleItems,
  requireNumber,
  requireUuid,
  rollback,
  roundMoney,
} = require('../utils/http');

async function create(req, res) {
  const items = readSaleItems(req.body.items || req.body.detalles);
  const method = String(req.body.metodo_pago || req.body.tipo_pago || '').trim().toLowerCase();
  if (!['efectivo', 'qr', 'tarjeta', 'mixto', 'credito'].includes(method)) {
    throw new ApiError(400, 'metodo_pago debe ser efectivo, qr, tarjeta, mixto o credito.');
  }
  const customerName = String(req.body.cliente_nombre || '').trim();
  const customerContact = String(req.body.cliente_contacto || '').trim();
  if (customerName.length > 150 || customerContact.length > 50) {
    throw new ApiError(400, 'El nombre del cliente admite hasta 150 caracteres y el contacto hasta 50.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const customerId = req.body.cliente_id == null || req.body.cliente_id === ''
      ? null
      : Number(req.body.cliente_id);
    if (customerId !== null && (!Number.isSafeInteger(customerId) || customerId <= 0)) {
      throw new ApiError(400, 'cliente_id debe ser un identificador válido.');
    }
    let customer = null;
    if (customerId !== null) {
      const customerResult = await client.query(
        'SELECT id, nombre, telefono, nit_ci FROM clientes WHERE id = $1 AND negocio_id = $2 FOR KEY SHARE',
        [customerId, negocioId],
      );
      if (!customerResult.rowCount) throw new ApiError(400, 'El cliente no pertenece al negocio seleccionado.');
      customer = customerResult.rows[0];
    }
    if (method === 'credito' && !customer) {
      throw new ApiError(400, 'Selecciona un cliente registrado para vender a crédito.');
    }
    const saleCustomerName = customer?.nombre || customerName || 'Cliente General';
    const saleCustomerContact = customer?.telefono || customer?.nit_ci || customerContact || null;
    if (method === 'credito' && (!saleCustomerName || !saleCustomerContact)) {
      throw new ApiError(400, 'El cliente de la venta a crédito debe tener teléfono o NIT/CI registrado.');
    }
    const turnId = req.body.turno_id ? requireUuid(req.body.turno_id, 'turno_id') : null;
    const turnResult = await client.query(
      `SELECT * FROM turnos_caja
        WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
          AND ($2::uuid IS NULL OR id = $2)
        ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE`,
      [negocioId, turnId],
    );
    if (!turnResult.rowCount && (method !== 'credito' || turnId)) {
      throw new ApiError(409, 'Debes abrir una caja antes de registrar ventas.');
    }
    const turn = turnResult.rows[0] || null;

    const productIds = [...new Set(items.map((item) => item.productId))].sort();
    const productsResult = await client.query(
      `SELECT id, nombre, codigo_barras, precio_venta, precio_compra, stock_actual
         FROM productos
        WHERE negocio_id = $1 AND activo IS DISTINCT FROM FALSE AND id = ANY($2::uuid[])
        ORDER BY id FOR UPDATE`,
      [negocioId, productIds],
    );
    if (productsResult.rowCount !== productIds.length) {
      throw new ApiError(400, 'Uno o más productos no existen, están inactivos o pertenecen a otro negocio.');
    }

    const products = new Map(productsResult.rows.map((product) => [product.id, product]));
    const lines = items.map((item) => {
      const product = products.get(item.productId);
      if (Number(product.stock_actual) < item.quantity) {
        throw new ApiError(409, `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_actual}.`);
      }
      const unitPrice = Number(product.precio_venta);
      return { ...item, product, unitPrice, lineTotal: roundMoney(unitPrice * item.quantity) };
    });
    const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.lineTotal, 0));
    const discount = requireNumber(req.body.descuento ?? 0, 'descuento');
    if (discount > subtotal) throw new ApiError(400, 'El descuento no puede superar el subtotal.');
    const total = roundMoney(subtotal - discount);
    const cashTendered = method === 'efectivo'
      ? requireNumber(req.body.monto_efectivo ?? req.body.efectivo_recibido ?? total, 'monto_efectivo')
      : method === 'mixto'
        ? requireNumber(req.body.monto_efectivo ?? 0, 'monto_efectivo')
        : 0;
    const qrPaid = method === 'qr'
      ? total
      : method === 'mixto'
        ? requireNumber(req.body.monto_qr ?? 0, 'monto_qr')
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
      `INSERT INTO ventas
           (negocio_id, turno_id, usuario_id, cliente_id, cliente_nombre, cliente_contacto, subtotal, descuento, total,
            metodo_pago, monto_efectivo, monto_qr, monto_tarjeta, monto_credito, monto_recibido, estado, saldo_pendiente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        negocioId, turn?.id || null, req.user.id, customerId,
        saleCustomerName,
        saleCustomerContact,
        subtotal, discount, total, method,
        method === 'efectivo' ? total : cashTendered,
        qrPaid, cardPaid, creditPaid, cashTendered,
        method === 'credito' ? 'pendiente' : 'completada',
        method === 'credito' ? total : 0,
      ],
    );
    const sale = saleResult.rows[0];
    const receiptLines = [];
    for (const line of lines) {
      const detailResult = await client.query(
        `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [sale.id, line.productId, line.quantity, line.unitPrice, line.product.precio_compra, line.lineTotal],
      );
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND negocio_id = $3',
        [line.quantity, line.productId, negocioId],
      );
      receiptLines.push({
        ...detailResult.rows[0],
        nombre: line.product.nombre,
        codigo_barras: line.product.codigo_barras,
      });
    }

    if (turn && cashTendered > 0) {
      await client.query(
        'UPDATE turnos_caja SET total_efectivo_esperado = COALESCE(total_efectivo_esperado, 0) + $1 WHERE id = $2',
        [method === 'efectivo' ? total : cashTendered, turn.id],
      );
    }
    if (turn && cardPaid > 0) {
      await client.query(
        'UPDATE turnos_caja SET total_tarjeta_esperado = COALESCE(total_tarjeta_esperado, 0) + $1 WHERE id = $2',
        [cardPaid, turn.id],
      );
    }
    if (turn && qrPaid > 0) {
      await client.query(
        'UPDATE turnos_caja SET total_qr_esperado = COALESCE(total_qr_esperado, 0) + $1 WHERE id = $2',
        [qrPaid, turn.id],
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      venta: sale,
      detalles: receiptLines,
      cambio: method === 'efectivo' ? roundMoney(cashTendered - total) : 0,
    });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function list(req, res) {
  const negocioId = await getNegocioId(req);
  const from = req.query.desde || null;
  const to = req.query.hasta || null;
  const customer = String(req.query.cliente || '').trim();
  const method = String(req.query.metodo_pago || '').trim().toLowerCase();
  for (const [label, value] of [['desde', from], ['hasta', to]]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      throw new ApiError(400, `El filtro ${label} debe tener formato YYYY-MM-DD.`);
    }
  }
  if (from && to && from > to) throw new ApiError(400, 'La fecha inicial no puede ser posterior a la fecha final.');
  if (method && !['efectivo', 'qr', 'tarjeta', 'mixto', 'credito'].includes(method)) {
    throw new ApiError(400, 'El filtro metodo_pago no es válido.');
  }

  const result = await pool.query(
    `SELECT v.id, v.numero_ticket, v.cliente_nombre, v.subtotal, v.descuento, v.total,
            v.metodo_pago, v.estado, v.saldo_pendiente, v.fecha_venta,
            COUNT(vd.id)::int AS cantidad_items,
            COALESCE((SELECT SUM(p.monto) FROM pagos_venta p WHERE p.venta_id = v.id), 0) AS total_pagado
       FROM ventas v
       LEFT JOIN venta_detalles vd ON vd.venta_id = v.id
      WHERE v.negocio_id = $1
        AND ($2::date IS NULL OR v.fecha_venta >= $2::date)
        AND ($3::date IS NULL OR v.fecha_venta < $3::date + INTERVAL '1 day')
        AND ($4 = '' OR v.cliente_nombre ILIKE '%' || $4 || '%')
        AND ($5 = '' OR LOWER(v.metodo_pago) = $5)
      GROUP BY v.id ORDER BY v.fecha_venta DESC LIMIT 200`,
    [negocioId, from, to, customer, method],
  );
  res.json(result.rows);
}

async function detail(req, res) {
  const negocioId = await getNegocioId(req);
  const saleId = requireUuid(req.params.id, 'venta_id');
  const sale = await pool.query(
    `SELECT v.*, n.nombre AS negocio_nombre, n.nit AS negocio_nit,
            n.direccion AS negocio_direccion, n.telefono AS negocio_telefono,
            COALESCE(seller.nombre, turn_user.nombre) AS cajero_nombre,
            COALESCE(seller.nombre, turn_user.nombre, 'Usuario no disponible') AS usuario_nombre
       FROM ventas v
       JOIN negocios n ON n.id = v.negocio_id
       LEFT JOIN pos_users seller ON seller.id = v.usuario_id
       LEFT JOIN turnos_caja t ON t.id = v.turno_id
       LEFT JOIN pos_users turn_user ON turn_user.id = t.usuario_id
      WHERE v.id = $1 AND v.negocio_id = $2`,
    [saleId, negocioId],
  );
  if (!sale.rowCount) throw new ApiError(404, 'La venta solicitada no existe.');
  const [details, payments] = await Promise.all([
    pool.query(
      `SELECT d.id, d.producto_id, p.nombre, p.codigo_barras, d.cantidad, d.precio_unitario, d.subtotal
         FROM venta_detalles d
         JOIN ventas v ON v.id = d.venta_id
         LEFT JOIN productos p ON p.id = d.producto_id
        WHERE d.venta_id = $1 AND v.negocio_id = $2 ORDER BY d.id`,
      [saleId, negocioId],
    ),
    pool.query(
      `SELECT p.id, p.monto, p.fecha_pago, p.metodo_pago, p.referencia_nota,
              p.turno_id, u.nombre AS usuario_nombre
         FROM pagos_venta p
         LEFT JOIN pos_users u ON u.id = p.usuario_id
        WHERE p.venta_id = $1
        ORDER BY p.fecha_pago DESC, p.id DESC`,
      [saleId],
    ),
  ]);
  const totalPaid = roundMoney(payments.rows.reduce((sum, payment) => sum + Number(payment.monto), 0));
  res.json({
    venta: { ...sale.rows[0], total_pagado: totalPaid },
    detalles: details.rows,
    pagos: payments.rows,
    historial_pagos: payments.rows,
  });
}

async function registerPayment(req, res) {
  const saleId = requireUuid(req.params.id, 'venta_id');
  const amount = requireNumber(req.body.monto, 'monto', { min: Number.EPSILON });
  const method = String(req.body.metodo_pago || '').trim().toLowerCase();
  const note = typeof req.body.referencia_nota === 'string' ? req.body.referencia_nota.trim() : '';
  if (!['efectivo', 'qr', 'tarjeta'].includes(method)) {
    throw new ApiError(400, 'El método del abono debe ser efectivo, QR o tarjeta.');
  }
  if (note.length > 500) throw new ApiError(400, 'La referencia o nota no puede superar 500 caracteres.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const saleResult = await client.query(
      'SELECT * FROM ventas WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [saleId, negocioId],
    );
    if (!saleResult.rowCount) throw new ApiError(404, 'La venta solicitada no existe.');
    const sale = saleResult.rows[0];
    if (String(sale.estado).toUpperCase() === 'ANULADA') throw new ApiError(409, 'No se puede abonar una venta anulada.');
    if (String(sale.metodo_pago).toLowerCase() !== 'credito') throw new ApiError(409, 'Solo se pueden registrar abonos para ventas a crédito.');
    const balance = roundMoney(Number(sale.saldo_pendiente || 0));
    if (balance <= 0) throw new ApiError(409, 'La deuda de esta venta ya está saldada.');
    if (amount > balance) throw new ApiError(400, 'El abono no puede superar el saldo pendiente.');

    const turnResult = await client.query(
      `SELECT id FROM turnos_caja
        WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
        ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE`,
      [negocioId],
    );
    if (!turnResult.rowCount) throw new ApiError(409, 'Abre un turno de caja para registrar el cobro.');
    const turnId = turnResult.rows[0].id;
    const remaining = roundMoney(balance - amount);
    const newState = remaining === 0 ? 'completada' : 'parcial';
    const paymentResult = await client.query(
      `INSERT INTO pagos_venta (venta_id, turno_id, usuario_id, monto, metodo_pago, referencia_nota)
       VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))
       RETURNING id, venta_id, monto, fecha_pago, metodo_pago, referencia_nota, turno_id`,
      [saleId, turnId, req.user.id, amount, method, note],
    );
    const updatedSale = await client.query(
      `UPDATE ventas SET saldo_pendiente = $1, estado = $2
        WHERE id = $3 AND negocio_id = $4 RETURNING id, total, saldo_pendiente, estado`,
      [remaining, newState, saleId, negocioId],
    );
    if (method === 'efectivo') {
      await client.query(
        'UPDATE turnos_caja SET total_efectivo_esperado = COALESCE(total_efectivo_esperado, 0) + $1 WHERE id = $2 AND negocio_id = $3',
        [amount, turnId, negocioId],
      );
    } else if (method === 'tarjeta') {
      await client.query(
        'UPDATE turnos_caja SET total_tarjeta_esperado = COALESCE(total_tarjeta_esperado, 0) + $1 WHERE id = $2 AND negocio_id = $3',
        [amount, turnId, negocioId],
      );
    } else if (method === 'qr') {
      await client.query(
        'UPDATE turnos_caja SET total_qr_esperado = COALESCE(total_qr_esperado, 0) + $1 WHERE id = $2 AND negocio_id = $3',
        [amount, turnId, negocioId],
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ pago: paymentResult.rows[0], venta: updatedSale.rows[0] });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

function readPayment(body, total, existing = null) {
  const method = String(body.metodo_pago ?? existing?.metodo_pago ?? '').trim().toLowerCase();
  if (!['efectivo', 'qr', 'tarjeta', 'mixto', 'credito'].includes(method)) {
    throw new ApiError(400, 'metodo_pago debe ser efectivo, qr, tarjeta, mixto o credito.');
  }
  const cashReceived = method === 'efectivo'
    ? requireNumber(body.monto_efectivo ?? (Number(existing?.monto_recibido) || Number(existing?.monto_efectivo) || total), 'monto_efectivo')
    : method === 'mixto'
      ? requireNumber(body.monto_efectivo ?? existing?.monto_efectivo ?? 0, 'monto_efectivo')
      : 0;
  const cash = method === 'efectivo' ? total : cashReceived;
  const qr = method === 'qr'
    ? total
    : method === 'mixto'
      ? requireNumber(body.monto_qr ?? existing?.monto_qr ?? 0, 'monto_qr')
      : 0;
  const card = method === 'tarjeta' ? total : 0;
  const credit = method === 'credito' ? total : 0;

  if (method === 'efectivo' && cashReceived < total) {
    throw new ApiError(400, 'El efectivo recibido no alcanza para cubrir el total.');
  }
  if (method === 'mixto') {
    if (cash <= 0 || qr <= 0) throw new ApiError(400, 'El pago mixto requiere montos mayores a cero en efectivo y QR.');
    if (roundMoney(cash + qr) !== total) throw new ApiError(400, 'La suma del efectivo y QR debe coincidir exactamente con el total.');
  }
  return { method, cash, qr, card, credit, cashReceived };
}

async function update(req, res) {
  const saleId = requireUuid(req.params.id, 'venta_id');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const saleResult = await client.query(
      'SELECT * FROM ventas WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [saleId, negocioId],
    );
    if (!saleResult.rowCount) throw new ApiError(404, 'La venta solicitada no existe.');
    const sale = saleResult.rows[0];
    if (String(sale.estado).toUpperCase() === 'ANULADA') {
      throw new ApiError(409, 'No se puede modificar una venta anulada.');
    }

    const oldDetails = await client.query(
      'SELECT * FROM venta_detalles WHERE venta_id = $1 ORDER BY id FOR UPDATE',
      [saleId],
    );
    const recordedPayments = await client.query(
      'SELECT COALESCE(SUM(monto), 0) AS total_pagado FROM pagos_venta WHERE venta_id = $1',
      [saleId],
    );
    const totalPaid = roundMoney(Number(recordedPayments.rows[0].total_pagado));
    if (totalPaid > 0) {
      throw new ApiError(409, 'No se puede editar una venta que ya tiene abonos registrados.');
    }
    const items = req.body.items === undefined
      ? oldDetails.rows.map((item) => ({ productId: item.producto_id, quantity: Number(item.cantidad) }))
      : readSaleItems(req.body.items);
    if (!items.length) throw new ApiError(400, 'La venta debe conservar al menos un producto.');
    const discount = requireNumber(req.body.descuento ?? sale.descuento ?? 0, 'descuento');
    const productIds = [...new Set([
      ...oldDetails.rows.map((item) => item.producto_id),
      ...items.map((item) => item.productId),
    ])].sort();
    const productsResult = await client.query(
      `SELECT id, nombre, precio_venta, precio_compra, stock_actual, activo
         FROM productos WHERE negocio_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE`,
      [negocioId, productIds],
    );
    if (productsResult.rowCount !== productIds.length) {
      throw new ApiError(400, 'Uno o más productos de la venta no existen o pertenecen a otro negocio.');
    }
    const products = new Map(productsResult.rows.map((product) => [product.id, product]));
    const oldQuantities = new Map();
    for (const item of oldDetails.rows) {
      oldQuantities.set(item.producto_id, (oldQuantities.get(item.producto_id) || 0) + Number(item.cantidad));
    }
    const oldLinesByProduct = new Map(oldDetails.rows.map((item) => [item.producto_id, item]));
    const lines = items.map((item) => {
      const product = products.get(item.productId);
      if (product.activo === false && !oldQuantities.has(item.productId)) {
        throw new ApiError(400, `El producto ${product.nombre} está inactivo.`);
      }
      const available = Number(product.stock_actual) + (oldQuantities.get(item.productId) || 0);
      if (available < item.quantity) throw new ApiError(409, `Stock insuficiente para ${product.nombre}. Disponible: ${available}.`);
      const oldLine = oldLinesByProduct.get(item.productId);
      const unitPrice = oldLine ? Number(oldLine.precio_unitario) : Number(product.precio_venta);
      const unitCost = oldLine ? Number(oldLine.costo_unitario) : Number(product.precio_compra);
      return {
        ...item,
        product,
        unitPrice,
        unitCost,
        lineTotal: roundMoney(unitPrice * item.quantity),
      };
    });
    const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.lineTotal, 0));
    if (discount > subtotal) throw new ApiError(400, 'El descuento no puede superar el subtotal.');
    const total = roundMoney(subtotal - discount);
    const payment = readPayment(req.body, total, sale);
    const customerName = String(req.body.cliente_nombre ?? sale.cliente_nombre ?? '').trim();
    const customerContact = String(req.body.cliente_contacto ?? sale.cliente_contacto ?? '').trim();
    if (customerName.length > 150 || customerContact.length > 50) {
      throw new ApiError(400, 'El nombre del cliente admite hasta 150 caracteres y el contacto hasta 50.');
    }
    if (payment.method === 'credito' && (!customerName || !customerContact)) {
      throw new ApiError(400, 'Las ventas a crédito requieren el nombre y teléfono o CI del cliente.');
    }
    if (payment.method === 'credito' && !sale.cliente_id) {
      throw new ApiError(400, 'Asocia un cliente registrado antes de cambiar esta venta a crédito.');
    }
    if (!sale.turno_id && payment.method !== 'credito') {
      throw new ApiError(409, 'No se puede convertir esta venta a un pago inmediato porque no está asociada a un turno de caja.');
    }
    let saleDate = sale.fecha_venta;
    if (req.body.fecha_venta !== undefined) {
      if (typeof req.body.fecha_venta !== 'string' || Number.isNaN(Date.parse(req.body.fecha_venta))) {
        throw new ApiError(400, 'fecha_venta debe ser una fecha válida.');
      }
      saleDate = new Date(req.body.fecha_venta);
    }

    for (const item of oldDetails.rows) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2 AND negocio_id = $3',
        [item.cantidad, item.producto_id, negocioId],
      );
    }
    await client.query('DELETE FROM venta_detalles WHERE venta_id = $1', [saleId]);
    for (const line of lines) {
      await client.query(
        `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, line.productId, line.quantity, line.unitPrice, line.unitCost, line.lineTotal],
      );
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND negocio_id = $3',
        [line.quantity, line.productId, negocioId],
      );
    }

    const updated = await client.query(
      `UPDATE ventas
          SET cliente_nombre = $1, cliente_contacto = $2, fecha_venta = $3,
              subtotal = $4, descuento = $5, total = $6, metodo_pago = $7,
              monto_efectivo = $8, monto_qr = $9, monto_tarjeta = $10, monto_credito = $11,
              monto_recibido = $12, saldo_pendiente = $13, estado = $14
        WHERE id = $15 AND negocio_id = $16 RETURNING *`,
      [
        customerName || 'Cliente General', customerContact || null, saleDate,
        subtotal, discount, total, payment.method, payment.cash,
        payment.qr, payment.card, payment.credit,
        payment.cashReceived,
        payment.method === 'credito' ? total : 0,
        payment.method === 'credito' ? 'pendiente' : 'completada',
        saleId, negocioId,
      ],
    );
    if (sale.turno_id) {
      const oldCash = Number(sale.monto_efectivo || 0);
      const oldQr = Number(sale.monto_qr || 0);
      const oldCard = Number(sale.monto_tarjeta || 0);
      await client.query(
        `UPDATE turnos_caja
            SET total_efectivo_esperado = GREATEST(0, COALESCE(total_efectivo_esperado, 0) - $1 + $2),
                total_qr_esperado = GREATEST(0, COALESCE(total_qr_esperado, 0) - $3 + $4),
                total_tarjeta_esperado = GREATEST(0, COALESCE(total_tarjeta_esperado, 0) - $5 + $6)
          WHERE id = $7 AND negocio_id = $8`,
        [oldCash, payment.cash, oldQr, payment.qr, oldCard, payment.card, sale.turno_id, negocioId],
      );
    }

    await client.query('COMMIT');
    res.json({ venta: updated.rows[0] });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function cancel(req, res) {
  const saleId = requireUuid(req.params.id, 'venta_id');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const saleResult = await client.query(
      'SELECT * FROM ventas WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [saleId, negocioId],
    );
    if (!saleResult.rowCount) throw new ApiError(404, 'La venta solicitada no existe.');
    const sale = saleResult.rows[0];
    if (String(sale.estado).toUpperCase() === 'ANULADA') {
      throw new ApiError(409, 'La venta ya está anulada.');
    }
    const payments = await client.query(
      'SELECT 1 FROM pagos_venta WHERE venta_id = $1 LIMIT 1',
      [saleId],
    );
    if (payments.rowCount) throw new ApiError(409, 'No se puede anular una venta que ya tiene abonos registrados.');
    const details = await client.query(
      'SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = $1 FOR UPDATE',
      [saleId],
    );
    for (const item of details.rows) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2 AND negocio_id = $3',
        [item.cantidad, item.producto_id, negocioId],
      );
    }
    if (sale.turno_id) {
      await client.query(
        `UPDATE turnos_caja
            SET total_efectivo_esperado = GREATEST(0, COALESCE(total_efectivo_esperado, 0) - $1),
                total_qr_esperado = GREATEST(0, COALESCE(total_qr_esperado, 0) - $2),
                total_tarjeta_esperado = GREATEST(0, COALESCE(total_tarjeta_esperado, 0) - $3)
          WHERE id = $4 AND negocio_id = $5`,
        [sale.monto_efectivo || 0, sale.monto_qr || 0, sale.monto_tarjeta || 0, sale.turno_id, negocioId],
      );
    }
    const updated = await client.query(
      `UPDATE ventas SET estado = 'ANULADA'
        WHERE id = $1 AND negocio_id = $2 RETURNING *`,
      [saleId, negocioId],
    );
    await client.query('COMMIT');
    res.json({ venta: updated.rows[0] });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { cancel, create, detail, list, registerPayment, update };
