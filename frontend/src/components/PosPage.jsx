import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CreditCard,
  Minus,
  Package,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { api, assetUrl } from '../api.js';
import TicketImpresion from './TicketImpresion.jsx';

const paymentMethods = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'qr', label: 'QR / Transferencia', icon: QrCode },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'mixto', label: 'Pago mixto', icon: ReceiptText },
  { id: 'credito', label: 'Crédito', icon: CreditCard },
];
const currency = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' });
const money = (value) => currency.format(Number(value) || 0);

function CustomerSelector({
  surface, clientQuery, clients, selectedClient, clientOptionsOpen, clientLoading,
  paymentMethod, onQueryChange, onFocus, onSelect, onClear, onRegister,
}) {
  const searchId = `customer-search-${surface}`;

  return (
    <div className="text-xs font-semibold text-muted">
      <label htmlFor={searchId} className="mb-1 flex items-center gap-1">
        <UserRound size={14} /> Cliente {paymentMethod === 'credito' && <span className="text-rose-600">*</span>}
      </label>
      <input
        id={searchId}
        value={clientQuery}
        onFocus={onFocus}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Buscar por nombre, teléfono o CI…"
        className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand"
      />
      {selectedClient
        ? <div className="mt-1 flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium text-emerald-700">
            Seleccionado: {selectedClient.nombre_completo || selectedClient.nombre}
            {selectedClient.telefono ? ` · ${selectedClient.telefono}` : ''}
          </p>
          <button type="button" onClick={onClear} className="shrink-0 text-[11px] font-semibold text-slate-500 hover:text-rose-600">Quitar</button>
        </div>
        : <p className="mt-1 text-[11px] font-normal text-slate-500">
          Sin selección: se registrará como Cliente General.
        </p>}
      {clientOptionsOpen && clientQuery.trim() && !selectedClient && <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
        {clientLoading ? <p className="px-3 py-2 text-xs text-muted">Buscando clientes…</p> : clients.map((client) => (
          <button key={client.id} type="button" onClick={() => onSelect(client)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-emerald-50">
            <span className="block text-xs font-bold text-ink">{client.nombre_completo || client.nombre}</span>
            <span className="block text-[10px] text-muted">{client.telefono || client.nit_ci || 'Sin contacto'}</span>
          </button>
        ))}
        {!clientLoading && clients.length === 0 && <p className="px-3 py-2 text-xs text-muted">No hay clientes que coincidan.</p>}
        <button type="button" onClick={onRegister} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-slate-100 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">+ Registrar cliente nuevo</button>
      </div>}
      {clientOptionsOpen && !clientQuery.trim() && <button type="button" onClick={onRegister} className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-800">+ Registrar cliente</button>}
    </div>
  );
}

export default function PosPage({ products, negocioId, turn, business, cashier, onRefresh, notify }) {
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState(products);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedQr, setMixedQr] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientOptionsOpen, setClientOptionsOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ nombre: '', telefono: '', nit_ci: '' });
  const [clientLoading, setClientLoading] = useState(false);
  const [transactionTime, setTransactionTime] = useState(() => new Date());
  const [ticket, setTicket] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);

  const activeProducts = useMemo(
    () => catalogProducts.filter((product) => product.activo !== false),
    [catalogProducts],
  );
  const filteredProducts = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    if (!text) return activeProducts;
    return activeProducts.filter((product) => (
      `${product.nombre || ''} ${product.codigo_barras || ''}`.toLocaleLowerCase().includes(text)
    ));
  }, [activeProducts, query]);
  useEffect(() => {
    setCatalogProducts(products);
  }, [products]);

  useEffect(() => {
    setCart([]);
    setSelectedClient(null);
    setClientQuery('');
    setBrandFilter('');
    setCategoryFilter('');
    setQuery('');
  }, [negocioId]);

  useEffect(() => {
    let active = true;
    Promise.all([api('/api/marcas', { negocioId }), api('/api/categorias', { negocioId })])
      .then(([brandRows, categoryRows]) => {
        if (active) {
          setBrands(brandRows);
          setCategories(categoryRows);
        }
      })
      .catch((error) => { if (active) notify(error.message, 'error'); });
    return () => { active = false; };
  }, [negocioId, notify]);

  useEffect(() => {
    const timer = window.setInterval(() => setTransactionTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!query.trim() && !brandFilter && !categoryFilter) {
        setCatalogProducts(products);
        setCatalogLoading(false);
        return;
      }
      setCatalogLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('search', query.trim());
        if (brandFilter) params.set('marca', brandFilter);
        if (categoryFilter) params.set('categoria', categoryFilter);
        setCatalogProducts(await api(`/api/productos?${params}`, { negocioId }));
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        setCatalogLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [brandFilter, categoryFilter, negocioId, notify, products, query]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const search = clientQuery.trim();
      if (!search) {
        setClients([]);
        setClientLoading(false);
        return;
      }
      setClientLoading(true);
      try {
        const result = await api(`/api/clientes?search=${encodeURIComponent(search)}&limit=20`, { negocioId });
        if (active) setClients(result);
      } catch (error) {
        if (active) notify(error.message, 'error');
      } finally {
        if (active) setClientLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [clientQuery, negocioId, notify]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.round(subtotal * 100) / 100;
  const received = Number(cashReceived) || 0;
  const change = paymentMethod === 'efectivo' ? Math.max(0, received - total) : 0;

  function addProduct(product) {
    if (Number(product.stock_actual) <= 0) return notify('Este producto no tiene existencias.');
    setCart((current) => {
      const currentItem = current.find((item) => item.id === product.id);
      if (currentItem) {
        if (currentItem.quantity >= Number(product.stock_actual)) {
          notify('No hay más unidades disponibles en inventario.');
          return current;
        }
        return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, {
        id: product.id,
        name: product.nombre,
        price: Number(product.precio_venta),
        quantity: 1,
        stock: Number(product.stock_actual),
        code: product.codigo_barras,
      }];
    });
  }

  function updateQuantity(productId, delta) {
    setCart((current) => current
      .map((item) => {
        if (item.id !== productId) return item;
        return { ...item, quantity: Math.min(item.stock, item.quantity + delta) };
      })
      .filter((item) => item.quantity > 0));
  }

  async function addScannedProduct() {
    const code = query.trim();
    if (!code) return;
    try {
      const result = await api(`/api/productos?codigo_barras=${encodeURIComponent(code)}`, { negocioId });
      if (!result.length) {
        notify('No encontramos un producto con ese código de barras.', 'error');
        return;
      }
      addProduct(result[0]);
      setQuery('');
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function createCustomer(event) {
    event.preventDefault();
    if (paymentMethod === 'credito' && !newClient.telefono.trim() && !newClient.nit_ci.trim()) {
      notify('Para una venta a crédito registra teléfono o NIT/CI del cliente.', 'error');
      return;
    }
    setClientLoading(true);
    try {
      const customer = await api('/api/clientes', {
        method: 'POST',
        negocioId,
        body: JSON.stringify(newClient),
      });
      setSelectedClient(customer);
      setClientQuery(customer.nombre_completo || customer.nombre);
      setClients([]);
      setClientOptionsOpen(false);
      setNewClientOpen(false);
      setNewClient({ nombre: '', telefono: '', nit_ci: '' });
      notify('Cliente registrado y seleccionado.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setClientLoading(false);
    }
  }

  async function submitSale() {
    if (!turn && paymentMethod !== 'credito') {
      return notify('Abre un turno de caja antes de registrar un pago inmediato.');
    }
    if (!cart.length) return;
    if (paymentMethod === 'efectivo' && received < total) {
      return notify('El efectivo recibido debe cubrir el total de la venta.');
    }
    if (paymentMethod === 'mixto') {
      const cashAmount = Number(mixedCash) || 0;
      const qrAmount = Number(mixedQr) || 0;
      if (cashAmount <= 0 || qrAmount <= 0) {
        return notify('Ingresa un monto mayor a cero para efectivo y para QR.');
      }
      if (Math.round((cashAmount + qrAmount) * 100) / 100 !== total) {
        return notify('La suma de efectivo y QR debe coincidir exactamente con el total.');
      }
    }
    if (paymentMethod === 'credito' && !selectedClient) {
      return notify('Selecciona un cliente registrado para vender a crédito.');
    }

    setSubmitting(true);
    try {
      const receipt = await api('/api/ventas', {
        method: 'POST',
        negocioId,
        body: JSON.stringify({
          turno_id: turn?.id,
          metodo_pago: paymentMethod,
          monto_efectivo: paymentMethod === 'efectivo'
            ? received
            : paymentMethod === 'mixto' ? Number(mixedCash) : 0,
          monto_qr: paymentMethod === 'mixto' ? Number(mixedQr) : undefined,
          cliente_id: selectedClient?.id || undefined,
          cliente_nombre: selectedClient?.nombre_completo || selectedClient?.nombre || 'Cliente General',
          cliente_contacto: selectedClient?.telefono || selectedClient?.nit_ci || undefined,
          items: cart.map((item) => ({ producto_id: item.id, cantidad: item.quantity })),
        }),
      });
      setTicket({
        ...receipt,
        venta: {
          ...receipt.venta,
          cajero_nombre: cashier,
          negocio_nombre: business?.nombre,
          negocio_nit: business?.nit,
          negocio_direccion: business?.direccion,
          negocio_telefono: business?.telefono,
          monto_recibido: paymentMethod === 'efectivo' ? received : paymentMethod === 'mixto' ? Number(mixedCash) : 0,
        },
      });
      setCart([]);
      setCashReceived('');
      setMixedCash('');
      setMixedQr('');
      setSelectedClient(null);
      setClientQuery('');
      setChargeOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      notify(paymentMethod === 'credito'
        ? `Venta #${receipt.venta.numero_ticket} registrada a crédito.`
        : `Venta #${receipt.venta.numero_ticket} registrada. Cambio: ${money(receipt.cambio)}.`);
      await onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`space-y-5 ${cart.length ? 'pb-28 2xl:pb-0' : ''}`}>
      <div>
        <p className="text-sm font-bold text-brand">Punto de venta</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Nueva venta</h1>
      </div>
      {!turn && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No hay un turno abierto. Los pagos inmediatos requieren apertura de caja; puedes registrar ventas a crédito con los datos del cliente.
        </div>
      )}
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-extrabold text-ink">Catálogo</h2>
              <p className="mt-1 text-sm text-muted">{activeProducts.length} productos activos</p>
            </div>
            <label className="relative block w-full sm:max-w-sm">
              <span className="sr-only">Buscar producto</span>
              <Search aria-hidden="true" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (filteredProducts.length === 1 && filteredProducts[0].codigo_barras === query.trim()) {
                      addProduct(filteredProducts[0]);
                      setQuery('');
                    } else addScannedProduct();
                  }
                }}
                placeholder="Buscar o escanear código y presionar Enter…"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
            </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted">Marca
                <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand">
                  <option value="">Todas las marcas</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">Categoría
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand">
                  <option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
                </select>
              </label>
            </div>
          </div>
          {catalogLoading ? <p className="py-10 text-center text-sm text-muted">Buscando productos…</p> : activeProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-14 text-center">
              <Package aria-hidden="true" size={26} className="mx-auto text-slate-300" />
              <p className="mt-3 font-bold text-ink">Aún no hay productos</p>
              <p className="mt-1 text-sm text-muted">Registra productos desde Gestión de inventario.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">No encontramos productos con esa búsqueda.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const outOfStock = Number(product.stock_actual) <= 0;
                return (
                  <button
                    type="button"
                    key={product.id}
                    disabled={outOfStock}
                    onClick={() => addProduct(product)}
                    className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 sm:h-16 sm:w-16">{product.imagen_url ? <img src={assetUrl(product.imagen_url)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition group-hover:scale-105" /> : <Package size={22} />}</span>
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-muted">{outOfStock ? 'Agotado' : `${product.stock_actual} disp.`}</span>
                    </div>
                    <span className="mt-3 line-clamp-2 text-[13px] font-bold leading-snug text-ink">{product.nombre}</span>
                    <span className="mt-1 truncate text-[10px] text-muted">{product.codigo_barras || 'Sin código'}</span>
                    <span className="mt-auto pt-3 text-base font-extrabold tracking-tight text-brand">{money(product.precio_venta)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm 2xl:sticky 2xl:top-5">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-extrabold text-ink">Ticket de venta</h2>
              <p className="mt-1 text-sm text-muted">{cart.reduce((sum, item) => sum + item.quantity, 0)} artículos</p>
              <p className="mt-1 text-xs text-muted">Fecha: {transactionTime.toLocaleString('es-BO')}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand"><ReceiptText size={18} /></span>
          </div>
          <div className="border-b border-slate-100 p-4">
            <CustomerSelector
              surface="desktop"
              clientQuery={clientQuery}
              clients={clients}
              selectedClient={selectedClient}
              clientOptionsOpen={clientOptionsOpen}
              clientLoading={clientLoading}
              paymentMethod={paymentMethod}
              onFocus={() => setClientOptionsOpen(true)}
              onQueryChange={(value) => {
                setClientQuery(value);
                setSelectedClient(null);
                setClientOptionsOpen(true);
              }}
              onSelect={(client) => {
                setSelectedClient(client);
                setClientQuery(client.nombre_completo || client.nombre);
                setClientOptionsOpen(false);
              }}
              onClear={() => {
                setSelectedClient(null);
                setClientQuery('');
                setClientOptionsOpen(false);
              }}
              onRegister={() => {
                setNewClient((current) => ({ ...current, nombre: clientQuery.trim() }));
                setClientOptionsOpen(false);
                setNewClientOpen(true);
              }}
            />
          </div>
          <div className="max-h-[min(38vh,360px)] min-h-28 overflow-y-auto p-4">
            {!cart.length ? (
              <p className="py-10 text-center text-sm text-muted">Agrega productos desde el catálogo.</p>
            ) : (
              <ul className="space-y-4">
                {cart.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-slate-500"><Package size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <p className="truncate text-sm font-bold">{item.name}</p>
                        <p className="shrink-0 text-sm font-bold">{money(item.price * item.quantity)}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{money(item.price)} c/u</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label={`Restar ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border text-slate-600"><Minus size={14} /></button>
                        <span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label={`Sumar ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border text-slate-600 disabled:opacity-40" disabled={item.quantity >= item.stock}><Plus size={14} /></button>
                        <button type="button" aria-label={`Quitar ${item.name}`} onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))} className="ml-auto flex items-center gap-1 text-xs font-semibold text-rose-600"><Trash2 size={13} /> Quitar</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/70 p-5">
            <div className="flex justify-between text-sm text-muted"><span>Subtotal</span><span className="font-bold text-ink">{money(subtotal)}</span></div>
            <div className="mt-2 flex justify-between border-t border-dashed border-slate-300 pt-3 text-base font-extrabold"><span>Total</span><span>{money(total)}</span></div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted">Método de pago</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {paymentMethods.map((method) => (
                  <button key={method.id} type="button" aria-pressed={paymentMethod === method.id} onClick={() => setPaymentMethod(method.id)}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-bold ${paymentMethod === method.id ? 'border-brand bg-brand-light text-brand-dark' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <method.icon aria-hidden="true" size={16} />{method.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {paymentMethod === 'efectivo' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-muted">Recibido
                  <input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand" />
                </label>
                <div className="text-xs font-semibold text-muted">Cambio
                  <p className="mt-1 flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-extrabold text-brand">{money(change)}</p>
                </div>
              </div>
            )}
            {paymentMethod === 'mixto' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-muted">Monto en efectivo
                  <input type="number" min="0.01" step="0.01" value={mixedCash} onChange={(event) => setMixedCash(event.target.value)} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand" />
                </label>
                <label className="text-xs font-semibold text-muted">Monto por QR
                  <input type="number" min="0.01" step="0.01" value={mixedQr} onChange={(event) => setMixedQr(event.target.value)} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand" />
                </label>
                <p className="col-span-2 text-xs text-muted">Pagado: {money((Number(mixedCash) || 0) + (Number(mixedQr) || 0))} · Total: {money(total)}</p>
              </div>
            )}
            {paymentMethod === 'credito' && (
              <div className="mt-4 space-y-3">
                {!selectedClient && <p className="text-xs font-semibold text-rose-600">Selecciona un cliente registrado arriba para habilitar el crédito.</p>}
                <p className="text-xs text-amber-700">Saldo pendiente: <strong>{money(total)}</strong></p>
              </div>
            )}
            <button type="button" disabled={!cart.length || submitting || (paymentMethod === 'credito' && !selectedClient)} onClick={submitSale} className="mt-5 hidden min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-extrabold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300 2xl:flex">
              {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {!submitting && <ShoppingCart size={16} />}
              {submitting ? 'Procesando…' : paymentMethod === 'credito' ? `Registrar a crédito · ${money(total)}` : `Cobrar venta · ${money(total)}`}
            </button>
          </div>
        </aside>
      </div>
      {cart.length > 0 && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur 2xl:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-500">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} artículos en el carrito
            </p>
            <p className="truncate text-lg font-extrabold text-ink">{money(total)}</p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setCashReceived(String(total));
              setChargeOpen(true);
            }}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShoppingCart size={17} /> Cobrar
          </button>
        </div>
      </div>}
      {chargeOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setChargeOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="mobile-charge-title" className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand">Punto de venta</p>
              <h2 id="mobile-charge-title" className="mt-1 text-lg font-extrabold text-ink">Confirmar cobro</h2>
            </div>
            <button type="button" disabled={submitting} onClick={() => setChargeOpen(false)} aria-label="Cerrar cobro" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
          </header>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold text-slate-500">{cart.reduce((sum, item) => sum + item.quantity, 0)} artículos</span>
            <strong className="text-lg text-ink">{money(total)}</strong>
          </div>
          {!turn && paymentMethod !== 'credito' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Abre un turno de caja para registrar pagos inmediatos.</p>}
          <fieldset className="mt-5">
            <legend className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted">Método de pago</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {paymentMethods.map((method) => (
                <button key={method.id} type="button" aria-pressed={paymentMethod === method.id} onClick={() => setPaymentMethod(method.id)}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-bold ${paymentMethod === method.id ? 'border-brand bg-brand-light text-brand-dark' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <method.icon aria-hidden="true" size={16} />{method.label}
                </button>
              ))}
            </div>
          </fieldset>
          {paymentMethod === 'efectivo' && <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted">Recibido
              <input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand" />
            </label>
            <div className="text-xs font-semibold text-muted">Cambio
              <p className="mt-1 flex min-h-10 items-center rounded-xl bg-slate-50 px-3 text-sm font-extrabold text-brand">{money(change)}</p>
            </div>
          </div>}
          {paymentMethod === 'mixto' && <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted">Monto en efectivo
              <input type="number" min="0.01" step="0.01" value={mixedCash} onChange={(event) => setMixedCash(event.target.value)} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand" />
            </label>
            <label className="text-xs font-semibold text-muted">Monto por QR
              <input type="number" min="0.01" step="0.01" value={mixedQr} onChange={(event) => setMixedQr(event.target.value)} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand" />
            </label>
            <p className="col-span-2 text-xs text-muted">Pagado: {money((Number(mixedCash) || 0) + (Number(mixedQr) || 0))} · Total: {money(total)}</p>
          </div>}
          <div className="mt-4">
            <CustomerSelector
              surface="mobile"
              clientQuery={clientQuery}
              clients={clients}
              selectedClient={selectedClient}
              clientOptionsOpen={clientOptionsOpen}
              clientLoading={clientLoading}
              paymentMethod={paymentMethod}
              onFocus={() => setClientOptionsOpen(true)}
              onQueryChange={(value) => {
                setClientQuery(value);
                setSelectedClient(null);
                setClientOptionsOpen(true);
              }}
              onSelect={(client) => {
                setSelectedClient(client);
                setClientQuery(client.nombre_completo || client.nombre);
                setClientOptionsOpen(false);
              }}
              onClear={() => {
                setSelectedClient(null);
                setClientQuery('');
                setClientOptionsOpen(false);
              }}
              onRegister={() => {
                setNewClient((current) => ({ ...current, nombre: clientQuery.trim() }));
                setClientOptionsOpen(false);
                setNewClientOpen(true);
              }}
            />
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" disabled={submitting} onClick={() => setChargeOpen(false)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Volver</button>
            <button type="button" disabled={!cart.length || submitting || (paymentMethod === 'credito' && !selectedClient)} onClick={submitSale} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300">
              {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {!submitting && <ShoppingCart size={16} />}
              {submitting ? 'Procesando…' : paymentMethod === 'credito' ? `Registrar a crédito · ${money(total)}` : `Cobrar venta · ${money(total)}`}
            </button>
          </div>
        </section>
      </div>}
      {ticket && <TicketImpresion detail={ticket} business={business} onClose={() => setTicket(null)} />}
      {newClientOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4">
        <form onSubmit={createCustomer} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
          <div><h2 className="text-base font-extrabold text-ink">Registrar cliente</h2><p className="mt-1 text-xs text-muted">Se guardará en la sucursal actual.</p></div>
          <label className="block text-xs font-semibold text-muted">Nombre completo<input required maxLength="150" value={newClient.nombre} onChange={(event) => setNewClient({ ...newClient, nombre: event.target.value })} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-ink" /></label>
          <label className="block text-xs font-semibold text-muted">Teléfono<input maxLength="50" value={newClient.telefono} onChange={(event) => setNewClient({ ...newClient, telefono: event.target.value })} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-ink" /></label>
          <label className="block text-xs font-semibold text-muted">NIT / CI<input maxLength="50" value={newClient.nit_ci} onChange={(event) => setNewClient({ ...newClient, nit_ci: event.target.value })} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-ink" /></label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setNewClientOpen(false)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600">Cancelar</button>
            <button type="submit" disabled={clientLoading} className="min-h-10 rounded-xl bg-brand px-4 text-xs font-bold text-white disabled:opacity-60">{clientLoading ? 'Guardando…' : 'Guardar cliente'}</button>
          </div>
        </form>
      </div>}
    </div>
  );
}
