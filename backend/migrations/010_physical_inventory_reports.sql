CREATE TABLE IF NOT EXISTS public.inventarios_fisicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.pos_users(id),
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

CREATE INDEX IF NOT EXISTS inventarios_fisicos_business_date_idx
  ON public.inventarios_fisicos (negocio_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS inventarios_fisicos_detalle_product_idx
  ON public.inventarios_fisicos_detalle (producto_id);

ALTER TABLE public.inventarios_fisicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios_fisicos_detalle ENABLE ROW LEVEL SECURITY;
