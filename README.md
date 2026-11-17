# Finora POS

Sistema local de punto de venta con React/Vite, Express y PostgreSQL multi-sucursal.

## Inicio con Docker

1. (Recomendado) Define un secreto de sesión aleatorio en un archivo `.env` junto a `docker-compose.yml`:

   ```env
   POS_SESSION_SECRET=usa-aqui-un-secreto-aleatorio-largo-y-privado
   ```

   No compartas ni subas ese valor al control de versiones. Si no se define, el backend genera un secreto temporal y las sesiones se invalidan al reiniciar.

2. Desde esta carpeta, inicia los servicios:

   ```powershell
   docker compose up --build -d
   ```

3. Abre [http://localhost:3000](http://localhost:3000). En una base sin usuarios aparecerá el formulario para crear al primer administrador. La contraseña inicial debe tener al menos 12 caracteres; no se instala ninguna cuenta ni contraseña predeterminada.

El backend y PostgreSQL están disponibles en `http://localhost:4000` y `localhost:5432`. La migración `backend/migrations/001_identity_inventory.sql` se aplica de forma aditiva al iniciar el backend; no elimina datos ni recrea el volumen.

Los pedidos enviados desde el carrito público se registran como proformas web y se consultan desde **Ventas → Proformas Web**. Al convertir un pedido se selecciona el método de pago; los pagos inmediatos requieren un turno de caja abierto, y el historial de ventas y el inventario se actualizan en una sola transacción.

Los banners promocionales se administran desde **Configuración y administración → Banners / Carrusel**. El carrusel público muestra banners activos por sucursal; desde la misma pantalla se configura la fecha y hora de fin que utiliza el contador de ofertas. La migración `backend/migrations/016_banners_carrusel.sql` se aplica al iniciar el backend.

## Acceso y permisos

- Las sesiones se guardan en PostgreSQL y usan cookies `HttpOnly`.
- `administrador` administra usuarios, permisos y sucursales.
- `cajero` puede operar ventas y caja según sus permisos.
- `almacenero` gestiona productos, compras e inventario según sus permisos.
- Las asignaciones de sucursales se validan en el backend. El selector de sucursal no concede acceso por sí mismo.
- Las contraseñas se guardan con hash bcrypt. Se puede cambiar la contraseña desde Perfil de usuario.

## Módulos

Resumen, punto de venta, historial de ventas, compras, caja y turnos, catálogo de productos con URL de imagen, marcas, presentaciones, proveedores, Kardex, inventario físico, sucursales, usuarios, roles y perfil.

La URL de API del frontend se configura con `VITE_API_URL` (en Docker local apunta a `http://localhost:4000`). El modo actual de Docker sirve Vite para desarrollo local; para producción pública se debe servir el frontend mediante un servidor estático/reverse proxy con HTTPS y configurar `NODE_ENV=production`, `POS_SESSION_SECRET` y `FRONTEND_ORIGIN`   .
