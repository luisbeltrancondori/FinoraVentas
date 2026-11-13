const { pool } = require('../config/db');
const { ApiError, getNegocioId, requireNumber, requireUuid } = require('../utils/http');

async function kardex(req, res) {
  const businessId = await getNegocioId(req);
  const productId = req.query.producto_id ? requireUuid(req.query.producto_id, 'producto_id') : null;
  const brandId = req.query.marca_id ? requireUuid(req.query.marca_id, 'marca_id') : null;
  const supplierId = req.query.proveedor_id ? requireUuid(req.query.proveedor_id, 'proveedor_id') : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search.length > 150) throw new ApiError(400, 'La búsqueda no puede superar 150 caracteres.');
  const result = await pool.query(
    `WITH movements AS (
         SELECT 'compra'::text AS movimiento, c.id AS referencia_id, cd.id AS movement_id, p.id AS producto_id,
                p.nombre AS producto_nombre, c.fecha_compra AS fecha,
                cd.cantidad AS cantidad, p.stock_actual AS stock_actual,
                COALESCE(pr.nombre_empresa, 'Compra') AS descripcion
           FROM compra_detalles cd
           JOIN compras c ON c.id = cd.compra_id AND c.negocio_id = $1 AND c.estado <> 'anulada'
           JOIN productos p ON p.id = cd.producto_id AND p.negocio_id = $1
           LEFT JOIN proveedores pr ON pr.id = c.proveedor_id
         UNION ALL
         SELECT 'venta'::text, v.id, vd.id, p.id, p.nombre, v.fecha_venta,
                -vd.cantidad, p.stock_actual, 'Venta #' || v.numero_ticket::text
           FROM venta_detalles vd
           JOIN ventas v ON v.id = vd.venta_id AND v.negocio_id = $1 AND v.estado <> 'anulada'
           JOIN productos p ON p.id = vd.producto_id AND p.negocio_id = $1
         UNION ALL
         SELECT ia.tipo, ia.id, ia.id, p.id, p.nombre, ia.creado_en,
                ia.cantidad, p.stock_actual, ia.motivo
           FROM inventory_adjustments ia
           JOIN productos p ON p.id = ia.producto_id
          WHERE ia.negocio_id = $1 AND ia.tipo = 'ajuste'
       )
     SELECT movements.movimiento, movements.referencia_id, movements.producto_id, movements.producto_nombre, movements.fecha, movements.cantidad,
            movements.stock_actual - COALESCE(
              SUM(movements.cantidad) OVER (
                PARTITION BY movements.producto_id
                ORDER BY movements.fecha DESC, movements.referencia_id DESC, movements.movement_id DESC
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) AS saldo,
            movements.descripcion
       FROM movements
       JOIN productos p ON p.id = movements.producto_id AND p.negocio_id = $1
      WHERE ($2::uuid IS NULL OR movements.producto_id = $2)
        AND ($3::uuid IS NULL OR p.marca_id = $3)
        AND ($4::uuid IS NULL OR p.proveedor_id = $4)
        AND ($5 = '' OR p.nombre ILIKE '%' || $5 || '%' OR COALESCE(p.codigo_barras, '') ILIKE '%' || $5 || '%')
      ORDER BY movements.fecha DESC, movements.referencia_id DESC, movements.movement_id DESC LIMIT 500`,
    [businessId, productId, brandId, supplierId, search],
  );
  res.json(result.rows);
}

async function kardexKpis(req, res) {
  const businessId = await getNegocioId(req);
  const productId = req.query.producto_id ? requireUuid(req.query.producto_id, 'producto_id') : null;
  const brandId = req.query.marca_id ? requireUuid(req.query.marca_id, 'marca_id') : null;
  const supplierId = req.query.proveedor_id ? requireUuid(req.query.proveedor_id, 'proveedor_id') : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search.length > 150) throw new ApiError(400, 'La búsqueda no puede superar 150 caracteres.');
  const result = await pool.query(
    `WITH filtered_products AS (
       SELECT p.id, p.stock_actual
         FROM productos p
        WHERE p.negocio_id = $1
          AND ($2::uuid IS NULL OR p.id = $2)
          AND ($3::uuid IS NULL OR p.marca_id = $3)
          AND ($4::uuid IS NULL OR p.proveedor_id = $4)
          AND ($5 = '' OR p.nombre ILIKE '%' || $5 || '%' OR COALESCE(p.codigo_barras, '') ILIKE '%' || $5 || '%')
     )
     SELECT COALESCE((
              SELECT SUM(vd.cantidad)
                FROM venta_detalles vd
                JOIN ventas v ON v.id = vd.venta_id AND v.negocio_id = $1 AND v.estado <> 'anulada'
                JOIN filtered_products fp ON fp.id = vd.producto_id
            ), 0)::numeric AS total_vendido,
            COALESCE((SELECT SUM(stock_actual) FROM filtered_products), 0)::numeric AS saldo_fisico,
            (SELECT COUNT(*)::int
               FROM lotes l
               JOIN compra_detalles cd ON cd.id = l.compra_detalle_id
               JOIN compras c ON c.id = cd.compra_id AND c.negocio_id = $1
               JOIN filtered_products fp ON fp.id = l.producto_id
              WHERE l.negocio_id = $1 AND l.cantidad > 0 AND c.estado <> 'anulada') AS cantidad_lotes`,
    [businessId, productId, brandId, supplierId, search],
  );
  res.json(result.rows[0]);
}

async function physicalCount(req, res) {
  const businessId = await getNegocioId(req);
  const reason = typeof req.body.motivo === 'string' && req.body.motivo.trim()
    ? req.body.motivo.trim()
    : 'Conteo físico masivo';
  if (reason.length > 300) throw new ApiError(400, 'El motivo no puede superar 300 caracteres.');
  const details = req.body.detalles;
  if (!Array.isArray(details) || details.length === 0 || details.length > 10000) {
    throw new ApiError(400, 'El inventario debe incluir entre 1 y 10000 productos contados.');
  }
  const counted = details.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ApiError(400, 'Cada detalle de inventario debe ser válido.');
    }
    return {
      productId: requireUuid(item.producto_id, 'producto_id'),
      countedStock: requireNumber(item.saldo_contado, 'saldo_contado'),
    };
  });
  const productIds = counted.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError(400, 'No se puede incluir el mismo producto más de una vez en el reporte.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const products = await client.query(
      `SELECT p.id, p.codigo_barras, p.nombre, COALESCE(ps.nombre, '') AS presentacion,
              p.stock_actual, p.precio_compra
         FROM productos p
         LEFT JOIN presentaciones ps ON ps.id = p.presentacion_id AND ps.negocio_id = p.negocio_id
        WHERE p.id = ANY($1::uuid[]) AND p.negocio_id = $2 AND p.activo IS DISTINCT FROM FALSE
        ORDER BY p.id FOR SHARE OF p`,
      [productIds, businessId],
    );
    if (products.rowCount !== productIds.length) {
      throw new ApiError(404, 'Uno o más productos no existen o están inactivos en esta sucursal.');
    }
    const productsById = new Map(products.rows.map((product) => [product.id, product]));
    const report = await client.query(
      `INSERT INTO inventarios_fisicos (negocio_id, usuario_id, motivo)
       VALUES ($1, $2, $3)
       RETURNING id, creado_en`,
      [businessId, req.user.id, reason],
    );
    const snapshots = counted.map((item) => {
      const product = productsById.get(item.productId);
      const systemStock = Number(product.stock_actual);
      return {
        productId: item.productId,
        barcode: product.codigo_barras,
        name: product.nombre,
        presentation: product.presentacion,
        systemStock,
        countedStock: item.countedStock,
        difference: Number((item.countedStock - systemStock).toFixed(2)),
        unitCost: Number(product.precio_compra),
      };
    });
    const inserted = await client.query(
      `INSERT INTO inventarios_fisicos_detalle
         (inventario_fisico_id, producto_id, codigo_barras, producto_nombre, presentacion,
          saldo_sistema, saldo_contado, diferencia, costo_unitario)
       SELECT $1, input_rows.producto_id, input_rows.codigo_barras, input_rows.producto_nombre, input_rows.presentacion,
              input_rows.saldo_sistema, input_rows.saldo_contado, input_rows.diferencia, input_rows.costo_unitario
         FROM UNNEST(
           $2::uuid[], $3::text[], $4::text[], $5::text[],
           $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[]
         ) AS input_rows(producto_id, codigo_barras, producto_nombre, presentacion,
                         saldo_sistema, saldo_contado, diferencia, costo_unitario)
       RETURNING id, producto_id, codigo_barras, producto_nombre, presentacion,
                 saldo_sistema, saldo_contado, diferencia, costo_unitario`,
      [
        report.rows[0].id,
        snapshots.map((row) => row.productId),
        snapshots.map((row) => row.barcode),
        snapshots.map((row) => row.name),
        snapshots.map((row) => row.presentation),
        snapshots.map((row) => row.systemStock),
        snapshots.map((row) => row.countedStock),
        snapshots.map((row) => row.difference),
        snapshots.map((row) => row.unitCost),
      ],
    );
    await client.query('COMMIT');
    res.status(201).json({ ...report.rows[0], motivo: reason, detalles: inserted.rows });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('No se pudo revertir el reporte de inventario físico:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function physicalReports(req, res) {
  const businessId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT r.id, r.creado_en, r.motivo, u.nombre AS usuario_nombre,
            COALESCE(
              json_agg(json_build_object(
                'producto_id', d.producto_id,
                'codigo_barras', d.codigo_barras,
                'producto_nombre', d.producto_nombre,
                'presentacion', d.presentacion,
                'saldo_sistema', d.saldo_sistema,
                'saldo_contado', d.saldo_contado,
                'diferencia', d.diferencia,
                'costo_unitario', d.costo_unitario
              ) ORDER BY d.producto_nombre) FILTER (WHERE d.id IS NOT NULL),
              '[]'::json
            ) AS detalles
       FROM inventarios_fisicos r
       JOIN pos_users u ON u.id = r.usuario_id
       LEFT JOIN inventarios_fisicos_detalle d ON d.inventario_fisico_id = r.id
      WHERE r.negocio_id = $1
      GROUP BY r.id, u.nombre
      ORDER BY r.creado_en DESC
      LIMIT 100`,
    [businessId],
  );
  res.json(result.rows);
}

async function preparePhysicalInventory(req, res) {
  const businessId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT p.id, p.codigo_barras, p.nombre,
            COALESCE(ps.nombre, '') AS presentacion,
            p.stock_actual AS stock_sistema,
            p.precio_compra AS costo
       FROM productos p
       LEFT JOIN presentaciones ps ON ps.id = p.presentacion_id AND ps.negocio_id = p.negocio_id
      WHERE p.negocio_id = $1 AND p.activo IS DISTINCT FROM FALSE
      ORDER BY p.nombre, p.codigo_barras NULLS LAST`,
    [businessId],
  );
  res.json(result.rows);
}

async function createAdjustment(req, res) {
  const businessId = await getNegocioId(req);
  const productId = requireUuid(req.body.producto_id, 'producto_id');
  const amount = requireNumber(req.body.cantidad, 'cantidad', { min: Number.EPSILON });
  const type = req.body.tipo;
  if (!['positivo', 'negativo'].includes(type)) {
    throw new ApiError(400, 'tipo debe ser positivo o negativo.');
  }
  const reason = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!reason || reason.length > 300) throw new ApiError(400, 'Indica un motivo de hasta 300 caracteres.');
  const signedAmount = type === 'positivo' ? amount : -amount;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const product = await client.query(
      `SELECT id, nombre, stock_actual FROM productos
        WHERE id = $1 AND negocio_id = $2 AND activo IS DISTINCT FROM FALSE
        FOR UPDATE`,
      [productId, businessId],
    );
    if (!product.rowCount) throw new ApiError(404, 'El producto no existe o está inactivo en esta sucursal.');
    const stockBefore = Number(product.rows[0].stock_actual);
    const stockAfter = Number((stockBefore + signedAmount).toFixed(2));
    if (stockAfter < 0) throw new ApiError(400, 'El ajuste negativo supera el stock disponible.');
    await client.query(
      'UPDATE productos SET stock_actual = $1 WHERE id = $2 AND negocio_id = $3',
      [stockAfter, productId, businessId],
    );
    const adjustment = await client.query(
      `INSERT INTO inventory_adjustments
         (negocio_id, producto_id, usuario_id, tipo, stock_anterior, cantidad, stock_nuevo, motivo)
       VALUES ($1, $2, $3, 'ajuste', $4, $5, $6, $7)
       RETURNING id, tipo, stock_anterior, cantidad, stock_nuevo, motivo, creado_en`,
      [businessId, productId, req.user.id, stockBefore, signedAmount, stockAfter, reason],
    );
    await client.query('COMMIT');
    res.status(201).json({
      ...adjustment.rows[0],
      producto_id: productId,
      producto_nombre: product.rows[0].nombre,
      usuario_nombre: req.user.nombre,
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('No se pudo revertir el ajuste de inventario:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function listAdjustments(req, res) {
  const businessId = await getNegocioId(req);
  const type = req.query.tipo;
  if (type && !['positivo', 'negativo'].includes(type)) {
    throw new ApiError(400, 'tipo debe ser positivo o negativo.');
  }
  const result = await pool.query(
    `SELECT ia.id, ia.producto_id, p.nombre AS producto_nombre, ia.tipo,
            ia.stock_anterior, ia.cantidad, ia.stock_nuevo, ia.motivo, ia.creado_en,
            u.nombre AS usuario_nombre,
            CASE WHEN ia.cantidad > 0 THEN 'positivo' ELSE 'negativo' END AS direccion
       FROM inventory_adjustments ia
       JOIN productos p ON p.id = ia.producto_id AND p.negocio_id = ia.negocio_id
       JOIN pos_users u ON u.id = ia.usuario_id
      WHERE ia.negocio_id = $1 AND ia.tipo = 'ajuste'
        AND ($2::text IS NULL OR ($2 = 'positivo' AND ia.cantidad > 0) OR ($2 = 'negativo' AND ia.cantidad < 0))
      ORDER BY ia.creado_en DESC
      LIMIT 500`,
    [businessId, type || null],
  );
  res.json(result.rows);
}

async function inventoryNotifications(req, res) {
  const businessId = await getNegocioId(req);
  const [expiringResult, lowStockResult] = await Promise.all([
    pool.query(
      `SELECT p.id AS producto_id, p.nombre AS producto_nombre,
              l.fecha_vencimiento, l.cantidad AS stock_lote,
              GREATEST(l.fecha_vencimiento - CURRENT_DATE, 0)::int AS dias_restantes
         FROM lotes l
         JOIN compra_detalles cd ON cd.id = l.compra_detalle_id
         JOIN compras c ON c.id = cd.compra_id AND c.negocio_id = $1 AND c.estado <> 'anulada'
         JOIN productos p ON p.id = l.producto_id AND p.negocio_id = $1
        WHERE l.negocio_id = $1 AND l.cantidad > 0
          AND l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ORDER BY l.fecha_vencimiento ASC, p.nombre
        LIMIT 20`,
      [businessId],
    ),
    pool.query(
      `SELECT id AS producto_id, nombre AS producto_nombre,
              stock_actual, stock_minimo
         FROM productos
        WHERE negocio_id = $1 AND activo IS DISTINCT FROM FALSE
          AND stock_actual <= stock_minimo
        ORDER BY stock_actual ASC, nombre
        LIMIT 20`,
      [businessId],
    ),
  ]);
  res.json({
    vencimientos: expiringResult.rows,
    bajo_stock: lowStockResult.rows,
  });
}

module.exports = {
  createAdjustment,
  inventoryNotifications,
  kardex,
  kardexKpis,
  listAdjustments,
  physicalCount,
  physicalReports,
  preparePhysicalInventory,
};
