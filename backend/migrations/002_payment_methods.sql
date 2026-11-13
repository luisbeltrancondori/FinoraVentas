ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS cliente_contacto VARCHAR(50),
  ADD COLUMN IF NOT EXISTS monto_tarjeta NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_credito NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS turnos_caja_business_opened_idx
  ON public.turnos_caja (negocio_id, fecha_apertura DESC);
