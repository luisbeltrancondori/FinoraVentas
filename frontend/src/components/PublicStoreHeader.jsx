import { Link, NavLink } from 'react-router-dom';
import { ShoppingCart, UserRound } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/Logo de Tienda Forty Hogar.png';
import { useCart } from '../contexts/CartContext.jsx';
import CartDrawer from './CartDrawer.jsx';

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/nosotros', label: 'Sobre Nosotros' },
  { to: '/contacto', label: 'Contáctanos' },
];

export default function PublicStoreHeader({ onCartClick }) {
  const { itemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  function openCart() {
    if (onCartClick) onCartClick();
    else setCartOpen(true);
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
          <Link to="/" aria-label="Tienda Forty, inicio" className="flex shrink-0 items-center">
            <img src={logo} alt="Tienda Forty Hogar" className="h-10 w-auto object-contain" />
          </Link>

          <nav aria-label="Navegación de la tienda" className="order-3 flex w-full items-center justify-center gap-1 border-t border-slate-100 pt-2 lg:order-2 lg:w-auto lg:border-0 lg:pt-0">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3">
            <button type="button" onClick={openCart} aria-label={`Abrir carrito, ${itemCount} productos`} className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
              <ShoppingCart size={18} />
              {itemCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">{itemCount > 99 ? '99+' : itemCount}</span>}
            </button>
            <Link to="/login" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 sm:px-4">
              <UserRound size={16} /><span className="hidden sm:inline">Iniciar Sesión</span><span className="sm:hidden">Acceso</span>
            </Link>
          </div>
        </div>
      </header>
      {!onCartClick && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
    </>
  );
}
