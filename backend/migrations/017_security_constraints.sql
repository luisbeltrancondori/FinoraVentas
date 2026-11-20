-- =============================================================
-- Migración 017: Constraints de integridad y seguridad + egresos de caja
-- BD-01: CHECK stock_actual >= 0
-- BD-02: CHECK constraints financieros en tablas críticas
-- BD-04: FK usuario_id en compras, pagos_compra y turnos_caja
-- TRX-03: Columna total_egresos_proveedores en turnos_caja
-- Idempotente: usa DO $$ ... IF NOT EXISTS en re-ejecuciones.
-- =============================================================

-- -------------------------------------------------------
-- TRX-03: Columna de egresos por pagos a proveedores
-- -------------------------------------------------------
ALTER TABLE public.turnos_caja
  ADD COLUMN IF NOT EXISTS total_egresos_proveedores NUMERIC(10,2) NOT NULL DEFAULT 0;

-- -------------------------------------------------------
-- BD-04: Foreign keys de usuario_id hacia pos_users
-- -------------------------------------------------------
DO $$
BEGIN
  -- compras.usuario_id → pos_users (RESTRICT: no borrar usuario con compras)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'compras_usuario_id_fkey'
      AND conrelid = 'public.compras'::regclass
  ) THEN
    -- Limpiar posibles usuario_id inválidos antes de agregar la FK
    UPDATE public.compras SET usuario_id = NULL WHERE usuario_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.pos_users WHERE id = public.compras.usuario_id);
    ALTER TABLE public.compras
      ADD CONSTRAINT compras_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES public.pos_users(id) ON DELETE RESTRICT;
  END IF;

  -- pagos_compra.usuario_id → pos_users (SET NULL: conservar historial si usuario es borrado)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagos_compra_usuario_id_fkey'
      AND conrelid = 'public.pagos_compra'::regclass
  ) THEN
    UPDATE public.pagos_compra SET usuario_id = NULL WHERE usuario_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.pos_users WHERE id = public.pagos_compra.usuario_id);
    ALTER TABLE public.pagos_compra
      ADD CONSTRAINT pagos_compra_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES public.pos_users(id) ON DELETE SET NULL;
  END IF;

  -- turnos_caja.usuario_id → pos_users (RESTRICT: no borrar usuario con turnos abiertos)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'turnos_caja_usuario_id_fkey'
      AND conrelid = 'public.turnos_caja'::regclass
  ) THEN
    UPDATE public.turnos_caja SET usuario_id = NULL WHERE usuario_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.pos_users WHERE id = public.turnos_caja.usuario_id);
    ALTER TABLE public.turnos_caja
      ADD CONSTRAINT turnos_caja_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES public.pos_users(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  -- -------------------------------------------------------
  -- BD-01: stock_actual no puede ser negativo
  -- -------------------------------------------------------
  -- Corregir registros negativos preexistentes antes del constraint
  UPDATE public.productos SET stock_actual = 0 WHERE stock_actual < 0;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_stock_no_negativo'
      AND conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT chk_stock_no_negativo CHECK (stock_actual >= 0);
  END IF;

  -- -------------------------------------------------------
  -- BD-02: Constraints financieros en productos
  -- -------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_precio_compra_positivo'
      AND conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT chk_precio_compra_positivo CHECK (precio_compra >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_precio_venta_positivo'
      AND conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT chk_precio_venta_positivo CHECK (precio_venta >= 0);
  END IF;

  -- -------------------------------------------------------
  -- BD-02: Constraints financieros en compras
  -- -------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_compras_subtotal'
      AND conrelid = 'public.compras'::regclass
  ) THEN
    ALTER TABLE public.compras
      ADD CONSTRAINT chk_compras_subtotal CHECK (subtotal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_compras_descuento'
      AND conrelid = 'public.compras'::regclass
  ) THEN
    ALTER TABLE public.compras
      ADD CONSTRAINT chk_compras_descuento CHECK (descuento >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_compras_total'
      AND conrelid = 'public.compras'::regclass
  ) THEN
    ALTER TABLE public.compras
      ADD CONSTRAINT chk_compras_total CHECK (total >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_compras_saldo'
      AND conrelid = 'public.compras'::regclass
  ) THEN
    ALTER TABLE public.compras
      ADD CONSTRAINT chk_compras_saldo CHECK (saldo_pendiente >= 0);
  END IF;

  -- -------------------------------------------------------
  -- BD-02: Constraints financieros en compra_detalles
  -- -------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_compra_det_cantidad'
      AND conrelid = 'public.compra_detalles'::regclass
  ) THEN
    ALTER TABLE public.compra_detalles
      ADD CONSTRAINT chk_compra_det_cantidad CHECK (cantidad > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_compra_det_precio'
      AND conrelid = 'public.compra_detalles'::regclass
  ) THEN
    ALTER TABLE public.compra_detalles
      ADD CONSTRAINT chk_compra_det_precio CHECK (precio_costo_unitario >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_compra_det_subtotal'
      AND conrelid = 'public.compra_detalles'::regclass
  ) THEN
    ALTER TABLE public.compra_detalles
      ADD CONSTRAINT chk_compra_det_subtotal CHECK (subtotal >= 0);
  END IF;

  -- -------------------------------------------------------
  -- BD-02: Constraints financieros en ventas
  -- -------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ventas_subtotal'
      AND conrelid = 'public.ventas'::regclass
  ) THEN
    ALTER TABLE public.ventas
      ADD CONSTRAINT chk_ventas_subtotal CHECK (subtotal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ventas_descuento'
      AND conrelid = 'public.ventas'::regclass
  ) THEN
    ALTER TABLE public.ventas
      ADD CONSTRAINT chk_ventas_descuento CHECK (descuento >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ventas_total'
      AND conrelid = 'public.ventas'::regclass
  ) THEN
    ALTER TABLE public.ventas
      ADD CONSTRAINT chk_ventas_total CHECK (total >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ventas_saldo'
      AND conrelid = 'public.ventas'::regclass
  ) THEN
    ALTER TABLE public.ventas
      ADD CONSTRAINT chk_ventas_saldo CHECK (saldo_pendiente >= 0);
  END IF;

  -- -------------------------------------------------------
  -- BD-02: Constraints financieros en venta_detalles
  -- -------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_venta_det_cantidad'
      AND conrelid = 'public.venta_detalles'::regclass
  ) THEN
    ALTER TABLE public.venta_detalles
      ADD CONSTRAINT chk_venta_det_cantidad CHECK (cantidad > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_venta_det_precio'
      AND conrelid = 'public.venta_detalles'::regclass
  ) THEN
    ALTER TABLE public.venta_detalles
      ADD CONSTRAINT chk_venta_det_precio CHECK (precio_unitario >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_venta_det_subtotal'
      AND conrelid = 'public.venta_detalles'::regclass
  ) THEN
    ALTER TABLE public.venta_detalles
      ADD CONSTRAINT chk_venta_det_subtotal CHECK (subtotal >= 0);
  END IF;

END $$;

-- -------------------------------------------------------
-- BD-05: Índices críticos faltantes
-- Todos usan IF NOT EXISTS para ser idempotentes.
-- -------------------------------------------------------

-- Índice parcial para turno de caja abierto (consultado en CADA venta)
CREATE INDEX IF NOT EXISTS idx_turnos_caja_negocio_abierto
  ON public.turnos_caja (negocio_id, fecha_apertura DESC)
  WHERE UPPER(estado) = 'ABIERTA';

-- venta_detalles: FK sin índice (tabla de alto volumen)
CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta_id
  ON public.venta_detalles (venta_id);

CREATE INDEX IF NOT EXISTS idx_venta_detalles_producto_id
  ON public.venta_detalles (producto_id);

-- ventas: FK turno y cliente sin índice
CREATE INDEX IF NOT EXISTS idx_ventas_turno_id
  ON public.ventas (turno_id);

CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id
  ON public.ventas (cliente_id);

-- compras: FK proveedor sin índice
CREATE INDEX IF NOT EXISTS idx_compras_proveedor_id
  ON public.compras (proveedor_id);

-- productos: negocio y categoría (filtros frecuentes en listados POS)
CREATE INDEX IF NOT EXISTS idx_productos_negocio_id
  ON public.productos (negocio_id);

CREATE INDEX IF NOT EXISTS idx_productos_categoria_id
  ON public.productos (categoria_id);

-- productos: búsqueda de texto por nombre (requiere extensión pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm
  ON public.productos USING gin (nombre gin_trgm_ops);
