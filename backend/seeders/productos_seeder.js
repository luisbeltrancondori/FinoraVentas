const { randomInt } = require('node:crypto');
const { initializeDatabase, pool } = require('../config/db');

const CATEGORY_NAMES = [
  'Bebidas',
  'Abarrotes',
  'Snacks',
  'Lácteos',
  'Desayuno',
  'Conservas',
  'Condimentos',
  'Limpieza',
  'Cuidado personal',
  'Higiene',
];
const BRAND_NAMES = ['Coca-Cola', 'Pil', 'Local'];
const PRESENTATION_NAMES = [
  'Unidad',
  'Botella 2L',
  'Botella 1L',
  'Lata 250ml',
  'Bolsa 400g',
  'Caja 300g',
  'Frasco 250g',
  'Lata 170g',
  'Lata 425g',
  'Bolsa 200g',
  'Bolsa 1kg',
  'Bolsa 500g',
  'Botella 500ml',
  'Botella 400ml',
  'Paquete 125g',
  'Paquete x4',
  'Paquete x100',
  'Paquete 120g',
  'Bolsa 100g',
];
const SUPPLIER_NAME = 'Distribuidora Central';

const productDefinitions = [
  { nombre: 'Coca-Cola 2L', category: 'Bebidas', brand: 'Coca-Cola', presentation: 'Botella 2L', cost: 15, price: 23, stock: 48, expirationDays: 180, offer: 20.5, image: 'photo-1554866585-cd94860890b7', description: 'Bebida gaseosa de sabor original para compartir en familia.\\nIdeal para reuniones, comidas y celebraciones.', specifications: 'Contenido: 2L\\nSabor: Original' },
  { nombre: 'Coca-Cola 500ml', category: 'Bebidas', brand: 'Coca-Cola', presentation: 'Unidad', cost: 4.5, price: 7, stock: 75, expirationDays: 150, image: 'photo-1629203851122-3726ecdf080e', description: 'Bebida gaseosa refrescante en presentación individual.\\nPráctica para llevar y disfrutar en cualquier momento.', specifications: 'Contenido: 500ml\\nSabor: Original' },
  { nombre: 'Leche Pil 1L', category: 'Abarrotes', brand: 'Pil', presentation: 'Unidad', cost: 6.5, price: 9, stock: 54, expirationDays: 12, image: 'photo-1563636619-e9143da7973b', description: 'Leche pasteurizada para acompañar tus desayunos y recetas.\\nConserva refrigerada y consume antes de la fecha indicada.', specifications: 'Contenido: 1L\\nMarca: Pil' },
  { nombre: 'Yogurt Pil Frutilla 1L', category: 'Abarrotes', brand: 'Pil', presentation: 'Unidad', cost: 10, price: 14, stock: 35, expirationDays: 9, image: 'photo-1488477181946-6428a0291777', description: 'Yogurt cremoso con sabor a frutilla para toda la familia.\\nDisfrútalo frío como desayuno o merienda.', specifications: 'Contenido: 1L\\nSabor: Frutilla' },
  { nombre: 'Agua Mineral 600ml', category: 'Bebidas', brand: 'Local', presentation: 'Unidad', cost: 2, price: 4, stock: 100, expirationDays: 365, image: 'photo-1564419320461-6870880221ad', description: 'Agua mineral en botella individual, cómoda para llevar.\\nUna opción refrescante para hidratarte durante el día.', specifications: 'Contenido: 600ml\\nEnvase: Botella' },
  { nombre: 'Jugo de Naranja 1L', category: 'Bebidas', brand: 'Local', presentation: 'Unidad', cost: 8, price: 12, stock: 42, expirationDays: 45, offer: 10.5, image: 'photo-1600271886742-f049cd451bba', description: 'Jugo de naranja listo para servir y compartir.\\nMantener refrigerado una vez abierto.', specifications: 'Contenido: 1L\\nSabor: Naranja' },
  { nombre: 'Papas Lays Clásicas', category: 'Snacks', brand: 'Local', presentation: 'Unidad', cost: 5, price: 8, stock: 62, expirationDays: 75, image: 'photo-1573080496219-bb080dd4f877', description: 'Papas fritas crujientes con un toque de sal.\\nUn snack para disfrutar en cualquier ocasión.', specifications: 'Contenido: 150g\\nSabor: Clásico' },
  { nombre: 'Maní Salado 100g', category: 'Snacks', brand: 'Local', presentation: 'Unidad', cost: 3.5, price: 6, stock: 46, expirationDays: 100, image: 'photo-1567892737950-30c4db37cd89', description: 'Maní tostado y ligeramente salado, listo para compartir.\\nConservar en un lugar fresco y seco.', specifications: 'Contenido: 100g\\nSabor: Salado' },
  { nombre: 'Galletas de Chocolate', category: 'Snacks', brand: 'Local', presentation: 'Unidad', cost: 4, price: 7, stock: 80, expirationDays: 120, image: 'photo-1499636136210-6f4ee915583e', description: 'Galletas dulces con sabor a chocolate para acompañar el café.\\nEmpaque práctico para llevar.', specifications: 'Contenido: 6 unidades\\nSabor: Chocolate' },
  { nombre: 'Arroz Grano de Oro 1kg', category: 'Abarrotes', brand: 'Local', presentation: 'Unidad', cost: 7, price: 10, stock: 70, expirationDays: 300, image: 'photo-1586201375761-83865001e31c', description: 'Arroz seleccionado para preparar tus platos favoritos.\\nRinde y combina con una gran variedad de comidas.', specifications: 'Peso: 1kg\\nTipo: Grano largo' },
  { nombre: 'Azúcar Blanca 1kg', category: 'Abarrotes', brand: 'Local', presentation: 'Unidad', cost: 6, price: 9, stock: 58, expirationDays: 365, image: 'photo-1581441363689-1f3c3c414635', description: 'Azúcar blanca para endulzar bebidas y preparar postres.\\nAlmacenar en un recipiente cerrado y seco.', specifications: 'Peso: 1kg\\nTipo: Blanca' },
  { nombre: 'Fideo Tallarín 400g', category: 'Abarrotes', brand: 'Local', presentation: 'Unidad', cost: 4, price: 7, stock: 64, expirationDays: 240, image: 'photo-1551462147-ff29053bfc14', description: 'Pasta tipo tallarín, fácil de preparar para tus almuerzos.\\nCombina con salsas, carnes y verduras.', specifications: 'Peso: 400g\\nTipo: Tallarín' },
  { nombre: 'Aceite Vegetal 900ml', category: 'Abarrotes', brand: 'Local', presentation: 'Unidad', cost: 12, price: 17, stock: 38, expirationDays: 270, image: 'photo-1474979266404-7eaacbcd87c5', description: 'Aceite vegetal de uso diario para cocinar y freír.\\nSu presentación facilita el almacenamiento en la cocina.', specifications: 'Contenido: 900ml\\nUso: Cocina' },
  { nombre: 'Café Molido 250g', category: 'Abarrotes', brand: 'Local', presentation: 'Unidad', cost: 13, price: 19, stock: 27, expirationDays: 210, image: 'photo-1559525839-b184a4d698c7', description: 'Café molido aromático para preparar en casa o la oficina.\\nDisfruta su sabor en cualquier momento del día.', specifications: 'Peso: 250g\\nPresentación: Molido' },
  { nombre: 'Chocolate en Barra 100g', category: 'Snacks', brand: 'Local', presentation: 'Unidad', cost: 5, price: 9, stock: 55, expirationDays: 95, image: 'photo-1511381939415-e44015466834', description: 'Barra de chocolate dulce en porción individual.\\nIdeal como antojo o para compartir.', specifications: 'Peso: 100g\\nTipo: Chocolate' },
  { nombre: 'Gaseosa Cola 2L', category: 'Bebidas', brand: 'Coca-Cola', presentation: 'Botella 2L', cost: 19, price: 28, stock: 33, expirationDays: 160, offer: 25, image: 'photo-1554866585-cd94860890b7', description: 'Bebida gaseosa familiar, perfecta para compartir.\\nServir fría para disfrutar mejor su sabor.', specifications: 'Contenido: 2L\\nSabor: Cola' },
  { nombre: 'Leche Chocolatada Pil 200ml', category: 'Abarrotes', brand: 'Pil', presentation: 'Unidad', cost: 2.5, price: 4, stock: 50, expirationDays: 11, image: 'photo-1517093157656-b9eccef91cb1', description: 'Bebida láctea con sabor a chocolate en envase individual.\\nPráctica para loncheras y meriendas.', specifications: 'Contenido: 200ml\\nSabor: Chocolate' },
  { nombre: 'Chips de Plátano 80g', category: 'Snacks', brand: 'Local', presentation: 'Unidad', cost: 4, price: 7, stock: 29, expirationDays: 80, image: 'photo-1573080496219-bb080dd4f877', description: 'Rodajas de plátano crocantes para disfrutar como snack.\\nEmpaque individual que conserva su textura.', specifications: 'Peso: 80g\\nTipo: Plátano' },
  { nombre: 'Harina de Trigo 1kg', category: 'Abarrotes', brand: 'Local', presentation: 'Unidad', cost: 5, price: 8, stock: 43, expirationDays: 330, image: 'photo-1627485937980-221c88ac04f9', description: 'Harina de trigo versátil para panes, masas y repostería.\\nProducto básico para tu despensa.', specifications: 'Peso: 1kg\\nTipo: Trigo' },
  { nombre: 'Gomitas Frutales 100g', category: 'Snacks', brand: 'Local', presentation: 'Unidad', cost: 3, price: 6, stock: 72, expirationDays: 140, image: 'photo-1582058091505-f87a2e55a40f', description: 'Dulces gomitas de sabores frutales variados.\\nPresentación individual para compartir o disfrutar.', specifications: 'Peso: 100g\\nSabores: Frutales' },
  { nombre: 'Agua con Gas 500ml', category: 'Bebidas', brand: 'Local', presentation: 'Unidad', cost: 2.5, price: 5, stock: 68, expirationDays: 300, image: 'photo-1564419320461-6870880221ad', description: 'Agua gasificada en botella individual para acompañar tus comidas.\\nServir fría para disfrutar mejor.', specifications: 'Contenido: 500ml\\nTipo: Gasificada' },
  { nombre: 'Gaseosa Naranja 2L', category: 'Bebidas', brand: 'Local', presentation: 'Botella 2L', cost: 14, price: 22, stock: 36, expirationDays: 150, offer: 20, image: 'photo-1629203851122-3726ecdf080e', description: 'Bebida gaseosa sabor naranja en presentación familiar.\\nIdeal para compartir en reuniones.', specifications: 'Contenido: 2L\\nSabor: Naranja' },
  { nombre: 'Té Helado Durazno 500ml', category: 'Bebidas', brand: 'Local', presentation: 'Botella 500ml', cost: 4, price: 7, stock: 40, expirationDays: 120, image: 'photo-1544145945-f90425340c7e', description: 'Bebida de té con sabor a durazno lista para tomar.\\nDisfrútala fría en cualquier momento.', specifications: 'Contenido: 500ml\\nSabor: Durazno' },
  { nombre: 'Bebida Energizante 250ml', category: 'Bebidas', brand: 'Local', presentation: 'Lata 250ml', cost: 5, price: 9, stock: 32, expirationDays: 180, image: 'photo-1513558161293-cdab7659c1a8', description: 'Bebida energizante en lata individual.\\nConservar en un lugar fresco y seco.', specifications: 'Contenido: 250ml\\nEnvase: Lata' },
  { nombre: 'Leche Entera UHT 1L', category: 'Lácteos', brand: 'Pil', presentation: 'Unidad', cost: 7, price: 10, stock: 44, expirationDays: 180, image: 'photo-1563636619-e9143da7973b', description: 'Leche entera de larga vida para desayunos y recetas.\\nRefrigerar después de abrir.', specifications: 'Contenido: 1L\\nTipo: Entera UHT' },
  { nombre: 'Queso Fresco 500g', category: 'Lácteos', brand: 'Pil', presentation: 'Unidad', cost: 22, price: 30, stock: 18, expirationDays: 14, image: 'photo-1486297678162-eb2a19b0a32d', description: 'Queso fresco de textura suave para desayunos y comidas.\\nMantener refrigerado.', specifications: 'Peso: 500g\\nTipo: Queso fresco' },
  { nombre: 'Mantequilla 200g', category: 'Lácteos', brand: 'Pil', presentation: 'Unidad', cost: 12, price: 17, stock: 22, expirationDays: 45, image: 'photo-1589985270826-4b7bb135bc9d', description: 'Mantequilla cremosa para untar y cocinar.\\nConservar refrigerada.', specifications: 'Peso: 200g\\nTipo: Mantequilla' },
  { nombre: 'Avena Instantánea 400g', category: 'Desayuno', brand: 'Local', presentation: 'Bolsa 400g', cost: 9, price: 14, stock: 30, expirationDays: 240, image: 'photo-1517673132405-a56a62b18caf', description: 'Avena de preparación rápida para desayunos nutritivos.\\nSe puede combinar con leche, fruta o yogurt.', specifications: 'Peso: 400g\\nPreparación: Instantánea' },
  { nombre: 'Cereal de Maíz 300g', category: 'Desayuno', brand: 'Local', presentation: 'Caja 300g', cost: 13, price: 19, stock: 24, expirationDays: 200, image: 'photo-1521483451569-e33803c0330c', description: 'Cereal de maíz crujiente para disfrutar con leche.\\nConservar bien cerrado después de abrir.', specifications: 'Peso: 300g\\nIngrediente principal: Maíz' },
  { nombre: 'Mermelada de Durazno 250g', category: 'Desayuno', brand: 'Local', presentation: 'Frasco 250g', cost: 8, price: 13, stock: 21, expirationDays: 300, image: 'photo-1484723091739-30a097e8f929', description: 'Mermelada dulce de durazno para panes y repostería.\\nMantener refrigerada una vez abierta.', specifications: 'Peso: 250g\\nSabor: Durazno' },
  { nombre: 'Atún en Agua 170g', category: 'Conservas', brand: 'Local', presentation: 'Lata 170g', cost: 9, price: 14, stock: 38, expirationDays: 600, image: 'photo-1535399831218-d5bd36d1a6b3', description: 'Atún en conserva listo para ensaladas y comidas rápidas.\\nUna vez abierto, conservar refrigerado.', specifications: 'Peso neto: 170g\\nConserva: Agua' },
  { nombre: 'Sardina en Salsa de Tomate 425g', category: 'Conservas', brand: 'Local', presentation: 'Lata 425g', cost: 11, price: 17, stock: 26, expirationDays: 540, image: 'photo-1519708227418-c8fd9a32b7a2', description: 'Sardinas en salsa de tomate en lata familiar.\\nLista para servir o acompañar otros platos.', specifications: 'Peso neto: 425g\\nSalsa: Tomate' },
  { nombre: 'Salsa de Tomate 200g', category: 'Condimentos', brand: 'Local', presentation: 'Bolsa 200g', cost: 3.5, price: 6, stock: 42, expirationDays: 240, image: 'photo-1472476443507-c7a5948772fc', description: 'Salsa de tomate para pastas, guisos y preparaciones caseras.\\nAlmacenar en un lugar fresco y seco.', specifications: 'Peso: 200g\\nSabor: Tomate' },
  { nombre: 'Mayonesa 250g', category: 'Condimentos', brand: 'Local', presentation: 'Frasco 250g', cost: 8, price: 13, stock: 25, expirationDays: 180, image: 'photo-1473093295043-cdd812d0e601', description: 'Mayonesa cremosa para acompañar sándwiches y ensaladas.\\nRefrigerar después de abrir.', specifications: 'Peso: 250g\\nTipo: Mayonesa' },
  { nombre: 'Sal Yodada 1kg', category: 'Condimentos', brand: 'Local', presentation: 'Bolsa 1kg', cost: 2.5, price: 4, stock: 50, expirationDays: 900, image: 'photo-1518110925495-5fe2fda0442f', description: 'Sal yodada para uso diario en la cocina.\\nConservar en un lugar seco.', specifications: 'Peso: 1kg\\nTipo: Yodada' },
  { nombre: 'Detergente para Ropa 1kg', category: 'Limpieza', brand: 'Local', presentation: 'Bolsa 1kg', cost: 13, price: 19, stock: 28, expirationDays: 900, image: 'photo-1585421514284-efb74c2b69ba', description: 'Detergente en polvo para el lavado de ropa.\\nSeguir las instrucciones de uso del envase.', specifications: 'Peso: 1kg\\nUso: Lavado de ropa' },
  { nombre: 'Lavandina 1L', category: 'Limpieza', brand: 'Local', presentation: 'Botella 1L', cost: 4, price: 7, stock: 34, expirationDays: 365, image: 'photo-1584622650111-993a426fbf0a', description: 'Lavandina para la limpieza y desinfección del hogar.\\nMantener fuera del alcance de niños.', specifications: 'Contenido: 1L\\nUso: Limpieza del hogar' },
  { nombre: 'Lavavajillas Líquido 500ml', category: 'Limpieza', brand: 'Local', presentation: 'Botella 500ml', cost: 5, price: 9, stock: 31, expirationDays: 540, image: 'photo-1604335399105-a0c585fd81a1', description: 'Detergente líquido para lavar platos y utensilios.\\nDosificar según la cantidad de vajilla.', specifications: 'Contenido: 500ml\\nUso: Lavado de vajilla' },
  { nombre: 'Jabón de Tocador 125g', category: 'Higiene', brand: 'Local', presentation: 'Paquete 125g', cost: 3, price: 5, stock: 46, expirationDays: 900, image: 'photo-1600857544200-b2f666a9a2ec', description: 'Jabón de tocador para la higiene diaria.\\nConservar en un lugar fresco y seco.', specifications: 'Peso: 125g\\nUso: Higiene personal' },
  { nombre: 'Shampoo Familiar 400ml', category: 'Cuidado personal', brand: 'Local', presentation: 'Botella 400ml', cost: 12, price: 18, stock: 20, expirationDays: 720, image: 'photo-1608248543803-ba4f8c70ae0b', description: 'Shampoo de uso diario en presentación familiar.\\nAplicar sobre el cabello húmedo y enjuagar.', specifications: 'Contenido: 400ml\\nUso: Cuidado capilar' },
  { nombre: 'Pasta Dental 90g', category: 'Cuidado personal', brand: 'Local', presentation: 'Unidad', cost: 6, price: 10, stock: 27, expirationDays: 720, image: 'photo-1609840114035-3c981b782dfe', description: 'Pasta dental para la higiene bucal diaria.\\nUsar con un cepillo dental adecuado.', specifications: 'Contenido: 90g\\nUso: Higiene bucal' },
  { nombre: 'Papel Higiénico Paquete x4', category: 'Higiene', brand: 'Local', presentation: 'Paquete x4', cost: 10, price: 15, stock: 23, expirationDays: 900, image: 'photo-1584556812952-905ffd0c611a', description: 'Paquete de papel higiénico para uso doméstico.\\nGuardar en un lugar limpio y seco.', specifications: 'Contenido: 4 rollos\\nUso: Higiene personal' },
  { nombre: 'Servilletas Paquete x100', category: 'Limpieza', brand: 'Local', presentation: 'Paquete x100', cost: 4, price: 7, stock: 39, expirationDays: 900, image: 'photo-1604719312566-8912e9c8a213', description: 'Servilletas de papel para la mesa y el uso diario.\\nConservar en su empaque hasta utilizar.', specifications: 'Contenido: 100 unidades\\nMaterial: Papel' },
  { nombre: 'Esponja para Cocina', category: 'Limpieza', brand: 'Local', presentation: 'Unidad', cost: 2, price: 4, stock: 51, expirationDays: 900, image: 'photo-1583947581924-860bda6a26df', description: 'Esponja multiuso para lavar platos y superficies de cocina.\\nEnjuagar y dejar secar después de usar.', specifications: 'Uso: Limpieza de cocina\\nPresentación: Unidad' },
  { nombre: 'Jabón en Polvo 500g', category: 'Limpieza', brand: 'Local', presentation: 'Bolsa 500g', cost: 7, price: 11, stock: 29, expirationDays: 900, image: 'photo-1585421514284-efb74c2b69ba', description: 'Jabón en polvo para el lavado cotidiano de prendas.\\nAlmacenar cerrado y en un lugar seco.', specifications: 'Peso: 500g\\nUso: Lavado de ropa' },
  { nombre: 'Lenteja 500g', category: 'Abarrotes', brand: 'Local', presentation: 'Bolsa 500g', cost: 7, price: 11, stock: 33, expirationDays: 300, image: 'photo-1515543904379-3d757afe72e4', description: 'Lentejas seleccionadas para sopas y guisos.\\nConservar en un recipiente seco y cerrado.', specifications: 'Peso: 500g\\nTipo: Legumbre' },
  { nombre: 'Frijol Rojo 1kg', category: 'Abarrotes', brand: 'Local', presentation: 'Bolsa 1kg', cost: 12, price: 18, stock: 24, expirationDays: 300, image: 'photo-1551462147-ff29053bfc14', description: 'Frijol rojo seco para preparar comidas tradicionales.\\nSeleccionar y lavar antes de cocinar.', specifications: 'Peso: 1kg\\nTipo: Legumbre' },
  { nombre: 'Maíz para Cancha 500g', category: 'Abarrotes', brand: 'Local', presentation: 'Bolsa 500g', cost: 6, price: 10, stock: 28, expirationDays: 270, image: 'photo-1601593768794-2e6df3f87b3c', description: 'Maíz seleccionado para preparar cancha crocante.\\nConservar en un lugar fresco y seco.', specifications: 'Peso: 500g\\nUso: Tostado' },
  { nombre: 'Galletas de Vainilla 120g', category: 'Snacks', brand: 'Local', presentation: 'Paquete 120g', cost: 3.5, price: 6, stock: 45, expirationDays: 120, image: 'photo-1499636136210-6f4ee915583e', description: 'Galletas dulces de vainilla para acompañar bebidas calientes.\\nEmpaque individual para conservar su frescura.', specifications: 'Peso: 120g\\nSabor: Vainilla' },
  { nombre: 'Caramelos Surtidos 100g', category: 'Snacks', brand: 'Local', presentation: 'Bolsa 100g', cost: 3, price: 6, stock: 57, expirationDays: 240, image: 'photo-1582058091505-f87a2e55a40f', description: 'Caramelos de sabores variados en una práctica bolsa.\\nIdeal para compartir.', specifications: 'Peso: 100g\\nSabores: Surtidos' },
];

function dateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function imageUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=80`;
}

async function insertOrGetNamedRows(client, table, names, negocioId) {
  const rows = new Map();
  for (const name of names) {
    const result = await client.query(
      `INSERT INTO public.${table} (negocio_id, nombre)
       VALUES ($1, $2)
       ON CONFLICT (negocio_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id, nombre`,
      [negocioId, name],
    );
    rows.set(name, result.rows[0].id);
  }
  return rows;
}

async function insertOrGetSupplier(client, negocioId) {
  const existing = await client.query(
    `SELECT id
       FROM public.proveedores
      WHERE negocio_id = $1 AND LOWER(BTRIM(nombre_empresa)) = LOWER($2)
      ORDER BY creado_en, id
      LIMIT 1`,
    [negocioId, SUPPLIER_NAME],
  );
  if (existing.rowCount) return existing.rows[0].id;

  const inserted = await client.query(
    `INSERT INTO public.proveedores (negocio_id, nombre_empresa, contacto_nombre, telefono, direccion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [negocioId, SUPPLIER_NAME, 'Atención a clientes', '70000000', 'Bolivia'],
  );
  return inserted.rows[0].id;
}

async function generateUniqueBarcode(client, negocioId, generatedBarcodes) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const barcode = String(randomInt(100000000000, 999999999999));
    if (generatedBarcodes.has(barcode)) continue;
    const existing = await client.query(
      'SELECT 1 FROM public.productos WHERE negocio_id = $1 AND codigo_barras = $2',
      [negocioId, barcode],
    );
    if (!existing.rowCount) {
      generatedBarcodes.add(barcode);
      return barcode;
    }
  }
  throw new Error('No se pudo generar un código de barras único después de varios intentos.');
}

async function seedProducts(client, negocioId, categories, brands, presentations, supplierId) {
  const generatedBarcodes = new Set();
  const seededProducts = [];

  for (const item of productDefinitions) {
    const values = {
      negocioId,
      categoryId: categories.get(item.category),
      brandId: brands.get(item.brand),
      presentationId: presentations.get(item.presentation),
      supplierId,
      nombre: item.nombre,
      precio_compra: item.cost,
      precio_venta: item.price,
      precio_mayorista: Number((item.price * 0.94).toFixed(2)),
      stock_actual: item.stock,
      stock_minimo: 5,
      fecha_vencimiento: dateAfterDays(item.expirationDays),
      activo: true,
      imagen_url: imageUrl(item.image),
      en_oferta: Number.isFinite(item.offer),
      precio_oferta: Number.isFinite(item.offer) ? item.offer : null,
      descripcion_larga: item.description.replaceAll('\\n', '\n'),
      especificaciones: item.specifications.replaceAll('\\n', '\n'),
    };

    const existing = await client.query(
      `SELECT id, codigo_barras
         FROM public.productos
        WHERE negocio_id = $1 AND nombre = $2
        ORDER BY id
        LIMIT 1`,
      [negocioId, item.nombre],
    );

    let result;
    if (existing.rowCount) {
      result = await client.query(
        `UPDATE public.productos
            SET categoria_id = $1, marca_id = $2, presentacion_id = $3, proveedor_id = $4,
                nombre = $5, precio_compra = $6, precio_venta = $7, precio_mayorista = $8,
                stock_actual = $9, stock_minimo = $10, fecha_vencimiento = $11, activo = $12,
                imagen_url = $13, en_oferta = $14, precio_oferta = $15,
                descripcion_larga = $16, especificaciones = $17
          WHERE id = $18
          RETURNING id, nombre, codigo_barras`,
        [
          values.categoryId, values.brandId, values.presentationId, values.supplierId,
          values.nombre, values.precio_compra, values.precio_venta, values.precio_mayorista,
          values.stock_actual, values.stock_minimo, values.fecha_vencimiento, values.activo,
          values.imagen_url, values.en_oferta, values.precio_oferta,
          values.descripcion_larga, values.especificaciones, existing.rows[0].id,
        ],
      );
    } else {
      const barcode = await generateUniqueBarcode(client, negocioId, generatedBarcodes);
      result = await client.query(
        `INSERT INTO public.productos
           (negocio_id, categoria_id, marca_id, presentacion_id, proveedor_id, codigo_barras,
            nombre, precio_compra, precio_venta, precio_mayorista, stock_actual, stock_minimo,
            fecha_vencimiento, activo, imagen_url, en_oferta, precio_oferta,
            descripcion_larga, especificaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING id, nombre, codigo_barras`,
        [
          values.negocioId, values.categoryId, values.brandId, values.presentationId,
          values.supplierId, barcode, values.nombre, values.precio_compra, values.precio_venta,
          values.precio_mayorista, values.stock_actual, values.stock_minimo,
          values.fecha_vencimiento, values.activo, values.imagen_url, values.en_oferta,
          values.precio_oferta, values.descripcion_larga, values.especificaciones,
        ],
      );
    }
    seededProducts.push(result.rows[0]);
  }
  return seededProducts;
}

async function main() {
  await initializeDatabase();
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('finora-productos-seeder'))");

    const businessResult = await client.query(
      'SELECT id, nombre FROM public.negocios ORDER BY creado_en ASC, id ASC LIMIT 1',
    );
    if (!businessResult.rowCount) throw new Error('No hay negocios registrados para asociar los productos.');
    const business = businessResult.rows[0];
    console.log(`Negocio seleccionado: ${business.nombre} (${business.id})`);

    const categories = await insertOrGetNamedRows(client, 'categorias', CATEGORY_NAMES, business.id);
    const brands = await insertOrGetNamedRows(client, 'marcas', BRAND_NAMES, business.id);
    const presentations = await insertOrGetNamedRows(client, 'presentaciones', PRESENTATION_NAMES, business.id);
    const supplierId = await insertOrGetSupplier(client, business.id);
    const products = await seedProducts(client, business.id, categories, brands, presentations, supplierId);

    await client.query('COMMIT');
    transactionOpen = false;
    console.log('IDs de datos maestros:');
    console.log(JSON.stringify({
      categorias: Object.fromEntries(categories),
      marcas: Object.fromEntries(brands),
      presentaciones: Object.fromEntries(presentations),
      proveedor: supplierId,
    }, null, 2));
    console.log(`Productos insertados o actualizados: ${products.length}`);
    products.forEach((product) => {
      console.log(`- ${product.nombre}: ${product.id} (código ${product.codigo_barras})`);
    });
    console.log('Seeder de productos ejecutado correctamente.');
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
    console.error('Error al ejecutar el seeder de productos:', error);
    await pool.end();
    process.exitCode = 1;
  });
