import { useEffect, useMemo, useState } from 'react';
import {
  LoaderCircle, MapPin, MessageCircle, PackageOpen,
  Plus, Search, ShoppingCart, UserRound, X,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { api, assetUrl } from '../api.js';
import { useCart } from '../contexts/CartContext.jsx';
import CartDrawer from './CartDrawer.jsx';
import HeroCarousel from './HeroCarousel.jsx';
import OfferCountdown from './OfferCountdown.jsx';
import ProductDetailModal from './ProductDetailModal.jsx';
import logo from '../assets/Logo de Tienda Forty Hogar.png';

const SHOP_WHATSAPP = '59162108877';
const currency = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
});

function ProductCard({ product, onViewDetails }) {
  const { addItem } = useCart();
  const regularPrice = Number(product.precio_venta) || 0;
  const offerPrice = Number(product.precio_oferta);
  const hasOfferPrice = product.precio_oferta !== null
    && product.precio_oferta !== undefined
    && product.precio_oferta !== '';
  const onOffer = product.en_oferta === true
    && hasOfferPrice
    && Number.isFinite(offerPrice)
    && offerPrice >= 0
    && offerPrice < regularPrice;
  const discount = onOffer ? Math.round((1 - offerPrice / regularPrice) * 100) : 0;
  const image = product.imagen_url ? assetUrl(product.imagen_url) : '';
  const message = encodeURIComponent(`Hola, quisiera consultar disponibilidad de ${product.nombre}.`);
  const inStock = Number(product.stock_actual) > 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-950/5">
      <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-slate-50">
        {onOffer && <span className="absolute left-3 top-3 z-10 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-800">-{discount}% OFF</span>}
        <button type="button" onClick={() => onViewDetails(product)} aria-label={`Ver detalles de ${product.nombre}`} className="grid h-full w-full place-items-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500">
          {image
            ? <img src={image} alt="" loading="lazy" className="h-full w-full object-contain" />
            : <PackageOpen size={42} strokeWidth={1.3} className="text-slate-300" />}
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">{product.categoria_nombre || 'Tienda Forty'}</span>
          {product.presentacion_nombre && <span className="truncate text-[10px] text-slate-400">{product.presentacion_nombre}</span>}
        </div>
        <button type="button" onClick={() => onViewDetails(product)} className="min-h-10 text-left text-sm font-bold leading-5 text-slate-800 hover:text-emerald-700">{product.nombre}</button>
        <div className="mt-3 min-h-[48px]">
          {onOffer && <p className="text-xs text-slate-400 line-through">{currency.format(regularPrice)}</p>}
          <p className={`font-bold ${onOffer ? 'text-xl text-emerald-700' : 'text-lg text-slate-800'}`}>{currency.format(onOffer ? offerPrice : regularPrice)}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => addItem(product)}
            disabled={!inStock}
            aria-label={`Agregar ${product.nombre} al carrito`}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 text-[10px] font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-xs"
          >
            <Plus size={15} /> Agregar
          </button>
          <a
            href={`https://wa.me/${SHOP_WHATSAPP}?text=${message}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 sm:gap-2 sm:px-3 sm:text-xs"
          >
            <MessageCircle size={15} /> Consultar
          </a>
        </div>
      </div>
    </article>
  );
}

function ProductSection({ title, description, products, emptyText, featured = false, onViewDetails }) {
  if (!products.length && !featured) return null;
  return (
    <section className="scroll-mt-32">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
          <span className="mt-2 block h-1 w-12 rounded-full bg-emerald-500" />
          <p className="mt-2 text-xs text-slate-500">{description}</p>
        </div>
        {products.length > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500">{products.length} productos</span>}
      </div>
      {products.length
        ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} onViewDetails={onViewDetails} />)}</div>
        : <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">{emptyText}</div>}
    </section>
  );
}

export default function Storefront({ onEmployeeLogin }) {
  const { itemCount } = useCart();
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [offersDeadline, setOffersDeadline] = useState(null);
  const [business, setBusiness] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api('/api/public/catalogo')
      .then((result) => {
        if (!Array.isArray(result.productos)) throw new Error('El catálogo recibido tiene un formato no válido.');
        if (active) {
          setProducts(result.productos);
          setBusiness(result.negocio || null);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api('/api/banners'),
      api('/api/public/ofertas-vencimiento'),
    ])
      .then(([bannerRows, offersConfig]) => {
        if (!Array.isArray(bannerRows)) throw new Error('La lista de banners recibida no es válida.');
        if (active) {
          setBanners(bannerRows);
          setOffersDeadline(offersConfig.ofertas_hasta || null);
        }
      })
      .catch((requestError) => {
        console.error('No se pudieron cargar las promociones de la tienda:', requestError);
        if (active) {
          setBanners([]);
          setOffersDeadline(null);
        }
      })
      .finally(() => {
        if (active) setBannersLoading(false);
      });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => [...new Set(
    products.map((product) => product.categoria_nombre).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'es')), [products]);

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesSearch = !search
        || `${product.nombre} ${product.codigo_barras || ''} ${product.categoria_nombre || ''}`.toLocaleLowerCase().includes(search);
      const matchesCategory = !category || product.categoria_nombre === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, products, query]);

  const offers = filteredProducts.filter((product) => (
    product.en_oferta === true
    && product.precio_oferta !== null
    && product.precio_oferta !== undefined
    && product.precio_oferta !== ''
    && Number(product.precio_oferta) < Number(product.precio_venta)
  ));
  const regularProducts = filteredProducts.filter((product) => !offers.includes(product));
  const whatsappLink = `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent('Hola, quisiera información sobre Tienda Forty.')}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Tienda Forty, inicio" className="flex shrink-0 items-center">
            <img src={logo} alt="Tienda Forty Hogar" className="h-10 w-auto object-contain" />
          </Link>
          <nav aria-label="Navegación de la tienda" className="order-3 flex w-full items-center justify-center gap-1 border-t border-slate-100 pt-2 lg:order-2 lg:w-auto lg:border-0 lg:pt-0">
            <NavLink to="/" end className={({ isActive }) => `rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>Inicio</NavLink>
            <NavLink to="/nosotros" className={({ isActive }) => `rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>Sobre Nosotros</NavLink>
            <NavLink to="/contacto" className={({ isActive }) => `rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>Contáctanos</NavLink>
          </nav>
          <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3">
            <label className="relative hidden w-44 sm:block lg:w-56">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar productos..."
              aria-label="Buscar productos"
              className="h-10 w-full rounded-xl border border-transparent bg-slate-100 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={15} /></button>}
            </label>
            <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Abrir carrito, ${itemCount} productos`}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <ShoppingCart size={18} />
            {itemCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">{itemCount > 99 ? '99+' : itemCount}</span>}
            </button>
            <button type="button" onClick={onEmployeeLogin} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 sm:px-4">
              <UserRound size={16} /><span className="hidden sm:inline">Iniciar Sesión</span><span className="sm:hidden">Acceso</span>
            </button>
          </div>
        </div>

        <nav aria-label="Categorías de productos" className="border-t border-slate-100">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
            <button type="button" onClick={() => setCategory('')} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${!category ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>Todas</button>
            {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(category === item ? '' : item)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${category === item ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>{item}</button>)}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <HeroCarousel banners={banners} businessName={business?.nombre} loading={bannersLoading} />

        <div className="mt-10 space-y-11">
          {loading && <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-emerald-600" /> Cargando catálogo…</div>}
          {error && !loading && <div role="alert" className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center"><p className="font-semibold text-slate-800">No pudimos cargar el catálogo</p><p className="mt-2 text-sm text-slate-500">{error}</p></div>}
          {!loading && !error && <>
            <div id="ofertas">
              <OfferCountdown deadline={offersDeadline} />
              <ProductSection
                title="Ofertas Destacadas"
                description="Precios especiales seleccionados para ti esta semana."
                products={offers}
                emptyText={query || category ? 'No hay ofertas que coincidan con tu búsqueda.' : 'Pronto encontrarás nuevas ofertas destacadas.'}
                featured
                onViewDetails={setSelectedProduct}
              />
            </div>
            <ProductSection
              title="Catálogo General"
              description="Explora los productos disponibles en Tienda Forty."
              products={regularProducts}
              emptyText={products.length ? 'No hay productos que coincidan con tu búsqueda o categoría.' : 'El catálogo se está preparando. Vuelve pronto.'}
              onViewDetails={setSelectedProduct}
            />
          </>}
        </div>

        <footer className="mt-16 border-t border-slate-200 pt-6">
          <div className="flex flex-col justify-between gap-3 text-xs text-slate-500 sm:flex-row sm:items-center">
            <p className="font-semibold text-slate-600">{business?.nombre || 'Tienda Forty'}</p>
            {business?.direccion && <p className="flex items-center gap-1.5"><MapPin size={13} />{business.direccion}</p>}
            <button type="button" onClick={onEmployeeLogin} className="inline-flex items-center gap-1.5 self-start font-semibold text-emerald-700 hover:text-emerald-800 sm:self-auto"><UserRound size={14} /> Iniciar Sesión</button>
          </div>
        </footer>
      </div>

      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar a Tienda Forty por WhatsApp"
        title="Escríbenos por WhatsApp"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-950/20 transition hover:scale-105 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
      >
        <MessageCircle size={25} />
      </a>
      {selectedProduct && <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={() => { setSelectedProduct(null); setCartOpen(true); }} />}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}
