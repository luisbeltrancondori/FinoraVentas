const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { pool } = require('../config/db');
const { ApiError, getNegocioId, requireNumber, requireUuid } = require('../utils/http');

const ROLES = new Set(['administrador', 'cajero', 'almacenero']);
const ALLOWED_PERMISSIONS = new Set([
  'dashboard.read', 'reports.read', 'sales.read', 'sales.write', 'cash.read', 'cash.write',
  'products.read', 'products.manage', 'purchases.read', 'purchases.write',
  'inventory.read', 'inventory.write',
]);

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new ApiError(400, `${label} debe ser texto de hasta ${maxLength} caracteres.`);
  }
  return value.trim() || null;
}

function businessFields(body) {
  return {
    nit: optionalText(body.nit, 'NIT', 30),
    direccion: optionalText(body.direccion, 'Dirección', 500),
    telefono: optionalText(body.telefono, 'Teléfono', 20),
    moneda: optionalText(body.moneda, 'Moneda', 10) || 'Bs',
  };
}

function validatePermissions(value) {
  if (value === undefined) return {};
  if (!value || Array.isArray(value) || typeof value !== 'object'
    || Object.entries(value).some(([permission, allowed]) => (
      !ALLOWED_PERMISSIONS.has(permission) || typeof allowed !== 'boolean'
    ))) {
    throw new ApiError(400, 'Los permisos deben ser un objeto de valores booleanos.');
  }
  return value;
}

async function businesses(req, res) {
  const result = await pool.query(
    `SELECT n.id, n.nombre, n.nit, n.direccion, n.telefono, n.moneda
       FROM negocios n JOIN pos_user_negocios un ON un.negocio_id = n.id
      WHERE un.usuario_id = $1 ORDER BY n.nombre`,
    [req.user.id],
  );
  res.json(result.rows);
}

async function createBusiness(req, res) {
  const name = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!name || name.length > 150) throw new ApiError(400, 'El nombre de sucursal es obligatorio (máximo 150 caracteres).');
  const fields = businessFields(req.body);
  const result = await pool.query(
    `WITH negocio AS (
       INSERT INTO negocios (nombre, nit, direccion, telefono, moneda)
       VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, ''), 'Bs'))
       RETURNING id, nombre, nit, direccion, telefono, moneda
     )
     INSERT INTO pos_user_negocios (usuario_id, negocio_id)
     SELECT $6, id FROM negocio
     RETURNING negocio_id`,
    [name, fields.nit, fields.direccion, fields.telefono, fields.moneda, req.user.id],
  );
  const created = await pool.query(
    'SELECT id, nombre, nit, direccion, telefono, moneda FROM negocios WHERE id = $1',
    [result.rows[0].negocio_id],
  );
  res.status(201).json(created.rows[0]);
}

async function updateBusiness(req, res) {
  const id = requireUuid(req.params.id, 'negocio_id');
  if (!req.user.business_ids.includes(id)) throw new ApiError(403, 'No tienes acceso a esta sucursal.');
  const name = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!name || name.length > 150) throw new ApiError(400, 'El nombre de sucursal es obligatorio (máximo 150 caracteres).');
  const fields = businessFields(req.body);
  const result = await pool.query(
    `UPDATE negocios SET nombre = $2, nit = $3, direccion = $4, telefono = $5, moneda = $6
      WHERE id = $1 RETURNING id, nombre, nit, direccion, telefono, moneda`,
    [id, name, fields.nit, fields.direccion, fields.telefono, fields.moneda],
  );
  if (!result.rowCount) throw new ApiError(404, 'La sucursal no existe.');
  res.json(result.rows[0]);
}

async function listUsers(req, res) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.nombre, u.role, u.permissions, u.activo, u.creado_en,
            COALESCE(array_agg(un.negocio_id) FILTER (
              WHERE un.negocio_id = ANY($1::uuid[])
            ), '{}') AS negocio_ids
       FROM pos_users u LEFT JOIN pos_user_negocios un ON un.usuario_id = u.id
      WHERE EXISTS (
        SELECT 1 FROM pos_user_negocios scope
         WHERE scope.usuario_id = u.id AND scope.negocio_id = ANY($1::uuid[])
      )
      GROUP BY u.id ORDER BY u.nombre`,
    [req.user.business_ids],
  );
  res.json(result.rows);
}

function validateUserFields({ email, nombre, role, password }, passwordRequired = false) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
    throw new ApiError(400, 'Ingresa un correo electrónico válido.');
  }
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
    throw new ApiError(400, 'El nombre es obligatorio (máximo 150 caracteres).');
  }
  if (!ROLES.has(role)) throw new ApiError(400, 'El rol seleccionado no es válido.');
  if (passwordRequired && password === undefined) {
    throw new ApiError(400, 'La contraseña es obligatoria.');
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 12 || password.length > 128)) {
    throw new ApiError(400, 'La contraseña debe tener entre 12 y 128 caracteres.');
  }
}

async function assignBusinesses(client, userId, businessIds, actor) {
  if (!Array.isArray(businessIds) || businessIds.length === 0) {
    throw new ApiError(400, 'Asigna al menos una sucursal al usuario.');
  }
  const ids = [...new Set(businessIds.map((id) => requireUuid(id, 'negocio_id')))];
  if (ids.some((id) => !actor.business_ids.includes(id))) {
    throw new ApiError(403, 'Solo puedes asignar sucursales a las que tienes acceso.');
  }
  const found = await client.query('SELECT id FROM negocios WHERE id = ANY($1::uuid[])', [ids]);
  if (found.rowCount !== ids.length) throw new ApiError(400, 'Una o más sucursales seleccionadas no existen.');
  await client.query(
    'DELETE FROM pos_user_negocios WHERE usuario_id = $1 AND negocio_id = ANY($2::uuid[])',
    [userId, actor.business_ids],
  );
  for (const businessId of ids) {
    await client.query('INSERT INTO pos_user_negocios (usuario_id, negocio_id) VALUES ($1, $2)', [userId, businessId]);
  }
}

async function createUser(req, res) {
  const { email, nombre, role, password } = req.body;
  validateUserFields({ email, nombre, role, password }, true);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 12);
    const result = await client.query(
      `INSERT INTO pos_users (email, nombre, password_hash, role, permissions)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, nombre, role, permissions, activo, creado_en`,
      [email.trim().toLowerCase(), nombre.trim(), hash, role, validatePermissions(req.body.permissions)],
    );
    await assignBusinesses(client, result.rows[0].id, req.body.negocio_ids || [req.session.activeBusinessId], req.user);
    await client.query('COMMIT');
    res.status(201).json({ ...result.rows[0], negocio_ids: req.body.negocio_ids || [req.session.activeBusinessId] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('No se pudo revertir la creación de usuario:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function updateUser(req, res) {
  const id = requireUuid(req.params.id, 'usuario_id');
  const { email, nombre, role, password } = req.body;
  validateUserFields({ email, nombre, role, password });
  const permissions = validatePermissions(req.body.permissions);
  const active = req.body.activo === undefined ? true : req.body.activo;
  if (typeof active !== 'boolean') throw new ApiError(400, 'activo debe ser verdadero o falso.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query(
      `SELECT u.id FROM pos_users u
        WHERE u.id = $1 AND EXISTS (
          SELECT 1 FROM pos_user_negocios un
           WHERE un.usuario_id = u.id AND un.negocio_id = ANY($2::uuid[])
        )
        FOR UPDATE`,
      [id, req.user.business_ids],
    );
    if (!exists.rowCount) throw new ApiError(404, 'El usuario no existe.');
    if (id === req.user.id && !active) throw new ApiError(400, 'No puedes desactivar tu propia cuenta.');
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    await client.query(
      `UPDATE pos_users SET email = $2, nombre = $3, role = $4, permissions = $5,
              activo = $6, password_hash = COALESCE($7, password_hash), actualizado_en = NOW()
        WHERE id = $1`,
      [id, email.trim().toLowerCase(), nombre.trim(), role, permissions, active, passwordHash],
    );
    if (req.body.negocio_ids !== undefined) {
      await assignBusinesses(client, id, req.body.negocio_ids, req.user);
    }
    const admins = await client.query(
      "SELECT COUNT(*)::int AS count FROM pos_users WHERE role = 'administrador' AND activo = TRUE",
    );
    if (!admins.rows[0].count) throw new ApiError(400, 'Debe permanecer al menos un administrador activo.');
    await client.query('COMMIT');
    const updated = await client.query(
      `SELECT u.id, u.email, u.nombre, u.role, u.permissions, u.activo, u.creado_en,
              COALESCE(array_agg(un.negocio_id) FILTER (
                WHERE un.negocio_id = ANY($2::uuid[])
              ), '{}') AS negocio_ids
         FROM pos_users u LEFT JOIN pos_user_negocios un ON un.usuario_id = u.id
        WHERE u.id = $1 GROUP BY u.id`,
      [id, req.user.business_ids],
    );
    res.json(updated.rows[0]);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('No se pudo revertir la actualización de usuario:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function resetUserPassword(req, res) {
  const id = requireUuid(req.params.id, 'usuario_id');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query(
      `SELECT u.id
         FROM pos_users u
        WHERE u.id = $1
          AND EXISTS (
            SELECT 1
              FROM pos_user_negocios un
             WHERE un.usuario_id = u.id
               AND un.negocio_id = ANY($2::uuid[])
          )
        FOR UPDATE`,
      [id, req.user.business_ids],
    );
    if (!target.rowCount) throw new ApiError(404, 'El usuario no existe o no está asignado a tus sucursales.');

    const tempPassword = `Finora${crypto.randomInt(1000, 10000)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await client.query(
      'UPDATE pos_users SET password_hash = $2, actualizado_en = NOW() WHERE id = $1',
      [id, passwordHash],
    );
    await client.query('COMMIT');
    res.json({ success: true, tempPassword });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('No se pudo revertir el restablecimiento de contraseña:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function profile(req, res) {
  const result = await pool.query(
    'SELECT id, email, nombre, role, permissions FROM pos_users WHERE id = $1',
    [req.user.id],
  );
  res.json(result.rows[0]);
}

async function updateProfile(req, res) {
  const name = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!name || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ApiError(400, 'Ingresa un nombre y correo válidos.');
  }
  if (req.body.new_password !== undefined) {
    if (typeof req.body.current_password !== 'string' || typeof req.body.new_password !== 'string'
      || req.body.new_password.length < 12 || req.body.new_password.length > 128) {
      throw new ApiError(400, 'Para cambiar la contraseña, ingresa la actual y una nueva de al menos 12 caracteres.');
    }
    const result = await pool.query('SELECT password_hash FROM pos_users WHERE id = $1', [req.user.id]);
    if (!await bcrypt.compare(req.body.current_password, result.rows[0].password_hash)) {
      throw new ApiError(400, 'La contraseña actual es incorrecta.');
    }
    const hash = await bcrypt.hash(req.body.new_password, 12);
    await pool.query(
      'UPDATE pos_users SET nombre = $2, email = $3, password_hash = $4, actualizado_en = NOW() WHERE id = $1',
      [req.user.id, name, email, hash],
    );
  } else {
    await pool.query(
      'UPDATE pos_users SET nombre = $2, email = $3, actualizado_en = NOW() WHERE id = $1',
      [req.user.id, name, email],
    );
  }
  res.json({ id: req.user.id, nombre: name, email, role: req.user.role });
}

async function suppliers(req, res) {
  const businessId = await getNegocioId(req);
  const result = await pool.query(
    `SELECT id, nombre_empresa, contacto_nombre, telefono, nit_ci, direccion
       FROM proveedores WHERE negocio_id = $1 ORDER BY nombre_empresa`,
    [businessId],
  );
  res.json(result.rows);
}

async function saveSupplier(req, res) {
  const businessId = await getNegocioId(req);
  const name = typeof req.body.nombre_empresa === 'string' ? req.body.nombre_empresa.trim() : '';
  if (!name || name.length > 150) throw new ApiError(400, 'El nombre de proveedor es obligatorio (máximo 150 caracteres).');
  const fields = [
    name,
    optionalText(req.body.contacto_nombre, 'Contacto', 100),
    optionalText(req.body.telefono, 'Teléfono', 20),
    optionalText(req.body.nit_ci, 'NIT/CI', 50),
    optionalText(req.body.direccion, 'Dirección', 500),
  ];
  if (req.params.id) {
    const result = await pool.query(
      `UPDATE proveedores SET nombre_empresa = $3, contacto_nombre = $4, telefono = $5, nit_ci = $6, direccion = $7
        WHERE id = $1 AND negocio_id = $2
        RETURNING id, nombre_empresa, contacto_nombre, telefono, nit_ci, direccion`,
      [requireUuid(req.params.id, 'proveedor_id'), businessId, ...fields],
    );
    if (!result.rowCount) throw new ApiError(404, 'El proveedor no existe en esta sucursal.');
    return res.json(result.rows[0]);
  }
  const result = await pool.query(
    `INSERT INTO proveedores (negocio_id, nombre_empresa, contacto_nombre, telefono, nit_ci, direccion)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nombre_empresa, contacto_nombre, telefono, nit_ci, direccion`,
    [businessId, ...fields],
  );
  return res.status(201).json(result.rows[0]);
}

async function deleteSupplier(req, res) {
  const businessId = await getNegocioId(req);
  const result = await pool.query(
    'DELETE FROM proveedores WHERE id = $1 AND negocio_id = $2 RETURNING id',
    [requireUuid(req.params.id, 'proveedor_id'), businessId],
  );
  if (!result.rowCount) throw new ApiError(404, 'El proveedor no existe en esta sucursal.');
  res.json({ ok: true });
}

module.exports = {
  businesses, createBusiness, createUser, deleteSupplier, listUsers, profile,
  resetUserPassword, saveSupplier, suppliers, updateBusiness, updateProfile, updateUser,
};
