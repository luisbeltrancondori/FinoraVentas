ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS descripcion_larga TEXT,
  ADD COLUMN IF NOT EXISTS especificaciones TEXT;
