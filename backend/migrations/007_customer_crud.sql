ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nombre_completo VARCHAR(150),
  ADD COLUMN IF NOT EXISTS email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.clientes
   SET nombre_completo = nombre
 WHERE nombre_completo IS NULL;

ALTER TABLE public.clientes
  ALTER COLUMN nombre_completo SET NOT NULL;

UPDATE public.clientes
   SET negocio_id = (SELECT id FROM public.negocios LIMIT 1)
 WHERE negocio_id IS NULL
   AND (SELECT COUNT(*) FROM public.negocios) = 1;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_business_nit_ci_uidx
  ON public.clientes (negocio_id, LOWER(BTRIM(nit_ci)))
  WHERE nit_ci IS NOT NULL AND BTRIM(nit_ci) <> '';
