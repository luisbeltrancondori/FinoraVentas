-- =========================================================================
-- SCRIPT MAESTRO COMPLETO - SISTEMA DE VENTAS E INVENTARIO (POS)
-- =========================================================================

-- 1. Negocio / Sucursal
CREATE TABLE public.negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  nit VARCHAR(30),
  direccion TEXT,
  telefono VARCHAR(20),
  moneda VARCHAR(10) DEFAULT 'Bs',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Proveedores (Tabla Independiente)
CREATE TABLE public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre_empresa VARCHAR(150) NOT NULL,
  contacto_nombre VARCHAR(100),
  telefono VARCHAR(20),
  nit_ci VARCHAR(50),
  direccion TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Marcas (Tabla Independiente)
CREATE TABLE public.marcas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  UNIQUE(negocio_id, nombre)
);

-- 4. Presentaciones (Tabla Independiente - Ej: Litro, Caja x12, Bolsa 5kg)
CREATE TABLE public.presentaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  UNIQUE(negocio_id, nombre)
);

-- 5. Categorías (Ej: Detergentes, Bebidas Alcohólicas, Abarrotes)
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  UNIQUE(negocio_id, nombre)
);

-- 6. Productos (Conectado a categorías, marcas, presentaciones y proveedores)
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  marca_id UUID REFERENCES public.marcas(id) ON DELETE SET NULL,
  presentacion_id UUID REFERENCES public.presentaciones(id) ON DELETE SET NULL,
  proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  
  codigo_barras VARCHAR(50),
  nombre VARCHAR(150) NOT NULL,
  precio_compra NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(10,2) NOT NULL,
  precio_mayorista NUMERIC(10,2),
  stock_actual NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(10,2) DEFAULT 5,
  fecha_vencimiento DATE,
  activo BOOLEAN DEFAULT TRUE,
  
  UNIQUE(negocio_id, codigo_barras)
);

-- 7. Compras a Proveedores (Cabecera)
CREATE TABLE public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  numero_factura VARCHAR(50),
  subtotal NUMERIC(10,2) NOT NULL,
  descuento NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  metodo_pago VARCHAR(30) NOT NULL DEFAULT 'efectivo',
  estado VARCHAR(20) NOT NULL DEFAULT 'pagada',
  saldo_pendiente NUMERIC(10,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  fecha_compra TIMESTAMPTZ DEFAULT NOW(),
  usuario_id UUID NOT NULL
);

-- 8. Detalle de la Compra
CREATE TABLE public.compra_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID REFERENCES public.compras(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  cantidad NUMERIC(10,2) NOT NULL,
  precio_costo_unitario NUMERIC(10,2) NOT NULL,
  fecha_vencimiento DATE,
  subtotal NUMERIC(10,2) NOT NULL
);

CREATE TABLE public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  compra_detalle_id UUID NOT NULL UNIQUE REFERENCES public.compra_detalles(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  cantidad NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  fecha_vencimiento DATE,
  costo_unitario NUMERIC(10,2) NOT NULL CHECK (costo_unitario >= 0),
  costo_anterior NUMERIC(10,2),
  fecha_vencimiento_anterior DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.pagos_compra (
  id BIGSERIAL PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE RESTRICT,
  usuario_id UUID,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia')),
  referencia TEXT
);

CREATE TABLE IF NOT EXISTS public.inventarios_fisicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  motivo VARCHAR(300) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventarios_fisicos_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_fisico_id UUID NOT NULL REFERENCES public.inventarios_fisicos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  codigo_barras VARCHAR(50),
  producto_nombre VARCHAR(150) NOT NULL,
  presentacion VARCHAR(100),
  saldo_sistema NUMERIC(10,2) NOT NULL,
  saldo_contado NUMERIC(10,2) NOT NULL CHECK (saldo_contado >= 0),
  diferencia NUMERIC(10,2) NOT NULL,
  costo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  UNIQUE (inventario_fisico_id, producto_id)
);

-- 9. Turnos de Caja
CREATE TABLE public.turnos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  monto_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_efectivo_esperado NUMERIC(10,2) DEFAULT 0,
  total_qr_esperado NUMERIC(10,2) DEFAULT 0,
  total_tarjeta_esperado NUMERIC(10,2) NOT NULL DEFAULT 0,
  monto_real_contado NUMERIC(10,2),
  diferencia NUMERIC(10,2),
  estado VARCHAR(20) DEFAULT 'abierta'
);

-- 10. Ventas y Detalle (POS)
CREATE TABLE public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  turno_id UUID REFERENCES public.turnos_caja(id),
  numero_ticket SERIAL,
  cliente_id INTEGER,
  cliente_nombre VARCHAR(150) DEFAULT 'Cliente General',
  cliente_contacto VARCHAR(50),
  subtotal NUMERIC(10,2) NOT NULL,
  descuento NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  metodo_pago VARCHAR(30) NOT NULL, -- 'efectivo', 'qr', 'mixto', 'credito'
  monto_efectivo NUMERIC(10,2) DEFAULT 0,
  monto_qr NUMERIC(10,2) DEFAULT 0,
  monto_tarjeta NUMERIC(10,2) NOT NULL DEFAULT 0,
  monto_credito NUMERIC(10,2) NOT NULL DEFAULT 0,
  monto_recibido NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'completada',
  saldo_pendiente NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_venta TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Clientes y deudores
CREATE TABLE IF NOT EXISTS public.clientes (
  id SERIAL PRIMARY KEY,
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  nombre_completo VARCHAR(150) NOT NULL,
  telefono VARCHAR(50),
  nit_ci VARCHAR(50),
  email VARCHAR(254),
  direccion TEXT,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS clientes_business_nit_ci_uidx
  ON public.clientes (negocio_id, LOWER(BTRIM(nit_ci)))
  WHERE nit_ci IS NOT NULL AND BTRIM(nit_ci) <> '';

ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE TABLE public.pagos_venta (
  id SERIAL PRIMARY KEY,
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  turno_id UUID REFERENCES public.turnos_caja(id) ON DELETE SET NULL,
  usuario_id UUID,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('efectivo', 'qr', 'tarjeta')),
  referencia_nota TEXT
);

CREATE INDEX IF NOT EXISTS pagos_venta_sale_date_idx
  ON public.pagos_venta (venta_id, fecha_pago DESC);

CREATE TABLE public.venta_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  costo_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);

-- 11. Habilitar Seguridad RLS
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios_fisicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios_fisicos_detalle ENABLE ROW LEVEL SECURITY;

-- 12. Permisos opcionales para instalaciones que definan estos roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated';
  END IF;
END;
$$;