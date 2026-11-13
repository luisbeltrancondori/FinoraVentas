const { pool } = require('../config/db');
const {
  ApiError,
  getNegocioId,
  requireNumber,
  requireUuid,
  rollback,
  roundMoney,
} = require('../utils/http');

async function current(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT * FROM turnos_caja
      WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
      ORDER BY fecha_apertura DESC LIMIT 1`,
    [negocioId],
  );
  res.json({ turno: result.rows[0] || null });
}

async function list(req, res) {
  const negocioId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT t.*, COALESCE(u.nombre, 'Usuario no disponible') AS usuario_nombre
       FROM turnos_caja t
       LEFT JOIN pos_users u ON u.id = t.usuario_id
      WHERE t.negocio_id = $1
      ORDER BY t.fecha_apertura DESC`,
    [negocioId],
  );
  res.json(result.rows);
}

async function open(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [negocioId]);
    const activeTurn = await client.query(
      `SELECT id FROM turnos_caja
        WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
        LIMIT 1 FOR UPDATE`,
      [negocioId],
    );
    if (activeTurn.rowCount) throw new ApiError(409, 'Ya existe un turno de caja abierto para este negocio.');

    const amount = requireNumber(req.body.monto_inicial ?? req.body.openingAmount ?? 0, 'monto_inicial');
    const result = await client.query(
      `INSERT INTO turnos_caja (negocio_id, usuario_id, monto_inicial, estado)
       VALUES ($1, $2, $3, 'ABIERTA') RETURNING *`,
      [negocioId, req.user.id, amount],
    );
    await client.query('COMMIT');
    res.status(201).json({ turno: result.rows[0] });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function close(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const negocioId = await getNegocioId(req, client);
    const turnId = req.body.turno_id ? requireUuid(req.body.turno_id, 'turno_id') : null;
    const turnResult = await client.query(
      `SELECT * FROM turnos_caja
        WHERE negocio_id = $1 AND UPPER(estado) = 'ABIERTA'
          AND ($2::uuid IS NULL OR id = $2)
        ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE`,
      [negocioId, turnId],
    );
    if (!turnResult.rowCount) throw new ApiError(404, 'No hay un turno abierto para cerrar.');

    const amount = requireNumber(
      req.body.monto_real_contado ?? req.body.monto_final,
      'monto_real_contado',
    );
    const turn = turnResult.rows[0];
    const expected = Number(turn.monto_inicial) + Number(turn.total_efectivo_esperado || 0);
    const result = await client.query(
      `UPDATE turnos_caja
          SET monto_real_contado = $1, diferencia = $2, fecha_cierre = NOW(), estado = 'CERRADO'
        WHERE id = $3 AND negocio_id = $4 RETURNING *`,
      [amount, roundMoney(amount - expected), turn.id, negocioId],
    );
    await client.query('COMMIT');
    res.json({ turno: result.rows[0], efectivo_esperado: roundMoney(expected) });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { close, current, list, open };
