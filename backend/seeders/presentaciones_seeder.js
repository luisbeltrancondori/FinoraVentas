const { initializeDatabase, pool } = require('../config/db');

const BUSINESS_ID = '31fd88e6-4815-4ef1-8e7f-52a7568645ac';
const presentations = [
  'Unidad',
  'Paquete',
  'Paquete x2',
  'Paquete x4',
  'Paquete x6',
  'Paquete x12',
  'Caja',
  'Caja x6',
  'Caja x12',
  'Bolsa 100g',
  'Bolsa 250g',
  'Bolsa 500g',
  'Bolsa 1kg',
  'Botella 250ml',
  'Botella 500ml',
  'Botella 1L',
  'Botella 2L',
  'Lata 170g',
  'Lata 250ml',
  'Frasco 250g',
];

async function main() {
  await initializeDatabase();
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('finora-presentaciones-seeder'))");

    const business = await client.query(
      'SELECT id FROM public.negocios WHERE id = $1',
      [BUSINESS_ID],
    );
    if (!business.rowCount) {
      throw new Error(`No existe el negocio ${BUSINESS_ID}; no se insertaron presentaciones.`);
    }

    let inserted = 0;
    for (const name of presentations) {
      const result = await client.query(
        `INSERT INTO public.presentaciones (negocio_id, nombre)
         VALUES ($1, $2)
         ON CONFLICT (negocio_id, nombre) DO NOTHING
         RETURNING id, nombre`,
        [BUSINESS_ID, name],
      );
      if (result.rowCount) {
        inserted += 1;
        console.log(`Presentación insertada: ${result.rows[0].nombre} (${result.rows[0].id})`);
      } else {
        console.log(`Presentación ya existente, omitida: ${name}`);
      }
    }

    await client.query('COMMIT');
    transactionOpen = false;
    console.log(`Seeder de presentaciones completado: ${inserted} insertadas de ${presentations.length}.`);
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Error al ejecutar el seeder de presentaciones:', error);
    await pool.end();
    process.exitCode = 1;
  });
