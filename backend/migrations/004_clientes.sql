CREATE TABLE IF NOT EXISTS public.clientes (
  id SERIAL PRIMARY KEY,
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(50),
  nit_ci VARCHAR(50),
  direccion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
