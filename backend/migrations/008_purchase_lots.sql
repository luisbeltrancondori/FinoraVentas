ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS nit_ci VARCHAR(50);

ALTER TABLE public.compra_detalles
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

CREATE TABLE IF NOT EXISTS public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  compra_detalle_id UUID NOT NULL UNIQUE REFERENCES public.compra_detalles(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  cantidad NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  fecha_vencimiento DATE,
  costo_unitario NUMERIC(10,2) NOT NULL CHECK (costo_unitario >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lotes_business_product_expiration_idx
  ON public.lotes (negocio_id, producto_id, fecha_vencimiento);

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
