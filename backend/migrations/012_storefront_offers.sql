ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS en_oferta BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS precio_oferta NUMERIC(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'productos_precio_oferta_valid_check'
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT productos_precio_oferta_valid_check
      CHECK (
        (NOT en_oferta AND precio_oferta IS NULL)
        OR (en_oferta AND precio_oferta >= 0 AND precio_oferta < precio_venta)
      );
  END IF;
END;
$$;
