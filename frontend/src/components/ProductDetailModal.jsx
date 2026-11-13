import { useEffect } from 'react';
import { MessageCircle, PackageOpen, Plus, X } from 'lucide-react';
import { getProductPrice, useCart } from '../contexts/CartContext.jsx';
import { assetUrl } from '../api.js';

const currency = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
});
const SHOP_WHATSAPP = '59162108877';

export default function ProductDetailModal({ product, onClose, onAddToCart }) {
  const { addItem } = useCart();
  const price = getProductPrice(product);
  const regularPrice = Number(product.precio_venta) || 0;
  const isOffer = price < regularPrice;
  const directMessage = encodeURIComponent(`Hola Tienda Forty, quisiera consultar disponibilidad de ${product.nombre}.`);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  function addToCart() {
    if (addItem(product)) onAddToCart();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-detail-title" className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Detalle del producto</p>
          <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-2 md:gap-10">
          <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-2xl bg-slate-50 p-8 sm:min-h-80">
            {isOffer && <span className="absolute left-4 top-4 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Oferta</span>}
            {product.imagen_url
              ? <img src={assetUrl(product.imagen_url)} alt={product.nombre} className="max-h-80 w-full object-contain" />
              : <PackageOpen size={72} strokeWidth={1.2} className="text-slate-300" />}
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{product.categoria_nombre || 'Tienda Forty'}{product.presentacion_nombre ? ` · ${product.presentacion_nombre}` : ''}</p>
            <h1 id="product-detail-title" className="mt-2 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">{product.nombre}</h1>
            {product.marca_nombre && <p className="mt-2 text-sm text-slate-500">Marca: <span className="font-semibold text-slate-700">{product.marca_nombre}</span></p>}
            <div className="mt-5">
              {isOffer && <p className="text-sm text-slate-400 line-through">{currency.format(regularPrice)}</p>}
              <p className={`font-extrabold ${isOffer ? 'text-3xl text-emerald-700' : 'text-2xl text-slate-900'}`}>{currency.format(price)}</p>
            </div>
            <p className="mt-4 text-sm text-slate-600">Disponibilidad: <strong className="text-emerald-700">{product.stock_actual} {product.presentacion_nombre || 'unidades'}</strong></p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={addToCart} disabled={Number(product.stock_actual) <= 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17} /> Agregar al carrito</button>
              <a href={`https://wa.me/${SHOP_WHATSAPP}?text=${directMessage}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"><MessageCircle size={17} /> Pedir por WhatsApp</a>
            </div>
          </div>
        </div>
        <section className="border-t border-slate-100 bg-slate-50/70 px-5 py-6 sm:px-7">
          <h2 className="text-lg font-bold text-slate-900">Detalles del producto</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Descripción</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{product.descripcion_larga || 'No hay una descripción adicional para este producto.'}</p></div>
            <div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Especificaciones</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{product.especificaciones || 'No se han indicado especificaciones.'}</p></div>
          </div>
        </section>
      </section>
    </div>
  );
}
