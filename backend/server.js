const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { initializeDatabase, pool } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const productRoutes = require('./routes/productos.routes');
const salesRoutes = require('./routes/ventas.routes');
const purchaseRoutes = require('./routes/compras.routes');
const cashRoutes = require('./routes/caja.routes');
const { requireAuth } = require('./utils/auth');

const app = express();
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
fs.mkdirSync(uploadDirectory, { recursive: true });
const sessionSecret = process.env.POS_SESSION_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.POS_SESSION_SECRET) {
  console.warn('POS_SESSION_SECRET no está configurado; las sesiones se invalidarán al reiniciar el backend.');
}

app.disable('x-powered-by');

// --- Headers de seguridad HTTP (SEC-09) ---
// helmet() activa: X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, X-DNS-Prefetch-Control, etc.
// crossOriginResourcePolicy se relaja a cross-origin solo para
// el path /uploads (imágenes servidas al frontend en otro origen).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// --- Rate limiting (SEC-08) ---
// Fuerza bruta en login: máx. 10 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.', code: 'TOO_MANY_REQUESTS' },
});
// Resto de /api/auth (logout, me, setup): máx. 30 req/min
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en un minuto.', code: 'TOO_MANY_REQUESTS' },
});
// API general autenticada: máx. 300 req/min por IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en un minuto.', code: 'TOO_MANY_REQUESTS' },
});
// Rutas públicas sin autenticación (formularios): máx. 20 req/min por IP (SEC-10)
// Protege /api/public/contacto y /api/proformas-web contra spam/scraping.
const publicFormLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en un minuto.', code: 'TOO_MANY_REQUESTS' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/public/contacto', publicFormLimiter);
app.use('/api/proformas-web', publicFormLimiter);
app.use('/api', apiLimiter);

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
if (process.env.NODE_ENV === 'production' && frontendOrigin.startsWith('http://')) {
  console.warn(
    '[SEC-16] ADVERTENCIA: FRONTEND_ORIGIN usa HTTP en producción. '
    + 'Configura FRONTEND_ORIGIN=https://tudominio.com en el archivo .env para activar CORS seguro.',
  );
}
app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));
app.use('/uploads', express.static(uploadDirectory, {
  dotfiles: 'deny',
  immutable: true,
  maxAge: '1d',
  fallthrough: false,
  index: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'pos.sid',
  store: new PgSession({
    pool,
    tableName: 'pos_sessions',
    createTableIfMissing: true,
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/public.routes'));
app.use('/api', requireAuth);
// dashboardRoutes movido aquí (post-requireAuth) para que el guard
// global cubra cualquier ruta futura que se agregue sin auth propia (SEC-11)
app.use('/api', dashboardRoutes);
app.use('/api', require('./routes/reports.routes'));
app.use('/api', require('./routes/admin.routes'));
app.use('/api', require('./routes/banners.routes'));
app.use('/api', require('./routes/inventory.routes'));
app.use('/api', require('./routes/categorias.routes'));
app.use('/api', productRoutes);
app.use('/api', salesRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', cashRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: `Ruta no encontrada: ${req.method} ${req.path}`,
    code: 'ROUTE_NOT_FOUND',
  });
});

app.use((error, _req, res, _next) => {
  if (error.status && error.status < 500) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code || 'INVALID_REQUEST',
    });
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'La imagen supera el tamaño máximo permitido.', code: 'UPLOAD_TOO_LARGE' });
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Solo se permite una imagen por producto.', code: 'INVALID_UPLOAD' });
  }
  if (error.code === 'LIMIT_FIELD_COUNT' || error.code === 'LIMIT_FIELD_VALUE') {
    return res.status(400).json({ error: 'Los datos enviados junto con el archivo exceden el límite permitido.', code: 'INVALID_UPLOAD' });
  }
  if (error.code === '23505') {
    return res.status(409).json({
      error: 'Ya existe un registro con esos datos únicos.',
      code: 'DUPLICATE_RECORD',
    });
  }
  if (error.code === '23503' || error.code === '23514' || error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Los datos enviados no son válidos para el esquema.',
      code: 'INVALID_DATA',
    });
  }

  console.error('Error interno en la API POS:', error);
  return res.status(500).json({
    error: 'Error interno del servidor.',
    code: 'INTERNAL_SERVER_ERROR',
  });
});

async function startServer() {
  await initializeDatabase();
  const port = Number(process.env.PORT) || 4000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend POS corriendo en el puerto ${port}`);
  });

  const shutdown = (signal) => {
    console.log(`Recibida señal ${signal}; cerrando API POS.`);
    server.close(async (error) => {
      if (error) {
        console.error('Error al cerrar el servidor HTTP:', error);
        process.exitCode = 1;
      }
      await pool.end();
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('No se pudo iniciar el backend POS:', error);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
