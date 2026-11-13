ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.turnos_caja
  ADD COLUMN IF NOT EXISTS total_tarjeta_esperado NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pagos_venta (
  id SERIAL PRIMARY KEY,
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  turno_id UUID REFERENCES public.turnos_caja(id) ON DELETE SET NULL,
  usuario_id UUID,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('efectivo', 'qr', 'tarjeta')),
  referencia_nota TEXT
);

UPDATE public.ventas v
   SET saldo_pendiente = v.total,
       estado = 'pendiente'
 WHERE LOWER(v.metodo_pago) = 'credito'
   AND UPPER(v.estado) <> 'ANULADA'
   AND v.saldo_pendiente = 0
   AND NOT EXISTS (SELECT 1 FROM public.pagos_venta p WHERE p.venta_id = v.id);

ALTER TABLE public.ventas
  ALTER COLUMN estado SET DEFAULT 'completada';

UPDATE public.turnos_caja t
   SET total_tarjeta_esperado = COALESCE((
     SELECT SUM(v.monto_tarjeta)
       FROM public.ventas v
      WHERE v.turno_id = t.id
        AND UPPER(v.estado) <> 'ANULADA'
   ), 0)
 WHERE t.total_tarjeta_esperado = 0;

CREATE INDEX IF NOT EXISTS pagos_venta_sale_date_idx
  ON public.pagos_venta (venta_id, fecha_pago DESC);

CREATE INDEX IF NOT EXISTS clientes_business_name_idx
  ON public.clientes (negocio_id, nombre);

ALTER TABLE public.pagos_venta ENABLE ROW LEVEL SECURITY;
