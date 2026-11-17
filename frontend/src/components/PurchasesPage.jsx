import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Ban,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { api, assetUrl } from '../api.js';
import Spinner from './Spinner.jsx';
import ReportActions from './ReportActions.jsx';

const money = (value) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0);
const dateTime = (value) => new Date(value).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
const displayDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('es-BO') : '—';
const inputClass = 'mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export function PurchaseNote({ detail, business, onClose }) {
  if (!detail?.compra) return null;
  const { compra, detalles = [] } = detail;
  const supplier = detail.proveedor || {
    nombre_empresa: compra.proveedor_nombre,
    nit_ci: compra.proveedor_nit_ci,
    telefono: compra.proveedor_telefono,
  };

  return (
    <div className="purchase-note-root fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <style>{`
        @page { size: letter; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          .purchase-note-root, .purchase-note-root * { visibility: visible !important; }
          .purchase-note-root { position: absolute !important; inset: 0 !important; display: block !important; overflow: visible !important; padding: 0 !important; background: white !important; }
          .purchase-note-actions { display: none !important; }
          .purchase-note-paper { width: 100% !important; max-width: none !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; }
          .purchase-note-paper tr { break-inside: avoid; }
        }
      `}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="purchase-note-title" className="my-auto w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="purchase-note-actions flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 id="purchase-note-title" className="text-sm font-bold text-slate-900">Vista previa de Nota de Compra</h2>
            <p className="text-xs text-slate-500">Compra {compra.numero_factura || `#${compra.id.slice(0, 8)}`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar nota" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={17} /></button>
        </header>
        <div className="purchase-note-actions flex justify-end border-b border-slate-100 px-5 py-3">
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700"><Printer size={15} /> Imprimir Nota · Carta</button>
        </div>
        <div className="max-h-[76vh] overflow-auto bg-slate-100 p-4 sm:p-8">
          <article className="purchase-note-paper mx-auto min-h-[10in] w-full max-w-[8.5in] border border-slate-200 bg-white p-8 text-[13px] text-slate-800 shadow-sm sm:p-10">
            <div className="flex flex-col justify-between gap-5 border-b-2 border-slate-800 pb-5 sm:flex-row">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Abastecimiento</p>
                <h1 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-slate-900">{business?.nombre || 'Finora POS'}</h1>
                {business?.nit && <p className="mt-1 text-xs text-slate-600">NIT: {business.nit}</p>}
                {business?.direccion && <p className="mt-1 text-xs text-slate-600">{business.direccion}</p>}
                {business?.telefono && <p className="mt-1 text-xs text-slate-600">Tel: {business.telefono}</p>}
              </div>
              <div className="text-left sm:text-right">
                <h2 className="text-xl font-bold text-slate-900">NOTA DE COMPRA</h2>
                <p className="mt-2 text-sm font-semibold">N.º {compra.numero_factura || compra.id.slice(0, 8).toUpperCase()}</p>
                <p className="mt-1 text-xs text-slate-500">Fecha: {dateTime(compra.fecha_compra)}</p>
              </div>
            </div>
            <div className="my-6 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Proveedor</p><p className="mt-1 font-bold text-slate-900">{supplier.nombre_empresa || compra.proveedor_nombre || 'Sin proveedor asociado'}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NIT / CI</p><p className="mt-1 font-semibold text-slate-800">{supplier.nit_ci || compra.proveedor_nit_ci || '—'}</p></div>
              {supplier.telefono && <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Teléfono</p><p className="mt-1 text-slate-700">{supplier.telefono}</p></div>}
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registro</p><p className="mt-1 text-slate-700">Ingreso de mercadería</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                <thead><tr className="border-y border-slate-300 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-3">Cant.</th><th className="px-3 py-3">Descripción</th><th className="px-3 py-3 text-right">Costo unit.</th><th className="px-3 py-3 text-right">Subtotal</th><th className="px-3 py-3">Vencimiento</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">{detalles.map((item) => (
                  <tr key={item.id || `${item.producto_id}-${item.nombre}`}>
                    <td className="px-3 py-3">{item.cantidad}</td><td className="px-3 py-3 font-medium">{item.nombre || 'Producto'}</td>
                    <td className="px-3 py-3 text-right">{money(item.precio_costo_unitario)}</td><td className="px-3 py-3 text-right font-semibold">{money(item.subtotal)}</td>
                    <td className="px-3 py-3">{displayDate(item.fecha_vencimiento)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="ml-auto mt-5 max-w-xs space-y-2 border-t border-slate-200 pt-4 text-sm">
              <p className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(compra.subtotal)}</span></p>
              <p className="flex justify-between text-slate-500"><span>Descuento</span><span>{money(compra.descuento)}</span></p>
              <p className="flex justify-between border-t border-slate-300 pt-3 text-base font-extrabold text-slate-900"><span>TOTAL</span><span>{money(compra.total)}</span></p>
            </div>
            {compra.metodo_pago === 'credito' && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              {Number(compra.saldo_pendiente) > 0
                ? <p className="font-bold text-amber-900">Saldo Pendiente a la fecha: {money(compra.saldo_pendiente)}</p>
                : <p className="font-bold text-emerald-800">PAGADO TOTAL</p>}
              {(detail.pagos || []).length > 0 && <div className="mt-3 border-t border-amber-200 pt-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">Abonos</p>
                {detail.pagos.map((payment) => <p key={payment.id} className="flex justify-between gap-3 text-xs text-slate-700"><span>{dateTime(payment.fecha_pago)} · {payment.metodo_pago}</span><span className="font-semibold">{money(payment.monto)}</span></p>)}
              </div>}
              {detail.pagos?.length > 0 && <div className="mt-3 border-t border-amber-200 pt-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">Abonos registrados</p>
                {detail.pagos.map((payment) => <p key={payment.id} className="flex justify-between gap-3 text-xs text-slate-700"><span>{dateTime(payment.fecha_pago)} · {payment.metodo_pago}</span><span className="font-semibold">{money(payment.monto)}</span></p>)}
              </div>}
            </div>}
            {compra.observaciones && <div className="mt-5 rounded-lg border border-slate-200 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observaciones</p><p className="mt-1 whitespace-pre-wrap text-xs">{compra.observaciones}</p></div>}
            <div className="mt-24 grid grid-cols-2 gap-12 text-center text-xs">
              <div className="border-t border-slate-500 pt-2"><p className="font-semibold">Recibí Conforme</p><p className="mt-1 text-[10px] text-slate-500">Nombre, firma y documento</p></div>
              <div className="border-t border-slate-500 pt-2"><p className="font-semibold">Entregué Conforme</p><p className="mt-1 text-[10px] text-slate-500">Nombre, firma y documento</p></div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function PurchaseDetail({ detail, loading, onClose, onPrint }) {
  if (!detail && !loading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="purchase-detail-title" className="my-auto w-full max-w-4xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Abastecimiento</p><h2 id="purchase-detail-title" className="mt-1 text-lg font-bold text-slate-900">{detail ? `Compra ${detail.compra.numero_factura || `#${detail.compra.id.slice(0, 8)}`}` : 'Detalle de compra'}</h2></div>
          <div className="flex gap-2"><button type="button" disabled={!detail} onClick={() => onPrint(detail.compra.id)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"><Printer size={14} /> Imprimir</button><button type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg p-2 text-slate-400 hover:bg-gray-100"><X size={15} /></button></div>
        </header>
        {loading ? <Spinner label="Cargando detalle…" /> : detail && <div className="space-y-4 p-5 sm:p-6">
          <dl className="grid gap-3 rounded-lg bg-gray-50 p-4 text-[13px] sm:grid-cols-2"><div><dt className="text-slate-400">Proveedor</dt><dd className="mt-1 font-semibold text-slate-800">{detail.compra.proveedor_nombre || 'Sin proveedor'}</dd></div><div><dt className="text-slate-400">Fecha</dt><dd className="mt-1 font-semibold text-slate-800">{dateTime(detail.compra.fecha_compra)}</dd></div><div><dt className="text-slate-400">Factura</dt><dd className="mt-1 font-semibold text-slate-800">{detail.compra.numero_factura || '—'}</dd></div><div><dt className="text-slate-400">Estado</dt><dd className="mt-1 font-semibold text-emerald-700">Registrada</dd></div></dl>
          <div className="overflow-x-auto rounded-lg border border-gray-100"><table className="w-full min-w-[620px] text-left text-[13px]"><thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-right">Costo unitario</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3 text-right">Subtotal</th></tr></thead><tbody className="divide-y divide-gray-50">{detail.detalles.map((item) => <tr key={item.id}><td className="px-4 py-3 font-medium text-slate-800">{item.nombre || 'Producto eliminado'}</td><td className="px-4 py-3 text-right">{item.cantidad}</td><td className="px-4 py-3 text-right">{money(item.precio_costo_unitario)}</td><td className="px-4 py-3">{displayDate(item.fecha_vencimiento)}</td><td className="px-4 py-3 text-right font-semibold">{money(item.subtotal)}</td></tr>)}</tbody></table></div>
          <div className="flex justify-end gap-8 border-t border-gray-100 pt-4 text-sm"><span className="text-slate-500">Total</span><strong className="text-slate-900">{money(detail.compra.total)}</strong></div>
        </div>}
      </section>
    </div>
  );
}

function SupplierPaymentModal({ detail, loading, saving, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [reference, setReference] = useState('');
  if (!detail && !loading) return null;
  const purchase = detail?.compra;
  const balance = Number(purchase?.saldo_pendiente || 0);
  const paid = Number(purchase?.total_pagado || 0);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="supplier-payment-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Cuentas por pagar</p><h2 id="supplier-payment-title" className="mt-1 text-lg font-bold text-slate-900">{purchase ? `Registrar abono · ${purchase.proveedor_nombre || 'Proveedor'}` : 'Cargando compra…'}</h2><p className="mt-1 text-xs text-slate-500">{purchase?.numero_factura ? `Factura ${purchase.numero_factura}` : `Compra #${purchase?.id?.slice(0, 8) || ''}`}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar pagos" className="rounded-lg p-2 text-slate-400 hover:bg-gray-100"><X size={15} /></button>
        </header>
        {loading || !purchase ? <Spinner label="Cargando saldo e historial…" /> : <div className="space-y-5 p-5">
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-4 text-xs sm:gap-4">
            <div><dt className="text-slate-500">Total compra</dt><dd className="mt-1 font-bold text-slate-900">{money(purchase.total)}</dd></div>
            <div><dt className="text-slate-500">Total pagado</dt><dd className="mt-1 font-bold text-emerald-700">{money(paid)}</dd></div>
            <div><dt className="text-slate-500">Saldo pendiente</dt><dd className="mt-1 font-bold text-amber-700">{money(balance)}</dd></div>
          </dl>
          {balance > 0 && <form onSubmit={(event) => onSave(event, { amount: Number(amount), method, reference })} className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Monto a abonar<input required type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} /><span className="mt-1 block text-[10px] font-normal text-slate-400">Máximo: {money(balance)}</span></label>
            <label className="text-xs font-semibold text-slate-600">Método de pago<select value={method} onChange={(event) => setMethod(event.target.value)} className={inputClass}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Referencia (opcional)<input maxLength="500" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="N.º de operación o nota" className={inputClass} /></label>
            <button type="submit" disabled={saving || !amount || Number(amount) > balance} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"><Banknote size={15} />{saving ? 'Registrando…' : 'Guardar abono'}</button>
          </form>}
          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-800">Historial de pagos</h3>
            {detail.pagos?.length ? <div className="overflow-x-auto rounded-lg border border-gray-100"><table className="w-full min-w-[400px] text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-2.5">Fecha</th><th className="px-3 py-2.5 text-right">Monto</th><th className="px-3 py-2.5">Método</th><th className="px-3 py-2.5">Referencia</th></tr></thead><tbody className="divide-y divide-gray-50">{detail.pagos.map((payment) => <tr key={payment.id}><td className="whitespace-nowrap px-3 py-2.5">{dateTime(payment.fecha_pago)}</td><td className="px-3 py-2.5 text-right font-semibold">{money(payment.monto)}</td><td className="px-3 py-2.5 capitalize">{payment.metodo_pago}</td><td className="px-3 py-2.5">{payment.referencia || '—'}</td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">Esta compra todavía no tiene abonos.</p>}
          </div>
          <div className="flex justify-end"><button type="button" onClick={onClose} className="min-h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600 hover:bg-gray-50">Cerrar</button></div>
        </div>}
      </section>
    </div>
  );
}

function NewPurchase({ products, suppliers, negocioId, business, notify, onSaved, onBack, initialPurchase = null, initialDraft = null }) {
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [items, setItems] = useState(() => (initialPurchase?.detalles || initialDraft?.items || []).map((item, index) => ({
    rowId: `${item.id || item.producto_id}-${index}`,
    producto_id: item.producto_id,
    nombre: item.nombre || item.producto_nombre,
    cantidad: Number(item.cantidad),
    costo_unitario: Number(item.precio_costo_unitario ?? item.costo_unitario) || 0,
    fecha_vencimiento: item.fecha_vencimiento ? String(item.fecha_vencimiento).slice(0, 10) : null,
  })));
  const [supplierQuery, setSupplierQuery] = useState(initialPurchase?.compra?.proveedor_nombre || initialDraft?.supplier?.nombre_empresa || '');
  const [supplier, setSupplier] = useState(() => initialPurchase?.compra?.proveedor_id ? {
    id: initialPurchase.compra.proveedor_id,
    nombre_empresa: initialPurchase.compra.proveedor_nombre,
    nit_ci: initialPurchase.compra.proveedor_nit_ci,
    telefono: initialPurchase.compra.proveedor_telefono,
  } : initialDraft?.supplier || null);
  const [supplierOptionsOpen, setSupplierOptionsOpen] = useState(false);
  const [invoice, setInvoice] = useState(initialPurchase?.compra?.numero_factura || '');
  const [supplierNit, setSupplierNit] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(initialPurchase?.compra?.metodo_pago || 'efectivo');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    Promise.all([api('/api/marcas', { negocioId }), api('/api/categorias', { negocioId })])
      .then(([brandRows, categoryRows]) => {
        if (active) { setBrands(brandRows); setCategories(categoryRows); }
      })
      .catch((error) => { if (active) notify(error.message, 'error'); });
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [negocioId, notify]);

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return products.filter((product) => product.activo !== false
      && (!text || `${product.nombre || ''} ${product.codigo_barras || ''}`.toLocaleLowerCase().includes(text))
      && (!brandFilter || product.marca_id === brandFilter)
      && (!categoryFilter || product.categoria_id === categoryFilter));
  }, [brandFilter, categoryFilter, products, query]);
  const supplierMatches = useMemo(() => {
    const text = supplierQuery.trim().toLocaleLowerCase();
    return suppliers.filter((item) => !text || `${item.nombre_empresa} ${item.nit_ci || ''} ${item.telefono || ''}`.toLocaleLowerCase().includes(text));
  }, [supplierQuery, suppliers]);
  const total = items.reduce((sum, item) => sum + item.cantidad * item.costo_unitario, 0);

  function chooseProduct(product) {
    setSelectedProduct(product);
    setUnitCost(String(product.precio_compra ?? '0'));
    setExpirationDate(product.fecha_vencimiento ? String(product.fecha_vencimiento).slice(0, 10) : '');
    setQuantity('1');
  }

  function addItem() {
    const amount = Number(quantity);
    const cost = Number(unitCost);
    if (!selectedProduct || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(cost) || cost < 0) {
      notify('Selecciona un producto e ingresa cantidad y costo válidos.', 'error');
      return;
    }
    setItems((current) => [...current, {
      rowId: `${Date.now()}-${Math.random()}`,
      producto_id: selectedProduct.id,
      nombre: selectedProduct.nombre,
      cantidad: amount,
      costo_unitario: cost,
      fecha_vencimiento: expirationDate || null,
    }]);
    setSelectedProduct(null);
    setQuery('');
  }

  async function savePurchase(event) {
    event.preventDefault();
    if (!items.length) return notify('Agrega al menos un producto a la compra.', 'error');
    if (paymentMethod === 'credito' && !supplier) return notify('Selecciona un proveedor para registrar una compra a crédito.', 'error');
    setSaving(true);
    try {
      const response = await api(initialPurchase ? `/api/compras/${initialPurchase.compra.id}` : '/api/compras', {
        method: initialPurchase ? 'PUT' : 'POST',
        negocioId,
        body: JSON.stringify({
          proveedor_id: supplier?.id || null,
          numero_factura: invoice.trim() || null,
          metodo_pago: paymentMethod,
          items: items.map((item) => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_costo_unitario: item.costo_unitario,
            fecha_vencimiento: item.fecha_vencimiento,
          })),
        }),
      });
      setNote({
        compra: response.compra,
        proveedor: response.proveedor ? { ...response.proveedor, nit_ci: response.proveedor.nit_ci || supplierNit } : null,
        detalles: response.detalles.map((detail, index) => ({ ...detail, nombre: items[index]?.nombre })),
        pagos: response.pagos || [],
      });
      setItems([]);
      setInvoice('');
      setSupplier(null);
      setSupplierQuery('');
      notify(initialPurchase ? 'Compra actualizada correctamente.' : `Compra registrada · ${money(response.compra.total)}.`);
      try {
        await onSaved();
      } catch (error) {
        notify(`La compra quedó registrada, pero no se pudieron actualizar los datos de inventario: ${error.message}`, 'error');
      }
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Abastecimiento</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{initialPurchase ? 'Editar compra' : 'Nueva compra'}</h1><p className="mt-1 text-sm text-slate-500">Selecciona productos y registra sus costos y vencimientos por lote.</p></div>
        <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"><ArrowLeft size={15} /> Historial de compras</button>
      </div>
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-extrabold text-slate-900">Catálogo</h2><p className="mt-1 text-sm text-slate-500">{filteredProducts.length} productos disponibles</p></div>
              <label className="relative block w-full sm:max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><span className="sr-only">Buscar producto</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o código…" className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-500">Marca<select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className={inputClass}><option value="">Todas las marcas</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-500">Categoría<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
            </div>
          </div>
          {!filteredProducts.length ? <p className="py-12 text-center text-sm text-slate-400">No hay productos que coincidan con los filtros.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <button type="button" key={product.id} onClick={() => chooseProduct(product)} className={`group flex min-h-40 flex-col rounded-xl border p-3 text-left transition hover:border-emerald-400 hover:shadow-md ${selectedProduct?.id === product.id ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                  <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">{product.imagen_url ? <img src={assetUrl(product.imagen_url)} alt="" className="h-full w-full object-cover" /> : <Package size={22} />}</span>
                  <span className="mt-3 line-clamp-2 text-[13px] font-bold leading-snug text-slate-800">{product.nombre}</span>
                  <span className="mt-auto pt-3 text-xs font-semibold text-slate-500">Stock: {product.stock_actual}</span>
                </button>
              ))}
            </div>
          )}
          {selectedProduct && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Agregar producto</p><h3 className="mt-1 text-sm font-bold text-slate-900">{selectedProduct.nombre}</h3></div><button type="button" onClick={() => setSelectedProduct(null)} aria-label="Cerrar producto seleccionado" className="rounded-lg p-2 text-slate-500 hover:bg-white"><X size={15} /></button></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-semibold text-slate-600">Cantidad<input autoFocus type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} /></label>
              <label className="text-xs font-semibold text-slate-600">Costo unitario<input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} className={inputClass} /></label>
              <label className="text-xs font-semibold text-slate-600">Fecha de vencimiento<input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} className={inputClass} /></label>
              <button type="button" onClick={addItem} className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"><Plus size={15} /> Agregar a la compra</button>
            </div>
          </div>}
        </section>

        <aside className="overflow-visible rounded-xl border border-gray-100 bg-white shadow-sm 2xl:sticky 2xl:top-5">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div><h2 className="font-extrabold text-slate-900">Detalle de compra</h2><p className="mt-1 text-xs text-slate-500">{now.toLocaleString('es-BO')}</p></div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShoppingBag size={18} /></span>
          </div>
          <form onSubmit={savePurchase} className="space-y-4 p-4">
            <div className="relative">
              <label className="text-xs font-semibold text-slate-600"><span className="mb-1 flex items-center gap-1"><Truck size={14} /> Proveedor</span>
                <input value={supplierQuery} onFocus={() => setSupplierOptionsOpen(true)} onChange={(event) => { setSupplierQuery(event.target.value); setSupplier(null); setSupplierNit(''); setSupplierOptionsOpen(true); }} placeholder="Buscar proveedor…" className={inputClass} />
              </label>
              {supplier && <p className="mt-1 text-[11px] font-medium text-emerald-700">Seleccionado: {supplier.nombre_empresa}{supplier.nit_ci ? ` · NIT ${supplier.nit_ci}` : ''}</p>}
              {supplierOptionsOpen && supplierQuery.trim() && !supplier && <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                {supplierMatches.map((item) => <button key={item.id} type="button" onClick={() => { setSupplier(item); setSupplierQuery(item.nombre_empresa); setSupplierNit(item.nit_ci || ''); setSupplierOptionsOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-emerald-50"><span className="block text-xs font-bold text-slate-800">{item.nombre_empresa}</span><span className="text-[10px] text-slate-500">{item.nit_ci ? `NIT/CI: ${item.nit_ci}` : 'Sin NIT/CI'}{item.telefono ? ` · ${item.telefono}` : ''}</span></button>)}
                {!supplierMatches.length && <p className="px-3 py-2 text-xs text-slate-500">No hay proveedores que coincidan.</p>}
              </div>}
            </div>
            {supplier && !supplier.nit_ci && <label className="block text-xs font-semibold text-slate-600">NIT / CI del proveedor<input value={supplierNit} onChange={(event) => setSupplierNit(event.target.value)} maxLength={50} className={inputClass} /></label>}
            <label className="block text-xs font-semibold text-slate-600">N.º de factura<input value={invoice} onChange={(event) => setInvoice(event.target.value)} maxLength={50} placeholder="Opcional" className={inputClass} /></label>
            <label className="block text-xs font-semibold text-slate-600">Método de pago
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={inputClass}>
                <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="credito">Crédito</option>
              </select>
            </label>
            {paymentMethod === 'credito' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">La compra quedará pendiente de pago. Debes seleccionar un proveedor.</p>}
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-2.5">Producto</th><th className="px-3 py-2.5 text-right">Cant.</th><th className="px-3 py-2.5 text-right">Costo</th><th className="px-3 py-2.5">Vence</th><th className="px-3 py-2.5 text-right">Subtotal</th><th className="px-2 py-2.5" /></tr></thead>
                <tbody className="divide-y divide-slate-50">{items.map((item) => <tr key={item.rowId}><td className="max-w-32 truncate px-3 py-2.5 font-medium text-slate-700">{item.nombre}</td><td className="px-3 py-2.5 text-right">{item.cantidad}</td><td className="px-3 py-2.5 text-right">{money(item.costo_unitario)}</td><td className="px-3 py-2.5 whitespace-nowrap">{displayDate(item.fecha_vencimiento)}</td><td className="px-3 py-2.5 text-right font-semibold">{money(item.cantidad * item.costo_unitario)}</td><td className="px-2 py-2.5"><button type="button" aria-label={`Eliminar ${item.nombre}`} onClick={() => setItems((current) => current.filter((entry) => entry.rowId !== item.rowId))} className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button></td></tr>)}
                  {!items.length && <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-400">Agrega productos desde el catálogo.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-semibold text-slate-600">Total de compra</span><strong className="text-xl font-extrabold text-emerald-700">{money(total)}</strong></div>
            <button type="submit" disabled={saving || !items.length} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{saving ? 'Registrando…' : 'Registrar Compra'}</button>
            <p className="text-center text-[10px] text-slate-400">El costo de compra actualiza inventario y costo del producto; no modifica el precio de venta.</p>
          </form>
        </aside>
      </div>
      {note && <PurchaseNote detail={note} business={business} onClose={() => setNote(null)} />}
    </div>
  );
}

export default function PurchasesPage({ products, negocioId, business, notify, onRefresh, canManage, openFormInitially = false, initialDraft = null, onNavigate }) {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState(null);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const purchaseColumns = [
    { label: 'Factura', value: (purchase) => purchase.numero_factura || purchase.id.slice(0, 8) },
    { label: 'Fecha', value: (purchase) => dateTime(purchase.fecha_compra) },
    { label: 'Proveedor', value: (purchase) => purchase.proveedor_nombre || 'Sin proveedor' },
    { label: 'Método de pago', value: (purchase) => purchase.metodo_pago || 'efectivo' },
    { label: 'Estado', value: (purchase) => purchase.estado },
    { label: 'Total', value: (purchase) => Number(purchase.total) },
    { label: 'Saldo pendiente', value: (purchase) => Number(purchase.saldo_pendiente || 0) },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [supplierData, purchaseData] = await Promise.all([api('/api/proveedores', { negocioId }), api('/api/compras', { negocioId })]);
      setSuppliers(supplierData);
      setPurchases(purchaseData);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [negocioId, notify]);
  useEffect(() => { load(); }, [load]);

  async function showDetails(id, print = false) {
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await api(`/api/compras/${id}`, { negocioId });
      if (print) setNote(data);
      else setDetail(data);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  async function startEdit(id) {
    try {
      const data = await api(`/api/compras/${id}`, { negocioId });
      if (Number(data.compra.total_pagado) > 0) {
        notify('No se puede editar una compra con pagos registrados. Anúlala y registra una nueva compra.', 'error');
        return;
      }
      setEditingPurchase(data);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function deletePurchase(purchase) {
    if (!window.confirm(`¿Eliminar la compra ${purchase.numero_factura || `#${purchase.id.slice(0, 8)}`}? Se descontarán del inventario las cantidades recibidas. Esta acción no se puede deshacer.`)) return;
    try {
      await api(`/api/compras/${purchase.id}`, { method: 'DELETE', negocioId });
      notify('Compra eliminada y stock revertido.');
      await Promise.all([load(), onRefresh()]);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function cancelPurchase(purchase) {
    if (!window.confirm(`¿Anular la compra ${purchase.numero_factura || `#${purchase.id.slice(0, 8)}`}? Se descontará el stock recibido y se conservará el historial de pagos. La devolución de dinero al proveedor debe registrarse por el procedimiento contable correspondiente.`)) return;
    try {
      await api(`/api/compras/${purchase.id}/anular`, { method: 'POST', negocioId });
      notify('Compra anulada y stock revertido.');
      await Promise.all([load(), onRefresh()]);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function openPayments(id) {
    setPaymentDetail(null);
    setPaymentLoading(true);
    try {
      setPaymentDetail(await api(`/api/compras/${id}`, { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setPaymentLoading(false);
    }
  }

  async function savePayment(event, payment) {
    event.preventDefault();
    if (!paymentDetail) return;
    setPaymentSaving(true);
    try {
      await api(`/api/compras/${paymentDetail.compra.id}/pagos`, {
        method: 'POST',
        negocioId,
        body: JSON.stringify({
          monto: payment.amount,
          metodo_pago: payment.method,
          referencia: payment.reference,
        }),
      });
      notify('Abono al proveedor registrado.');
      await load();
      setPaymentDetail(await api(`/api/compras/${paymentDetail.compra.id}`, { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setPaymentSaving(false);
    }
  }

  if (openFormInitially || editingPurchase) {
    return <NewPurchase
      key={editingPurchase?.compra.id || `new-${negocioId}-${initialDraft?.createdAt || ''}`}
      products={products}
      suppliers={suppliers}
      negocioId={negocioId}
      business={business}
      notify={notify}
      onSaved={async () => { await Promise.all([load(), onRefresh()]); }}
      initialPurchase={editingPurchase}
      initialDraft={openFormInitially ? initialDraft : null}
      onBack={() => {
        setEditingPurchase(null);
        if (openFormInitially) onNavigate('purchases');
      }}
    />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Abastecimiento</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Historial de compras</h1><p className="mt-1 text-sm text-slate-500">Entradas de mercancía y movimientos de proveedores.</p></div>
        <div className="flex flex-wrap items-center gap-2"><ReportActions title="Historial de Compras" business={business} rows={purchases} columns={purchaseColumns} fileName="historial-compras" sheetName="Compras" orientation="landscape" />{canManage && <button type="button" onClick={() => onNavigate('purchase-new')} className="flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus size={15} /> Registrar compra</button>}</div>
      </div>
      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="text-sm font-bold text-slate-900">Movimientos de mercancía</h2><p className="mt-1 text-xs text-slate-400">Historial completo de compras del negocio</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{purchases.length} registros</span></div>
        {loading ? <Spinner label="Cargando compras…" /> : purchases.length === 0 ? <p className="px-5 py-14 text-center text-sm text-slate-400">Todavía no hay compras registradas.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-[13px]"><thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">ID / Factura</th><th className="px-5 py-3 font-semibold">Fecha</th><th className="px-5 py-3 font-semibold">Proveedor</th><th className="px-5 py-3 font-semibold">Pago</th><th className="px-5 py-3 font-semibold">Estado</th><th className="px-5 py-3 text-right font-semibold">Total</th><th className="px-5 py-3 text-right font-semibold">Saldo</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody className="divide-y divide-gray-50">{purchases.map((purchase) => {
            const annulled = purchase.estado === 'anulada';
            const balance = Number(purchase.saldo_pendiente || 0);
            const outstanding = purchase.metodo_pago === 'credito' && balance > 0 && !annulled;
            const hasPayments = Number(purchase.total_pagado || 0) > 0;
            const stateLabel = annulled ? 'Anulada' : outstanding ? (Number(purchase.total_pagado) > 0 ? 'Parcial' : 'Pendiente') : 'Pagada';
            const stateClass = annulled ? 'bg-rose-50 text-rose-700' : outstanding ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700';
            return <tr key={purchase.id} className="hover:bg-gray-50/70">
              <td className="px-5 py-3.5"><span className="font-semibold text-slate-800">{purchase.numero_factura || `#${purchase.id.slice(0, 8)}`}</span><span className="mt-0.5 block font-mono text-[10px] text-slate-400">{purchase.id.slice(0, 8)}</span></td>
              <td className="px-5 py-3.5 text-slate-600">{dateTime(purchase.fecha_compra)}</td>
              <td className="px-5 py-3.5 text-slate-700">{purchase.proveedor_nombre || 'Sin proveedor'}</td>
              <td className="px-5 py-3.5 capitalize text-slate-600">{purchase.metodo_pago || 'efectivo'}</td>
              <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${stateClass}`}>{stateLabel}</span></td>
              <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{money(purchase.total)}</td>
              <td className="px-5 py-3.5 text-right font-semibold text-amber-700">{money(balance)}</td>
              <td className="px-5 py-3.5"><div className="flex justify-end gap-1">
                <button type="button" title="Ver detalle" onClick={() => showDetails(purchase.id)} className="rounded-lg px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Ver</button>
                <button type="button" title="Imprimir nota" onClick={() => showDetails(purchase.id, true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Printer size={15} /></button>
                {canManage && outstanding && <button type="button" title="Registrar pago" aria-label="Registrar pago al proveedor" onClick={() => openPayments(purchase.id)} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><Banknote size={16} /></button>}
                {canManage && !annulled && !hasPayments && <button type="button" title="Editar compra" aria-label="Editar compra" onClick={() => startEdit(purchase.id)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Pencil size={15} /></button>}
                {canManage && !annulled && <button type="button" title={hasPayments ? 'Anular compra y conservar pagos' : 'Eliminar compra y revertir stock'} aria-label={hasPayments ? 'Anular compra' : 'Eliminar compra'} onClick={() => hasPayments ? cancelPurchase(purchase) : deletePurchase(purchase)} className={`rounded-lg p-2 ${hasPayments ? 'text-amber-700 hover:bg-amber-50' : 'text-rose-600 hover:bg-rose-50'}`}>{hasPayments ? <Ban size={15} /> : <Trash2 size={15} />}</button>}
              </div></td>
            </tr>;
          })}</tbody></table></div>
        )}
      </section>
      <PurchaseDetail detail={detail} loading={detailLoading} onClose={() => { setDetail(null); setDetailLoading(false); }} onPrint={(id) => showDetails(id, true)} />
      {note && <PurchaseNote detail={note} business={business} onClose={() => setNote(null)} />}
      {(paymentDetail || paymentLoading) && <SupplierPaymentModal key={paymentDetail?.compra.id || 'loading'} detail={paymentDetail} loading={paymentLoading} saving={paymentSaving} onClose={() => { setPaymentDetail(null); setPaymentLoading(false); }} onSave={savePayment} />}
    </div>
  );
}
