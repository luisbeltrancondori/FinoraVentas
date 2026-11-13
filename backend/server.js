const express = require('express');
const cors = require('cors');
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
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
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
app.use('/api', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/public.routes'));
app.use('/api', requireAuth);
app.use('/api', require('./routes/reports.routes'));
app.use('/api', require('./routes/admin.routes'));
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
    return res.status(400).json({ error: 'La imagen no puede superar 5 MB.', code: 'UPLOAD_TOO_LARGE' });
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Solo se permite una imagen por producto.', code: 'INVALID_UPLOAD' });
  }
  if (error.code === 'LIMIT_FIELD_COUNT' || error.code === 'LIMIT_FIELD_VALUE') {
    return res.status(400).json({ error: 'Los datos del producto exceden el límite permitido.', code: 'INVALID_UPLOAD' });
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
