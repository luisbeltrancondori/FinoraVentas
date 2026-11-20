const { pool } = require('../config/db');
const {
  ApiError,
  getNegocioId,
  readPurchaseItems,
  requireNumber,
  requireUuid,
  rollback,
  roundMoney,
} = require('../utils/http');

const paymentMethods = ['efectivo', 'transferencia', 'credito'];
const paymentReceiptMethods = ['efectivo', 'transferencia'];

async function suggested(req, res) {
  const requestedBranchId = req.query.sucursal_id;
  if (requestedBranchId) {
    const branchId = requireUuid(requestedBranchId, 'sucursal_id');
    const headerBusinessId = req.get('x-negocio-id');
    if (headerBusinessId && headerBusinessId.toLowerCase() !== branchId.toLowerCase()) {
      throw new ApiError(400, 'sucursal_id debe coincidir con la sucursal activa.');
    }
    req.query.negocio_id = branchId;
  }
  const negocioId = await getNegocioId(req);
  const daysCoverage = req.query.dias_cobertura === undefined ? 7 : Number(req.query.dias_cobertura);
  if (!Number.isInteger(daysCoverage) || daysCoverage < 1 || daysCoverage > 365) {
    throw new ApiError(400, 'dias_cobertura debe ser un número entero entre 1 y 365.');
  }

  const result = await pool.query(
    `WITH sales_30_days AS (
       SELECT vd.producto_id,
              SUM(vd.cantidad) AS units_sold,
              MIN(v.fecha_venta)::date AS first_sale_date
         FROM ventas v
         JOIN venta_detalles vd ON vd.venta_id = v.id
        WHERE v.negocio_id = $1
          AND UPPER(v.estado) <> 'ANULADA'
          AND v.fecha_venta >= CURRENT_DATE - INTERVAL '30 days'
          AND v.fecha_venta < CURRENT_DATE + INTERVAL '1 day'
        GROUP BY vd.producto_id
     ),
     product_sales AS (
       SELECT p.id AS producto_id,
              p.nombre AS producto_nombre,
              p.proveedor_id,
              COALESCE(pr.nombre_empresa, 'Sin proveedor') AS proveedor_nombre,
              p.stock_actual,
              COALESCE(p.stock_minimo, 0) AS stock_minimo,
              p.precio_compra AS costo_unitario,
              p.fecha_vencimiento,
              COALESCE(s.units_sold, 0) AS units_sold,
              CASE
                WHEN s.first_sale_date IS NULL THEN 0
                ELSE COALESCE(s.units_sold, 0) /
                     CASE
                       WHEN s.first_sale_date > CURRENT_DATE - INTERVAL '30 days'
                         THEN GREATEST(CURRENT_DATE - s.first_sale_date, 1)
                       ELSE 30
                     END
              END AS consumo_diario
         FROM productos p
         LEFT JOIN proveedores pr
           ON pr.id = p.proveedor_id AND pr.negocio_id = p.negocio_id
         LEFT JOIN sales_30_days s ON s.producto_id = p.id
        WHERE p.negocio_id = $1
          AND p.activo IS DISTINCT FROM FALSE
     ),
     recommendations AS (
       SELECT producto_id, producto_nombre, proveedor_id, proveedor_nombre,
              stock_actual, stock_minimo, costo_unitario, fecha_vencimiento,
              consumo_diario,
              CASE WHEN consumo_diario > 0 THEN stock_actual / consumo_diario END AS dias_restantes,
              GREATEST(CEIL((consumo_diario * $2) + stock_minimo - stock_actual), 0)::int AS cantidad_sugerida
         FROM product_sales
     )
     SELECT producto_id, producto_nombre, proveedor_id, proveedor_nombre,
            stock_actual, stock_minimo, costo_unitario, fecha_vencimiento,
            consumo_diario, dias_restantes, cantidad_sugerida
       FROM recommendations
      WHERE stock_actual <= stock_minimo
         OR dias_restantes <= $2
      ORDER BY dias_restantes ASC NULLS LAST, stock_actual ASC, producto_nombre`,
    [negocioId, daysCoverage],
  );
  res.json({ dias_cobertura: daysCoverage, sugerencias: result.rows });
}

async function list(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT c.*, p.nombre_empresa AS proveedor_nombre, p.nit_ci AS proveedor_nit_ci,
            COALESCE(pay.total_pagado, 0) AS total_pagado,
            COALESCE(pay.pagos, '[]'::json) AS pagos,
            COALESCE((
              SELECT json_agg(json_build_object(
                'producto_id', d.producto_id,
                'nombre', pr.nombre,
                'cantidad', d.cantidad,
                'precio_costo_unitario', d.precio_costo_unitario,
                'fecha_vencimiento', d.fecha_vencimiento,
                'subtotal', d.subtotal
              ) ORDER BY d.id)
                FROM compra_detalles d
                LEFT JOIN productos pr ON pr.id = d.producto_id
               WHERE d.compra_id = c.id
            ), '[]'::json) AS detalles
       FROM compras c
       LEFT JOIN proveedores p ON p.id = c.proveedor_id
       LEFT JOIN LATERAL (
         SELECT SUM(pc.monto) AS total_pagado,
                json_agg(json_build_object(
                  'id', pc.id, 'monto', pc.monto, 'fecha_pago', pc.fecha_pago,
                  'metodo_pago', pc.metodo_pago, 'referencia', pc.referencia
                ) ORDER BY pc.fecha_pago, pc.id) AS pagos
           FROM pagos_compra pc WHERE pc.compra_id = c.id
       ) pay ON TRUE
      WHERE c.negocio_id = $1
      ORDER BY c.fecha_compra DESC`,
    [negocioId],
  );
  res.json(result.rows);
}

async function detail(req, res) {
  const negocioId = await getNegocioId(req);
  const purchaseId = requireUuid(req.params.id, 'compra_id');
  const purchase = await pool.query(
    `SELECT c.*, p.nombre_empresa AS proveedor_nombre, p.nit_ci AS proveedor_nit_ci,
            p.telefono AS proveedor_telefono,
            COALESCE(pay.total_pagado, 0) AS total_pagado
       FROM compras c
       LEFT JOIN proveedores p ON p.id = c.proveedor_id
       LEFT JOIN LATERAL (
         SELECT SUM(monto) AS total_pagado FROM pagos_compra WHERE compra_id = c.id
       ) pay ON TRUE
      WHERE c.id = $1 AND c.negocio_id = $2`,
    [purchaseId, negocioId],
  );
  if (!purchase.rowCount) throw new ApiError(404, 'La compra solicitada no existe.');
  const [details, payments] = await Promise.all([
    pool.query(
      `SELECT d.id, d.producto_id, p.nombre, p.codigo_barras,
              d.cantidad, d.precio_costo_unitario, d.fecha_vencimiento, d.subtotal
         FROM compra_detalles d
         JOIN compras c ON c.id = d.compra_id
         LEFT JOIN productos p ON p.id = d.producto_id
        WHERE d.compra_id = $1 AND c.negocio_id = $2 ORDER BY d.id`,
      [purchaseId, negocioId],
    ),
    pool.query(
      `SELECT id, monto, fecha_pago, metodo_pago, referencia
         FROM pagos_compra WHERE compra_id = $1 ORDER BY fecha_pago, id`,
      [purchaseId],
    ),
  ]);
  res.json({ compra: purchase.rows[0], detalles: details.rows, pagos: payments.rows });
}

function getSupplierId(value) {
  return value == null || value === '' ? null : requireUuid(value, 'proveedor_id');
}

function readPaymentMethod(value) {
  const method = String(value || 'efectivo').trim().toLowerCase();
  if (!paymentMethods.includes(method)) {
    throw new ApiError(400, 'metodo_pago debe ser efectivo, transferencia o credito.');
  }
  return method;
}

async function validateSupplier(client, supplierId, negocioId) {
  if (!supplierId) return null;
  const result = await client.query(
    'SELECT id, nombre_empresa, nit_ci, telefono FROM proveedores WHERE id = $1 AND negocio_id = $2',
    [supplierId, negocioId],
  );
  if (!result.rowCount) throw new ApiError(400, 'El proveedor no pertenece al negocio seleccionado.');
  return result.rows[0];
}

async function lockProducts(client, negocioId, productIds) {
  const ids = [...new Set(productIds)].sort();
  const result = await client.query(
    `SELECT id, nombre, stock_actual, precio_compra, fecha_vencimiento
       FROM productos
      WHERE negocio_id = $1 AND id = ANY($2::uuid[])
      ORDER BY id FOR UPDATE`,
    [negocioId, ids],
  );
  if (result.rowCount !== ids.length) {
    throw new ApiError(400, 'Uno o más productos no existen o pertenecen a otro negocio.');
  }
  return new Map(result.rows.map((product) => [product.id, product]));
}

async function reverseInventory(client, negocioId, purchaseId, details, products) {
  const quantities = new Map();
  for (const item of details) {
    quantities.set(item.producto_id, (quantities.get(item.producto_id) || 0) + Number(item.cantidad));
  }
  for (const [productId, quantity] of quantities) {
    const product = products.get(productId);
    if (Number(product.stock_actual) + 1e-8 < quantity) {
      throw new ApiError(409, `No se puede revertir la compra: stock insuficiente de ${product.nombre}. Disponible: ${product.stock_actual}, a revertir: ${quantity}.`);
    }

    const latestLot = await client.query(
      `SELECT l.*, d.compra_id
         FROM lotes l
         JOIN compra_detalles d ON d.id = l.compra_detalle_id
         JOIN compras c ON c.id = d.compra_id
        WHERE l.negocio_id = $1 AND l.producto_id = $2 AND c.estado <> 'anulada'
        ORDER BY l.created_at DESC, l.id DESC LIMIT 1`,
      [negocioId, productId],
    );
    const purchaseIsLatest = latestLot.rowCount && latestLot.rows[0].compra_id === purchaseId;
    if (purchaseIsLatest) {
      const previousLot = await client.query(
        `SELECT l.costo_anterior, l.fecha_vencimiento_anterior
           FROM lotes l
           JOIN compra_detalles d ON d.id = l.compra_detalle_id
          WHERE d.compra_id = $1 AND l.producto_id = $2
          ORDER BY l.created_at ASC, l.id ASC LIMIT 1`,
        [purchaseId, productId],
      );
      const earlierLot = await client.query(
        `SELECT l.costo_unitario, l.fecha_vencimiento
           FROM lotes l
           JOIN compra_detalles d ON d.id = l.compra_detalle_id
           JOIN compras c ON c.id = d.compra_id
          WHERE l.negocio_id = $1 AND l.producto_id = $2
            AND d.compra_id <> $3 AND c.estado <> 'anulada'
          ORDER BY l.created_at DESC, l.id DESC LIMIT 1`,
        [negocioId, productId, purchaseId],
      );
      const oldSnapshot = previousLot.rows[0];
      const restoredCost = earlierLot.rowCount
        ? Number(earlierLot.rows[0].costo_unitario)
        : oldSnapshot?.costo_anterior == null ? Number(product.precio_compra) : Number(oldSnapshot.costo_anterior);
      const restoredExpiration = earlierLot.rowCount
        ? earlierLot.rows[0].fecha_vencimiento
        : oldSnapshot?.fecha_vencimiento_anterior ?? null;
      await client.query(
        `UPDATE productos
            SET stock_actual = stock_actual - $1,
                precio_compra = COALESCE($2, precio_compra),
                fecha_vencimiento = $3
          WHERE id = $4 AND negocio_id = $5`,
        [
          quantity,
          restoredCost,
          restoredExpiration,
          productId,
          negocioId,
        ],
      );
      product.precio_compra = restoredCost;
      product.fecha_vencimiento = restoredExpiration;
    } else {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND negocio_id = $3',
        [quantity, productId, negocioId],
      );
    }
    product.stock_actual = Number(product.stock_actual) - quantity;
  }
}

async function addInventoryLines(client, negocioId, purchaseId, lines, products) {
  const receiptLines = [];
  for (const line of lines) {
    const product = products.get(line.productId);
    const detailResult = await client.query(
      `INSERT INTO compra_detalles
         (compra_id, producto_id, cantidad, precio_costo_unitario, fecha_vencimiento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [purchaseId, line.productId, line.quantity, line.unitCost, line.expirationDate, line.lineTotal],
    );
    await client.query(
      `INSERT INTO lotes
         (negocio_id, compra_detalle_id, producto_id, cantidad, fecha_vencimiento,
          costo_unitario, costo_anterior, fecha_vencimiento_anterior, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, clock_timestamp())`,
      [
        negocioId, detailResult.rows[0].id, line.productId, line.quantity,
        line.expirationDate, line.unitCost, product.precio_compra, product.fecha_vencimiento,
      ],
    );
    await client.query(
      `UPDATE productos
          SET stock_actual = stock_actual + $1,
              precio_compra = $2,
              fecha_vencimiento = COALESCE($3::date, fecha_vencimiento)
        WHERE id = $4 AND negocio_id = $5`,
      [line.quantity, line.unitCost, line.expirationDate, line.productId, negocioId],
    );
    product.stock_actual = Number(product.stock_actual) + line.quantity;
    product.precio_compra = line.unitCost;
    product.fecha_vencimiento = line.expirationDate || product.fecha_vencimiento;
    receiptLines.push({ ...detailResult.rows[0], nombre: product.nombre });
  }
  return receiptLines;
}

function calculateTotals(items, discountValue) {
  const lines = items.map((item) => ({ ...item, lineTotal: roundMoney(item.quantity * item.unitCost) }));
  const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = requireNumber(discountValue ?? 0, 'descuento');
  if (discount > subtotal) throw new ApiError(400, 'El descuento no puede superar el subtotal.');
  return { lines, subtotal, discount, total: roundMoney(subtotal - discount) };
}

async function create(req, res) {
  const items = readPurchaseItems(req.body.items || req.body.detalles);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const supplierId = getSupplierId(req.body.proveedor_id);
    const method = readPaymentMethod(req.body.metodo_pago);
    if (method === 'credito' && !supplierId) {
      throw new ApiError(400, 'Selecciona un proveedor para registrar una compra a crédito.');
    }
    const supplier = await validateSupplier(client, supplierId, negocioId);
    const products = await lockProducts(client, negocioId, items.map((item) => item.productId));
    const { lines, subtotal, discount, total } = calculateTotals(items, req.body.descuento);
    const state = method === 'credito' ? (total > 0 ? 'pendiente' : 'pagada') : 'pagada';
    const balance = method === 'credito' ? total : 0;
    const result = await client.query(
      `INSERT INTO compras
         (negocio_id, proveedor_id, numero_factura, subtotal, descuento, total,
          metodo_pago, estado, saldo_pendiente, observaciones, usuario_id)
       VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9, NULLIF($10, ''), $11)
       RETURNING *`,
      [
        negocioId, supplierId, String(req.body.numero_factura || '').trim(), subtotal, discount,
        total, method, state, balance, String(req.body.observaciones || '').trim(), req.user.id,
      ],
    );
    const purchase = result.rows[0];
    const details = await addInventoryLines(client, negocioId, purchase.id, lines, products);
    let payments = [];
    if (method !== 'credito' && total > 0) {
      const payment = await client.query(
        `INSERT INTO pagos_compra (compra_id, usuario_id, monto, metodo_pago, referencia)
         VALUES ($1, $2, $3, $4, NULLIF($5, ''))
         RETURNING id, monto, fecha_pago, metodo_pago, referencia`,
        [purchase.id, req.user.id, total, method, 'Pago al registrar la compra'],
      );
      payments = payment.rows;
    }
    await client.query('COMMIT');
    res.status(201).json({ compra: purchase, proveedor: supplier, detalles: details, pagos: payments });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const purchaseId = requireUuid(req.params.id, 'compra_id');
  const items = readPurchaseItems(req.body.items || req.body.detalles);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const purchaseResult = await client.query(
      'SELECT * FROM compras WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [purchaseId, negocioId],
    );
    if (!purchaseResult.rowCount) throw new ApiError(404, 'La compra solicitada no existe.');
    const purchase = purchaseResult.rows[0];
    if (purchase.estado === 'anulada') throw new ApiError(409, 'No se puede editar una compra anulada.');
    const existingPayments = await client.query(
      'SELECT 1 FROM pagos_compra WHERE compra_id = $1 LIMIT 1',
      [purchaseId],
    );
    if (existingPayments.rowCount) {
      throw new ApiError(409, 'No se puede editar una compra con pagos registrados. Anúlala y registra una nueva compra.');
    }
    const oldDetails = await client.query(
      'SELECT * FROM compra_detalles WHERE compra_id = $1 ORDER BY id FOR UPDATE',
      [purchaseId],
    );
    const supplierId = getSupplierId(req.body.proveedor_id);
    const method = readPaymentMethod(req.body.metodo_pago || purchase.metodo_pago);
    if (method === 'credito' && !supplierId) {
      throw new ApiError(400, 'Selecciona un proveedor para registrar una compra a crédito.');
    }
    const supplier = await validateSupplier(client, supplierId, negocioId);
    const productIds = [
      ...oldDetails.rows.map((item) => item.producto_id),
      ...items.map((item) => item.productId),
    ];
    const products = await lockProducts(client, negocioId, productIds);
    await reverseInventory(client, negocioId, purchaseId, oldDetails.rows, products);
    await client.query('DELETE FROM compra_detalles WHERE compra_id = $1', [purchaseId]);
    const { lines, subtotal, discount, total } = calculateTotals(items, req.body.descuento ?? purchase.descuento);
    const state = method === 'credito' && total > 0 ? 'pendiente' : 'pagada';
    const balance = state === 'pendiente' ? total : 0;
    const updated = await client.query(
      `UPDATE compras
          SET proveedor_id = $1, numero_factura = NULLIF($2, ''), subtotal = $3,
              descuento = $4, total = $5, metodo_pago = $6, estado = $7,
              saldo_pendiente = $8, observaciones = NULLIF($9, '')
        WHERE id = $10 AND negocio_id = $11 RETURNING *`,
      [
        supplierId, String(req.body.numero_factura ?? purchase.numero_factura ?? '').trim(),
        subtotal, discount, total, method, state, balance,
        String(req.body.observaciones ?? purchase.observaciones ?? '').trim(), purchaseId, negocioId,
      ],
    );
    const details = await addInventoryLines(client, negocioId, purchaseId, lines, products);
    let payments = [];
    if (method !== 'credito' && total > 0) {
      const payment = await client.query(
        `INSERT INTO pagos_compra (compra_id, usuario_id, monto, metodo_pago, referencia)
         VALUES ($1, $2, $3, $4, NULLIF($5, ''))
         RETURNING id, monto, fecha_pago, metodo_pago, referencia`,
        [purchaseId, req.user.id, total, method, 'Pago al actualizar la compra'],
      );
      payments = payment.rows;
    }
    await client.query('COMMIT');
    res.json({ compra: updated.rows[0], proveedor: supplier, detalles: details, pagos: payments });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function remove(req, res) {
  const purchaseId = requireUuid(req.params.id, 'compra_id');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const result = await client.query(
      'SELECT * FROM compras WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [purchaseId, negocioId],
    );
    if (!result.rowCount) throw new ApiError(404, 'La compra solicitada no existe.');
    const purchase = result.rows[0];
    if (purchase.estado === 'anulada') throw new ApiError(409, 'La compra ya está anulada.');
    const payments = await client.query(
      'SELECT 1 FROM pagos_compra WHERE compra_id = $1 LIMIT 1',
      [purchaseId],
    );
    if (payments.rowCount) {
      throw new ApiError(409, 'Esta compra tiene pagos registrados y no se puede eliminar. Usa "Anular compra" para conservar el historial.');
    }
    const details = await client.query(
      'SELECT * FROM compra_detalles WHERE compra_id = $1 ORDER BY id FOR UPDATE',
      [purchaseId],
    );
    const products = await lockProducts(client, negocioId, details.rows.map((item) => item.producto_id));
    await reverseInventory(client, negocioId, purchaseId, details.rows, products);
    await client.query('DELETE FROM compras WHERE id = $1 AND negocio_id = $2', [purchaseId, negocioId]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function cancel(req, res) {
  const purchaseId = requireUuid(req.params.id, 'compra_id');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const result = await client.query(
      'SELECT * FROM compras WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [purchaseId, negocioId],
    );
    if (!result.rowCount) throw new ApiError(404, 'La compra solicitada no existe.');
    const purchase = result.rows[0];
    if (purchase.estado === 'anulada') throw new ApiError(409, 'La compra ya está anulada.');
    const existingPayments = await client.query(
      'SELECT 1 FROM pagos_compra WHERE compra_id = $1 LIMIT 1',
      [purchaseId],
    );
    if (existingPayments.rowCount) {
      throw new ApiError(409, 'Esta compra tiene pagos registrados y no puede anularse. Revierta los pagos antes de anularla.');
    }
    const details = await client.query(
      'SELECT * FROM compra_detalles WHERE compra_id = $1 ORDER BY id FOR UPDATE',
      [purchaseId],
    );
    const products = await lockProducts(client, negocioId, details.rows.map((item) => item.producto_id));
    await reverseInventory(client, negocioId, purchaseId, details.rows, products);
    const canceled = await client.query(
      `UPDATE compras SET estado = 'anulada', saldo_pendiente = 0
        WHERE id = $1 AND negocio_id = $2 RETURNING *`,
      [purchaseId, negocioId],
    );
    await client.query('COMMIT');
    res.json({ compra: canceled.rows[0] });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function registerPayment(req, res) {
  const purchaseId = requireUuid(req.params.id, 'compra_id');
  const amount = requireNumber(req.body.monto, 'monto', { min: Number.EPSILON });
  const method = String(req.body.metodo_pago || '').trim().toLowerCase();
  const reference = typeof req.body.referencia === 'string' ? req.body.referencia.trim() : '';
  if (!paymentReceiptMethods.includes(method)) {
    throw new ApiError(400, 'El método del abono debe ser efectivo o transferencia.');
  }
  if (reference.length > 500) throw new ApiError(400, 'La referencia no puede superar 500 caracteres.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const result = await client.query(
      'SELECT * FROM compras WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [purchaseId, negocioId],
    );
    if (!result.rowCount) throw new ApiError(404, 'La compra solicitada no existe.');
    const purchase = result.rows[0];
    if (purchase.estado === 'anulada') throw new ApiError(409, 'No se puede pagar una compra anulada.');
    if (purchase.metodo_pago !== 'credito') throw new ApiError(409, 'Solo se pueden registrar abonos para compras a crédito.');

    // TRX-03: Verificar turno de caja abierto cuando el pago es en efectivo
    const turnResult = await client.query(
      `SELECT id FROM turnos_caja
        WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
        ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE`,
      [negocioId],
    );
    if (method === 'efectivo' && !turnResult.rowCount) {
      throw new ApiError(409, 'Debes tener una caja abierta para registrar pagos en efectivo a proveedores.');
    }
    const activeTurn = turnResult.rows[0] || null;

    const balance = roundMoney(Number(purchase.saldo_pendiente || 0));
    if (balance <= 0) throw new ApiError(409, 'La deuda de esta compra ya está pagada.');
    if (amount > balance) throw new ApiError(400, 'El abono no puede superar el saldo pendiente.');
    const remaining = roundMoney(balance - amount);
    const state = remaining === 0 ? 'pagada' : 'parcial';
    const payment = await client.query(
      `INSERT INTO pagos_compra (compra_id, usuario_id, monto, metodo_pago, referencia)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''))
       RETURNING id, compra_id, monto, fecha_pago, metodo_pago, referencia`,
      [purchaseId, req.user.id, amount, method, reference],
    );
    const updated = await client.query(
      `UPDATE compras SET saldo_pendiente = $1, estado = $2
        WHERE id = $3 AND negocio_id = $4
        RETURNING id, total, saldo_pendiente, estado`,
      [remaining, state, purchaseId, negocioId],
    );
    // TRX-03: Registrar egreso en el turno de caja si el pago fue en efectivo
    if (method === 'efectivo' && activeTurn) {
      await client.query(
        `UPDATE turnos_caja
            SET total_egresos_proveedores = total_egresos_proveedores + $1
          WHERE id = $2`,
        [amount, activeTurn.id],
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ pago: payment.rows[0], compra: updated.rows[0] });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { cancel, create, detail, list, registerPayment, remove, suggested, update };
