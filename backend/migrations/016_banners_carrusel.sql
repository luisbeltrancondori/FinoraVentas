CREATE TABLE IF NOT EXISTS public.banners_carrusel (
  id SERIAL PRIMARY KEY,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  titulo VARCHAR(150),
  imagen_url TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS banners_carrusel_business_order_idx
  ON public.banners_carrusel (negocio_id, activo, orden, id);

CREATE TABLE IF NOT EXISTS public.configuracion_tienda_publica (
  negocio_id UUID PRIMARY KEY REFERENCES public.negocios(id) ON DELETE CASCADE,
  ofertas_hasta TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
