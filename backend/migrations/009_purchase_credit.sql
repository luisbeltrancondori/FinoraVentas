ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30) NOT NULL DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'pagada',
  ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS costo_anterior NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_anterior DATE;

CREATE TABLE IF NOT EXISTS public.pagos_compra (
  id BIGSERIAL PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE RESTRICT,
  usuario_id UUID,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia')),
  referencia TEXT
);

WITH ordered_details AS (
  SELECT d.id, d.producto_id, d.precio_costo_unitario, d.fecha_vencimiento,
         ROW_NUMBER() OVER (PARTITION BY d.producto_id ORDER BY c.fecha_compra, d.id) AS sequence,
         LAG(d.precio_costo_unitario) OVER (PARTITION BY d.producto_id ORDER BY c.fecha_compra, d.id) AS previous_cost,
         LAG(d.fecha_vencimiento) OVER (PARTITION BY d.producto_id ORDER BY c.fecha_compra, d.id) AS previous_expiration,
         c.negocio_id, c.fecha_compra, d.cantidad
    FROM public.compra_detalles d
    JOIN public.compras c ON c.id = d.compra_id
)
INSERT INTO public.lotes
  (negocio_id, compra_detalle_id, producto_id, cantidad, fecha_vencimiento,
   costo_unitario, costo_anterior, fecha_vencimiento_anterior, created_at)
SELECT negocio_id, id, producto_id, cantidad, fecha_vencimiento,
       precio_costo_unitario, previous_cost, previous_expiration,
       fecha_compra + (sequence * INTERVAL '1 microsecond')
  FROM ordered_details
ON CONFLICT (compra_detalle_id) DO NOTHING;

UPDATE public.compras
   SET estado = 'pagada',
       saldo_pendiente = 0
 WHERE estado NOT IN ('pagada', 'pendiente', 'parcial', 'anulada');

INSERT INTO public.pagos_compra (compra_id, monto, metodo_pago, referencia)
SELECT c.id, c.total, 'efectivo', 'Pago histórico migrado'
  FROM public.compras c
 WHERE c.estado = 'pagada'
   AND c.total > 0
   AND NOT EXISTS (SELECT 1 FROM public.pagos_compra pc WHERE pc.compra_id = c.id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_estado_valid_check') THEN
    ALTER TABLE public.compras
      ADD CONSTRAINT compras_estado_valid_check
      CHECK (estado IN ('pagada', 'pendiente', 'parcial', 'anulada'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_metodo_pago_valid_check') THEN
    ALTER TABLE public.compras
      ADD CONSTRAINT compras_metodo_pago_valid_check
      CHECK (metodo_pago IN ('efectivo', 'transferencia', 'credito'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS pagos_compra_purchase_date_idx
  ON public.pagos_compra (compra_id, fecha_pago DESC);

CREATE INDEX IF NOT EXISTS compras_business_date_idx
  ON public.compras (negocio_id, fecha_compra DESC);

ALTER TABLE public.pagos_compra ENABLE ROW LEVEL SECURITY;
