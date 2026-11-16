const { initializeDatabase, pool } = require('../config/db');

const BUSINESS_ID = '31fd88e6-4815-4ef1-8e7f-52a7568645ac';
const providers = [
  {
    empresa: 'Distribuidora del Oriente S.R.L.',
    contacto: 'Carlos Méndez',
    telefono: '70123456',
    nitCi: '1023456019',
    direccion: 'Av. Monseñor Rivero #450',
  },
  {
    empresa: 'Importadora Comercial Santa Cruz',
    contacto: 'Ana María Roca',
    telefono: '78912345',
    nitCi: '1234567011',
    direccion: 'Parque Industrial, Manzana 12',
  },
  {
    empresa: 'Mayorista El Triunfo',
    contacto: 'Jorge Justiniano',
    telefono: '71654321',
    nitCi: '1098765012',
    direccion: 'Av. 6 de Agosto #1200',
  },
  {
    empresa: 'Proveduría y Abastos del Norte',
    contacto: 'Mariana Paz',
    telefono: '79234567',
    nitCi: '1145678015',
    direccion: 'Carretera al Norte Km 6',
  },
  {
    empresa: 'Comercializadora San Gabriel',
    contacto: 'Luis Fernando Vaca',
    telefono: '73456789',
    nitCi: '1056789018',
    direccion: '24 de Septiembre #310',
  },
];

async function main() {
  await initializeDatabase();
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('finora-proveedores-seeder'))");

    const business = await client.query(
      'SELECT id FROM public.negocios WHERE id = $1',
      [BUSINESS_ID],
    );
    if (!business.rowCount) {
      throw new Error(`No existe el negocio ${BUSINESS_ID}; no se insertaron proveedores.`);
    }

    let inserted = 0;
    for (const provider of providers) {
      const result = await client.query(
        `INSERT INTO public.proveedores
           (negocio_id, nombre_empresa, contacto_nombre, telefono, nit_ci, direccion)
         SELECT $1, $2, $3, $4, $5::varchar(50), $6
          WHERE NOT EXISTS (
            SELECT 1
              FROM public.proveedores
             WHERE negocio_id = $1 AND nit_ci = $5::varchar(50)
          )
         RETURNING id, nombre_empresa`,
        [
          BUSINESS_ID,
          provider.empresa,
          provider.contacto,
          provider.telefono,
          provider.nitCi,
          provider.direccion,
        ],
      );
      if (result.rowCount) {
        inserted += 1;
        console.log(`Proveedor insertado: ${result.rows[0].nombre_empresa} (${result.rows[0].id})`);
      } else {
        console.log(`Proveedor ya existente, omitido: ${provider.empresa} (NIT/CI ${provider.nitCi})`);
      }
    }

    await client.query('COMMIT');
    transactionOpen = false;
    console.log(`Seeder de proveedores completado: ${inserted} insertados de ${providers.length}.`);
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
    console.error('Error al ejecutar el seeder de proveedores:', error);
    await pool.end();
    process.exitCode = 1;
  });
