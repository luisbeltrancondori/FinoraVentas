CREATE TABLE IF NOT EXISTS public.proformas_web (
  id SERIAL PRIMARY KEY,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_nombre VARCHAR(150) NOT NULL DEFAULT 'Cliente Web',
  telefono VARCHAR(50),
  items JSONB NOT NULL,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'VENDIDO', 'CANCELADO')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS proformas_web_business_status_date_idx
  ON public.proformas_web (negocio_id, estado, created_at DESC);
