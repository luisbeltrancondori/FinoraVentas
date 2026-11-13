import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../contexts/CartContext.jsx';
import { assetUrl } from '../api.js';

const currency = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
});
const SHOP_WHATSAPP = '59162108877';

export default function CartDrawer({ open, onClose }) {
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();
  if (!open) return null;

  const orderMessage = [
    'Hola Tienda Forty, quiero hacer el siguiente pedido:',
    '',
    ...items.map((item) => `• ${item.nombre} x ${item.cantidad} — ${currency.format(item.precio * item.cantidad)}`),
    '',
    `Total del pedido: ${currency.format(total)}`,
    '',
    'Por favor, confírmenme la disponibilidad y el método de pago.',
  ].join('\n');
  const checkoutUrl = `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(orderMessage)}`;

  function handleCheckout() {
    window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    clearCart();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="cart-title" className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShoppingBag size={19} /></span>
            <div><h2 id="cart-title" className="font-bold text-slate-900">Tu carrito</h2><p className="text-xs text-slate-500">{items.length} {items.length === 1 ? 'producto' : 'productos'}</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar carrito" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>

        {items.length
          ? <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {items.map((item) => (
              <article key={item.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50">
                  {item.imagen_url ? <img src={assetUrl(item.imagen_url)} alt="" className="h-full w-full object-contain" /> : <ShoppingBag size={22} className="text-slate-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">{item.nombre}</h3>
                  <p className="mt-1 text-xs font-bold text-emerald-700">{currency.format(item.precio)}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button type="button" onClick={() => updateQuantity(item.id, item.cantidad - 1)} aria-label={`Reducir cantidad de ${item.nombre}`} className="grid h-8 w-8 place-items-center text-slate-500 hover:text-emerald-700"><Minus size={13} /></button>
                      <span className="min-w-8 text-center text-xs font-semibold text-slate-700">{item.cantidad}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.cantidad + 1)} disabled={item.cantidad >= item.stock_actual} aria-label={`Aumentar cantidad de ${item.nombre}`} className="grid h-8 w-8 place-items-center text-slate-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-30"><Plus size={13} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{currency.format(item.precio * item.cantidad)}</span>
                      <button type="button" onClick={() => removeItem(item.id)} aria-label={`Quitar ${item.nombre}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  {item.cantidad >= item.stock_actual && <p className="mt-1 text-[10px] text-slate-400">Máximo disponible: {item.stock_actual}</p>}
                </div>
              </article>
            ))}
          </div>
          : <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-50 text-slate-300"><ShoppingBag size={28} /></span>
            <p className="mt-4 font-semibold text-slate-800">Tu carrito está vacío</p>
            <p className="mt-1 text-sm text-slate-500">Agrega productos del catálogo para preparar tu pedido.</p>
            <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">Seguir explorando</button>
          </div>}

        {items.length > 0 && <footer className="space-y-4 border-t border-slate-100 bg-white p-5">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">Total del pedido</span><strong className="text-xl text-slate-900">{currency.format(total)}</strong></div>
          <button type="button" onClick={handleCheckout} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700">
            <ShoppingBag size={17} /> Realizar Pedido por WhatsApp
          </button>
          <p className="text-center text-[10px] leading-4 text-slate-400">El pedido se confirmará con la tienda por WhatsApp. No se realizará ningún cobro desde esta página.</p>
        </footer>}
      </aside>
    </div>
  );
}
