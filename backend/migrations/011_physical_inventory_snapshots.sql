ALTER TABLE public.inventarios_fisicos_detalle
  ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50),
  ADD COLUMN IF NOT EXISTS producto_nombre VARCHAR(150),
  ADD COLUMN IF NOT EXISTS presentacion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(10,2) DEFAULT 0;

UPDATE public.inventarios_fisicos_detalle d
   SET codigo_barras = p.codigo_barras,
       producto_nombre = p.nombre,
       presentacion = COALESCE(pr.nombre, ''),
       costo_unitario = COALESCE(p.precio_compra, 0)
  FROM public.productos p
  LEFT JOIN public.presentaciones pr ON pr.id = p.presentacion_id
 WHERE p.id = d.producto_id
   AND d.producto_nombre IS NULL;

ALTER TABLE public.inventarios_fisicos_detalle
  ALTER COLUMN producto_nombre SET NOT NULL,
  ALTER COLUMN costo_unitario SET DEFAULT 0,
  ALTER COLUMN costo_unitario SET NOT NULL;
