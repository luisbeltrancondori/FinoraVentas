CREATE TABLE IF NOT EXISTS public.contactos_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  mensaje TEXT NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leido BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS contactos_mensajes_fecha_idx
  ON public.contactos_mensajes (fecha_creacion DESC);

CREATE INDEX IF NOT EXISTS contactos_mensajes_no_leidos_idx
  ON public.contactos_mensajes (fecha_creacion DESC)
  WHERE leido = FALSE;
