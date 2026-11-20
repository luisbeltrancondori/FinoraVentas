const { pool } = require('../config/db');

const ROLE_PERMISSIONS = {
  administrador: ['*'],
  cajero: [
    'dashboard.read', 'reports.read', 'sales.read', 'sales.write', 'cash.read', 'cash.write',
    'products.read', 'inventory.read',
  ],
  almacenero: [
    'dashboard.read', 'reports.read', 'products.read', 'products.manage', 'purchases.read', 'purchases.write',
    'inventory.read', 'inventory.write',
  ],
};

function effectivePermissions(role, overrides = {}) {
  const permissions = new Set(ROLE_PERMISSIONS[role] || []);
  for (const [permission, allowed] of Object.entries(overrides || {})) {
    if (allowed) permissions.add(permission);
    else permissions.delete(permission);
  }
  return [...permissions];
}

function hasPermission(user, permission) {
  const permissions = effectivePermissions(user.role, user.permissions);
  return permissions.includes('*') || permissions.includes(permission);
}

async function loadUser(userId) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.nombre, u.role, u.permissions, u.activo,
            COALESCE(array_agg(un.negocio_id) FILTER (WHERE un.negocio_id IS NOT NULL), '{}') AS business_ids
       FROM pos_users u
       LEFT JOIN pos_user_negocios un ON un.usuario_id = u.id
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId],
  );
  const user = result.rows[0];
  if (!user || !user.activo) return null;
  return {
    ...user,
    permissions: user.permissions || {},
    permisos: effectivePermissions(user.role, user.permissions),
  };
}

async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Inicia sesión para continuar.', code: 'AUTH_REQUIRED' });
    const user = await loadUser(userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'La sesión ya no es válida.', code: 'SESSION_INVALID' });
    }
    req.user = user;
    const requestedBusiness = (req.get('x-negocio-id') || req.session.activeBusinessId || '').toLowerCase() || null;
    if (requestedBusiness && !user.business_ids.includes(requestedBusiness)) {
      return res.status(403).json({ error: 'No tienes acceso a esta sucursal.', code: 'BUSINESS_FORBIDDEN' });
    }
    if (!requestedBusiness && user.business_ids.length === 1) {
      req.session.activeBusinessId = user.business_ids[0];
    }
    next();
  } catch (error) {
    next(error);
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user, permission)) {
      return res.status(403).json({
        error: 'Tu cuenta no tiene permisos para realizar esta acción.',
        code: 'PERMISSION_DENIED',
      });
    }
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Esta acción requiere un rol administrador.', code: 'ROLE_REQUIRED' });
    }
    next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  effectivePermissions,
  hasPermission,
  loadUser,
  requireAuth,
  requirePermission,
  requireRole,
};
