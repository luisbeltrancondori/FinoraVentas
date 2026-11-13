const { pool } = require('../config/db');
const { ApiError, getNegocioId } = require('../utils/http');

async function summary(req, res) {
  const negocioId = await getNegocioId(req);
  const [metrics, sellers, payments, bestSellers, bestMargins, expirations, cashTurns, salesTime] = await Promise.all([
    pool.query(
      `WITH month_sales AS (
         SELECT v.id, v.total
           FROM ventas v
          WHERE v.negocio_id = $1
            AND v.fecha_venta >= DATE_TRUNC('month', CURRENT_DATE)
            AND v.fecha_venta < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            AND UPPER(v.estado) <> 'ANULADA'
       ),
       month_profit AS (
         SELECT COALESCE(SUM((vd.precio_unitario - COALESCE(vd.costo_unitario, p.precio_compra)) * vd.cantidad), 0) AS ganancia
           FROM venta_detalles vd
           JOIN ventas v ON v.id = vd.venta_id
           JOIN productos p ON p.id = vd.producto_id AND p.negocio_id = v.negocio_id
          WHERE v.negocio_id = $1
            AND v.fecha_venta >= DATE_TRUNC('month', CURRENT_DATE)
            AND v.fecha_venta < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            AND UPPER(v.estado) <> 'ANULADA'
       ),
       inventory AS (
         SELECT COALESCE(SUM(p.stock_actual * p.precio_compra), 0) AS valor_costo,
                COALESCE(SUM(p.stock_actual * p.precio_venta), 0) AS valor_venta,
                COUNT(*) FILTER (WHERE p.activo IS DISTINCT FROM FALSE
                                  AND p.stock_actual <= COALESCE(p.stock_minimo, 0))::int AS productos_criticos
           FROM productos p
          WHERE p.negocio_id = $1
       )
       SELECT
         COUNT(ms.id)::int AS cantidad_ventas_mes,
         COALESCE(SUM(ms.total), 0)::numeric(14,2) AS ventas_mes,
         CASE WHEN COUNT(ms.id) = 0 THEN 0
              ELSE ROUND(SUM(ms.total) / COUNT(ms.id), 2) END::numeric(14,2) AS ticket_promedio,
         (SELECT ganancia FROM month_profit)::numeric(14,2) AS ganancia_bruta_mes,
         COALESCE((SELECT SUM(v.saldo_pendiente)
                     FROM ventas v
                    WHERE v.negocio_id = $1
                      AND v.saldo_pendiente > 0
                      AND UPPER(v.estado) <> 'ANULADA'), 0)::numeric(14,2) AS cuentas_por_cobrar,
         (SELECT valor_costo FROM inventory)::numeric(14,2) AS inventario_a_costo,
         (SELECT valor_venta FROM inventory)::numeric(14,2) AS inventario_a_precio_venta,
         (SELECT productos_criticos FROM inventory) AS productos_criticos
       FROM month_sales ms`,
      [negocioId],
    ),
    pool.query(
      `SELECT COALESCE(u.nombre, 'Usuario no disponible') AS vendedor,
              COUNT(v.id)::int AS cantidad_ventas,
              COALESCE(SUM(v.total), 0)::numeric(14,2) AS total_ventas
         FROM ventas v
         LEFT JOIN pos_users u ON u.id = v.usuario_id
        WHERE v.negocio_id = $1
          AND v.fecha_venta >= DATE_TRUNC('month', CURRENT_DATE)
          AND v.fecha_venta < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          AND UPPER(v.estado) <> 'ANULADA'
        GROUP BY COALESCE(u.nombre, 'Usuario no disponible')
        ORDER BY total_ventas DESC, vendedor
        LIMIT 10`,
      [negocioId],
    ),
    pool.query(
      `SELECT payment.method AS metodo_pago,
              COALESCE(SUM(payment.amount), 0)::numeric(14,2) AS total
         FROM ventas v
         CROSS JOIN LATERAL (VALUES
           ('Efectivo', v.monto_efectivo),
           ('QR', v.monto_qr),
           ('Tarjeta', v.monto_tarjeta),
           ('Crédito', v.monto_credito)
         ) AS payment(method, amount)
        WHERE v.negocio_id = $1
          AND v.fecha_venta >= DATE_TRUNC('month', CURRENT_DATE)
          AND v.fecha_venta < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          AND UPPER(v.estado) <> 'ANULADA'
          AND payment.amount > 0
        GROUP BY payment.method
        ORDER BY total DESC`,
      [negocioId],
    ),
    pool.query(
      `SELECT p.id AS producto_id, p.nombre AS producto_nombre,
              COALESCE(SUM(vd.cantidad), 0)::numeric(14,2) AS cantidad_vendida,
              COALESCE(SUM(vd.subtotal), 0)::numeric(14,2) AS total_vendido
         FROM venta_detalles vd
         JOIN ventas v ON v.id = vd.venta_id
         JOIN productos p ON p.id = vd.producto_id AND p.negocio_id = v.negocio_id
        WHERE v.negocio_id = $1
          AND v.fecha_venta >= DATE_TRUNC('month', CURRENT_DATE)
          AND v.fecha_venta < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          AND UPPER(v.estado) <> 'ANULADA'
        GROUP BY p.id, p.nombre
        ORDER BY cantidad_vendida DESC, producto_nombre
        LIMIT 5`,
      [negocioId],
    ),
    pool.query(
      `SELECT p.id AS producto_id, p.nombre AS producto_nombre,
              COALESCE(SUM((vd.precio_unitario - COALESCE(vd.costo_unitario, p.precio_compra))
                           * vd.cantidad), 0)::numeric(14,2) AS ganancia_bruta
         FROM venta_detalles vd
         JOIN ventas v ON v.id = vd.venta_id
         JOIN productos p ON p.id = vd.producto_id AND p.negocio_id = v.negocio_id
        WHERE v.negocio_id = $1
          AND v.fecha_venta >= DATE_TRUNC('month', CURRENT_DATE)
          AND v.fecha_venta < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          AND UPPER(v.estado) <> 'ANULADA'
        GROUP BY p.id, p.nombre
        ORDER BY ganancia_bruta DESC, producto_nombre
        LIMIT 5`,
      [negocioId],
    ),
    pool.query(
      `SELECT p.id AS producto_id, p.nombre AS producto_nombre,
              COALESCE(c.numero_factura, LEFT(l.id::text, 8)) AS lote,
              l.fecha_vencimiento, l.cantidad
         FROM lotes l
         JOIN compra_detalles cd ON cd.id = l.compra_detalle_id
         JOIN compras c ON c.id = cd.compra_id AND c.negocio_id = $1
         JOIN productos p ON p.id = l.producto_id AND p.negocio_id = $1
        WHERE l.negocio_id = $1
          AND l.cantidad > 0
          AND l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          AND LOWER(c.estado) <> 'anulada'
        ORDER BY l.fecha_vencimiento ASC, p.nombre
        LIMIT 10`,
      [negocioId],
    ),
    pool.query(
      `SELECT t.id, COALESCE(u.nombre, 'Usuario no disponible') AS usuario_nombre,
              t.fecha_apertura, t.fecha_cierre, t.monto_real_contado AS saldo_final,
              t.estado
         FROM turnos_caja t
         LEFT JOIN pos_users u ON u.id = t.usuario_id
        WHERE t.negocio_id = $1
        ORDER BY t.fecha_apertura DESC
        LIMIT 5`,
      [negocioId],
    ),
    querySalesTime(negocioId, '7dias'),
  ]);

  const kpis = metrics.rows[0];
  const [activeTurn, recentSales] = await Promise.all([
    pool.query(
      `SELECT id, fecha_apertura, monto_inicial, total_efectivo_esperado, total_qr_esperado
         FROM turnos_caja
        WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
        ORDER BY fecha_apertura DESC
        LIMIT 1`,
      [negocioId],
    ),
    pool.query(
      `SELECT id, numero_ticket, cliente_nombre, total, metodo_pago, fecha_venta, estado
         FROM ventas
        WHERE negocio_id = $1
        ORDER BY fecha_venta DESC
        LIMIT 6`,
      [negocioId],
    ),
  ]);

  res.json({
    kpis,
    ventas_mes: { cantidad: kpis.cantidad_ventas_mes, ingresos: kpis.ventas_mes },
    productos_criticos: kpis.productos_criticos,
    turno: activeTurn.rows[0] || null,
    ventas_recientes: recentSales.rows,
    ventas_tiempo: salesTime,
    ventas_vendedor: sellers.rows,
    metodos_pago: payments.rows,
    top_productos: bestSellers.rows,
    top_ganancias: bestMargins.rows,
    proximos_vencer: expirations.rows,
    movimientos_caja: cashTurns.rows,
  });
}

async function salesTime(req, res) {
  const range = typeof req.query.rango === 'string' ? req.query.rango : '7dias';
  const result = await querySalesTime(await getNegocioId(req), range);
  res.json(result);
}

async function querySalesTime(negocioId, range) {
  const ranges = {
    '7dias': {
      series: `generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')`,
      trunc: 'day',
      step: "INTERVAL '1 day'",
    },
    mes: {
      series: `generate_series(DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE, INTERVAL '1 day')`,
      trunc: 'day',
      step: "INTERVAL '1 day'",
    },
    año: {
      series: `generate_series(DATE_TRUNC('year', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE), INTERVAL '1 month')`,
      trunc: 'month',
      step: "INTERVAL '1 month'",
    },
  };
  const selected = ranges[range];
  if (!selected) throw new ApiError(400, 'rango debe ser 7dias, mes o año.');
  const result = await pool.query(
    `WITH periods AS (
       SELECT generated.bucket::date AS bucket
         FROM ${selected.series} AS generated(bucket)
     )
     SELECT periods.bucket::date AS fecha,
            COALESCE(SUM(v.total), 0)::numeric(14,2) AS ventas
       FROM periods
       LEFT JOIN ventas v
         ON v.negocio_id = $1
        AND v.fecha_venta >= periods.bucket
        AND v.fecha_venta < periods.bucket + ${selected.step}
        AND UPPER(v.estado) <> 'ANULADA'
      GROUP BY periods.bucket
      ORDER BY periods.bucket`,
    [negocioId],
  );
  return result.rows;
}

async function health(_req, res) {
  const result = await pool.query('SELECT NOW() AS timestamp');
  res.json({
    status: 'OK',
    mensaje: 'Conexión exitosa con la Base de Datos POS',
    timestamp: result.rows[0].timestamp,
  });
}

module.exports = { health, salesTime, summary };
