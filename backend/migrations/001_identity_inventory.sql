ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS imagen_url TEXT;

CREATE TABLE IF NOT EXISTS public.pos_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('administrador', 'cajero', 'almacenero')),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pos_user_negocios (
  usuario_id UUID NOT NULL REFERENCES public.pos_users(id) ON DELETE CASCADE,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, negocio_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  usuario_id UUID NOT NULL REFERENCES public.pos_users(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('inventario_fisico', 'ajuste')),
  stock_anterior NUMERIC(10,2) NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  stock_nuevo NUMERIC(10,2) NOT NULL,
  motivo VARCHAR(300) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pos_user_negocios_negocio_idx ON public.pos_user_negocios (negocio_id);
CREATE INDEX IF NOT EXISTS inventory_adjustments_business_date_idx
  ON public.inventory_adjustments (negocio_id, creado_en DESC);
