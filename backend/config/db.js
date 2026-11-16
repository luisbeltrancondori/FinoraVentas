const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin_pos:pos_password_seguro@db:5432/sistema_ventas',
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => {
  console.error('Error inesperado en una conexión inactiva de PostgreSQL:', error);
});

const REQUIRED_TABLES = [
  'negocios',
  'proveedores',
  'marcas',
  'presentaciones',
  'categorias',
  'productos',
  'compras',
  'compra_detalles',
  'turnos_caja',
  'ventas',
  'venta_detalles',
];

async function waitForDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
      console.error(`Base de datos no disponible (${attempt}/30): ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

async function initializeSchema() {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));

  if (missing.length === 0) return;
  if (existing.size > 0) {
    throw new Error(
      `Esquema PostgreSQL incompleto; faltan tablas: ${missing.join(', ')}. `
      + 'No se aplicó el esquema automáticamente para evitar alterar datos existentes.',
    );
  }

  const schemaPath = process.env.SCHEMA_PATH
    || path.resolve(__dirname, '../../schema_pos_maestro.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);
  console.log(`Esquema POS inicializado desde ${schemaPath}.`);
}

async function applyMigrations() {
  const migrationPaths = [
    '../migrations/001_identity_inventory.sql',
    '../migrations/002_payment_methods.sql',
    '../migrations/003_sales_audit.sql',
    '../migrations/004_clientes.sql',
    '../migrations/005_product_images.sql',
    '../migrations/006_sales_credit_payments.sql',
    '../migrations/007_customer_crud.sql',
    '../migrations/008_purchase_lots.sql',
    '../migrations/009_purchase_credit.sql',
    '../migrations/010_physical_inventory_reports.sql',
    '../migrations/011_physical_inventory_snapshots.sql',
    '../migrations/012_storefront_offers.sql',
    '../migrations/013_product_public_details.sql',
    '../migrations/014_contact_messages.sql',
    '../migrations/015_proformas_web.sql',
    '../migrations/016_banners_carrusel.sql',
  ];
  for (const migration of migrationPaths) {
    const migrationPath = path.resolve(__dirname, migration);
    await pool.query(await fs.readFile(migrationPath, 'utf8'));
  }
}

async function ensureInitialBusiness() {
  const result = await pool.query('SELECT id FROM negocios LIMIT 1');
  if (result.rowCount) return;

  if (process.env.NEGOCIO_ID) {
    await pool.query(
      'INSERT INTO negocios (id, nombre) VALUES ($1, $2)',
      [process.env.NEGOCIO_ID, process.env.NEGOCIO_NOMBRE || 'Mi Negocio'],
    );
  } else {
    await pool.query(
      'INSERT INTO negocios (nombre) VALUES ($1)',
      [process.env.NEGOCIO_NOMBRE || 'Mi Negocio'],
    );
  }
  console.log('Se creó el negocio local inicial.');
}

async function initializeDatabase() {
  await waitForDatabase();
  await initializeSchema();
  await applyMigrations();
  await ensureInitialBusiness();
}

module.exports = { pool, initializeDatabase };
