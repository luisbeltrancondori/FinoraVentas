const { pool } = require('../config/db');
const { ApiError, getNegocioId } = require('../utils/http');

function readDateRange(req) {
  const desde = typeof req.query.desde === 'string' && req.query.desde ? req.query.desde : null;
  const hasta = typeof req.query.hasta === 'string' && req.query.hasta ? req.query.hasta : null;
  for (const [label, value] of [['desde', desde], ['hasta', hasta]]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value)
      || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      throw new ApiError(400, `El filtro ${label} debe tener formato YYYY-MM-DD.`);
    }
  }
  if (desde && hasta && desde > hasta) {
    throw new ApiError(400, 'La fecha desde no puede ser posterior a la fecha hasta.');
  }
  return [desde, hasta];
}

async function utilities(req, res) {
  const negocioId = await getNegocioId(req);
  const [desde, hasta] = readDateRange(req);
  const result = await pool.query(
    `WITH period_sales AS (
       SELECT v.id, v.fecha_venta::date AS fecha, v.total
         FROM ventas v
        WHERE v.negocio_id = $1
          AND UPPER(v.estado) <> 'ANULADA'
          AND ($2::date IS NULL OR v.fecha_venta >= $2::date)
          AND ($3::date IS NULL OR v.fecha_venta < $3::date + INTERVAL '1 day')
     ),
     sales_totals AS (
       SELECT fecha, COUNT(*)::int AS cantidad_ventas, SUM(total) AS ventas_totales
         FROM period_sales GROUP BY fecha
     ),
     cost_totals AS (
       SELECT ps.fecha,
              SUM(vd.costo_unitario * vd.cantidad) AS costos
         FROM period_sales ps
         JOIN venta_detalles vd ON vd.venta_id = ps.id
        GROUP BY ps.fecha
     )
     SELECT st.fecha, st.cantidad_ventas,
            st.ventas_totales::numeric(14,2) AS ventas_totales,
            COALESCE(ct.costos, 0)::numeric(14,2) AS costos,
            (st.ventas_totales - COALESCE(ct.costos, 0))::numeric(14,2) AS ganancia_neta
       FROM sales_totals st
       LEFT JOIN cost_totals ct ON ct.fecha = st.fecha
      ORDER BY st.fecha DESC`,
    [negocioId, desde, hasta],
  );
  res.json(result.rows);
}

async function accountsReceivable(req, res) {
  const negocioId = await getNegocioId(req);
  const [desde, hasta] = readDateRange(req);
  const result = await pool.query(
    `SELECT v.cliente_id,
            COALESCE(MAX(NULLIF(BTRIM(v.cliente_nombre), '')), 'Cliente General') AS cliente,
            MAX(v.cliente_contacto) AS contacto,
            COUNT(*)::int AS ventas_pendientes,
            COALESCE(SUM(v.total), 0)::numeric(14,2) AS total_credito,
            COALESCE(SUM(v.saldo_pendiente), 0)::numeric(14,2) AS saldo_pendiente,
            MIN(v.fecha_venta) AS venta_mas_antigua
       FROM ventas v
      WHERE v.negocio_id = $1
        AND LOWER(v.metodo_pago) = 'credito'
        AND v.saldo_pendiente > 0
        AND UPPER(v.estado) <> 'ANULADA'
        AND ($2::date IS NULL OR v.fecha_venta >= $2::date)
        AND ($3::date IS NULL OR v.fecha_venta < $3::date + INTERVAL '1 day')
      GROUP BY v.cliente_id, COALESCE(NULLIF(BTRIM(v.cliente_nombre), ''), 'Cliente General')
      ORDER BY saldo_pendiente DESC, cliente`,
    [negocioId, desde, hasta],
  );
  res.json(result.rows);
}

async function accountsPayable(req, res) {
  const negocioId = await getNegocioId(req);
  const [desde, hasta] = readDateRange(req);
  const result = await pool.query(
    `SELECT c.proveedor_id,
            COALESCE(p.nombre_empresa, 'Proveedor no disponible') AS proveedor,
            p.nit_ci,
            COUNT(*)::int AS compras_pendientes,
            COALESCE(SUM(c.total), 0)::numeric(14,2) AS total_compras,
            COALESCE(SUM(c.saldo_pendiente), 0)::numeric(14,2) AS saldo_pendiente,
            MIN(c.fecha_compra) AS compra_mas_antigua
       FROM compras c
       LEFT JOIN proveedores p ON p.id = c.proveedor_id AND p.negocio_id = c.negocio_id
      WHERE c.negocio_id = $1
        AND c.estado IN ('pendiente', 'parcial')
        AND c.saldo_pendiente > 0
        AND ($2::date IS NULL OR c.fecha_compra >= $2::date)
        AND ($3::date IS NULL OR c.fecha_compra < $3::date + INTERVAL '1 day')
      GROUP BY c.proveedor_id, p.nombre_empresa, p.nit_ci
      ORDER BY saldo_pendiente DESC, proveedor`,
    [negocioId, desde, hasta],
  );
  res.json(result.rows);
}

async function cashClose(req, res) {
  const negocioId = await getNegocioId(req);
  const [desde, hasta] = readDateRange(req);
  const result = await pool.query(
    `WITH turn_payments AS (
       SELECT v.turno_id, payment.metodo_pago,
              SUM(payment.monto)::numeric(14,2) AS monto
         FROM ventas v
         CROSS JOIN LATERAL (VALUES
           ('efectivo', v.monto_efectivo),
           ('qr', v.monto_qr),
           ('tarjeta', v.monto_tarjeta),
           ('credito', v.monto_credito)
         ) AS payment(metodo_pago, monto)
        WHERE v.negocio_id = $1
          AND UPPER(v.estado) <> 'ANULADA'
          AND v.turno_id IS NOT NULL
          AND payment.monto > 0
        GROUP BY v.turno_id, payment.metodo_pago
     )
     SELECT t.id AS turno_id,
            COALESCE(u.nombre, 'Usuario no disponible') AS usuario,
            t.fecha_apertura, t.fecha_cierre, t.estado,
            t.monto_inicial, t.monto_real_contado AS saldo_final,
            COALESCE(tp.metodo_pago, 'sin ventas') AS metodo_pago,
            COALESCE(tp.monto, 0)::numeric(14,2) AS total_recaudado
       FROM turnos_caja t
       LEFT JOIN pos_users u ON u.id = t.usuario_id
       LEFT JOIN turn_payments tp ON tp.turno_id = t.id
      WHERE t.negocio_id = $1
        AND ($2::date IS NULL OR t.fecha_apertura >= $2::date)
        AND ($3::date IS NULL OR t.fecha_apertura < $3::date + INTERVAL '1 day')
      ORDER BY t.fecha_apertura DESC, metodo_pago`,
    [negocioId, desde, hasta],
  );
  res.json(result.rows);
}

async function dormantProducts(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT p.id AS producto_id, p.codigo_barras, p.nombre AS producto,
            p.stock_actual, p.precio_compra AS costo_unitario,
            p.stock_actual * p.precio_compra AS valor_inmovilizado,
            MAX(v.fecha_venta) AS ultima_venta
       FROM productos p
       LEFT JOIN venta_detalles vd ON vd.producto_id = p.id
       LEFT JOIN ventas v ON v.id = vd.venta_id
          AND v.negocio_id = p.negocio_id
          AND UPPER(v.estado) <> 'ANULADA'
      WHERE p.negocio_id = $1
        AND p.activo IS DISTINCT FROM FALSE
      GROUP BY p.id
     HAVING MAX(v.fecha_venta) IS NULL
         OR MAX(v.fecha_venta) < CURRENT_DATE - INTERVAL '30 days'
      ORDER BY valor_inmovilizado DESC, producto`,
    [negocioId],
  );
  res.json(result.rows);
}

async function purchasesBySupplier(req, res) {
  const negocioId = await getNegocioId(req);
  const [desde, hasta] = readDateRange(req);
  const result = await pool.query(
    `SELECT c.proveedor_id,
            COALESCE(p.nombre_empresa, 'Proveedor no disponible') AS proveedor,
            p.nit_ci,
            COUNT(*)::int AS cantidad_compras,
            COALESCE(SUM(c.subtotal), 0)::numeric(14,2) AS subtotal,
            COALESCE(SUM(c.descuento), 0)::numeric(14,2) AS descuentos,
            COALESCE(SUM(c.total), 0)::numeric(14,2) AS total_compras
       FROM compras c
       LEFT JOIN proveedores p ON p.id = c.proveedor_id AND p.negocio_id = c.negocio_id
      WHERE c.negocio_id = $1
        AND LOWER(c.estado) <> 'anulada'
        AND ($2::date IS NULL OR c.fecha_compra >= $2::date)
        AND ($3::date IS NULL OR c.fecha_compra < $3::date + INTERVAL '1 day')
      GROUP BY c.proveedor_id, p.nombre_empresa, p.nit_ci
      ORDER BY total_compras DESC, proveedor`,
    [negocioId, desde, hasta],
  );
  res.json(result.rows);
}

module.exports = {
  accountsPayable,
  accountsReceivable,
  cashClose,
  dormantProducts,
  purchasesBySupplier,
  utilities,
};
