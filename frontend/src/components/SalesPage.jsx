import { useCallback, useEffect, useState } from 'react';
import { Banknote, Eye, Pencil, Printer, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import Spinner from './Spinner.jsx';
import TicketImpresion from './TicketImpresion.jsx';
import ReportActions from './ReportActions.jsx';

const money = (value) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0);
const localDate = (value) => new Date(value).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });

function DetailModal({ detail, loading, onClose, onPrint }) {
  if (!detail && !loading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sale-detail-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Comprobante</p><h2 id="sale-detail-title" className="mt-1 text-lg font-bold text-slate-900">{detail ? `Venta #${detail.venta.numero_ticket}` : 'Detalle de venta'}</h2></div>
          <div className="flex items-center gap-2"><button type="button" disabled={!detail} onClick={() => onPrint(detail.venta.id)} title="Reimprimir ticket" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Printer size={15} /> Reimprimir Ticket</button><button type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg p-2 text-slate-400 hover:bg-gray-100"><X size={15} /></button></div>
        </div>
        {loading ? <Spinner label="Cargando detalle…" /> : detail && (
          <div className="space-y-5 p-5 sm:p-6">
            <dl className="grid gap-3 rounded-lg bg-gray-50 p-4 text-[13px] sm:grid-cols-2">
              <div><dt className="text-slate-400">Cliente</dt><dd className="mt-1 font-semibold text-slate-800">{detail.venta.cliente_nombre}</dd></div>
              <div><dt className="text-slate-400">Fecha</dt><dd className="mt-1 font-semibold text-slate-800">{localDate(detail.venta.fecha_venta)}</dd></div>
              <div><dt className="text-slate-400">Método de pago</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{detail.venta.metodo_pago}</dd></div>
              <div><dt className="text-slate-400">Estado</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{detail.venta.estado}</dd></div>
            </dl>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3 text-right">Cant.</th><th className="px-4 py-3 text-right">Precio</th><th className="px-4 py-3 text-right">Importe</th></tr></thead>
                <tbody className="divide-y divide-gray-50">{detail.detalles.map((item) => <tr key={item.id}><td className="px-4 py-3 font-medium text-slate-800">{item.nombre || 'Producto eliminado'}<span className="block text-[11px] text-slate-400">{item.codigo_barras || ''}</span></td><td className="px-4 py-3 text-right">{item.cantidad}</td><td className="px-4 py-3 text-right">{money(item.precio_unitario)}</td><td className="px-4 py-3 text-right font-semibold">{money(item.subtotal)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="ml-auto max-w-xs space-y-2 text-sm"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(detail.venta.subtotal)}</span></div><div className="flex justify-between text-slate-500"><span>Descuento</span><span>{money(detail.venta.descuento)}</span></div><div className="flex justify-between border-t border-gray-100 pt-3 font-bold text-slate-900"><span>Total</span><span>{money(detail.venta.total)}</span></div></div>
          </div>
        )}
      </section>
    </div>
  );
}

function EditSaleModal({ sale, products, busy, onClose, onSave, onChange }) {
  if (!sale) return null;
  const fieldClass = 'mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="edit-sale-title" className="my-auto w-full max-w-3xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Modificar comprobante</p><h2 id="edit-sale-title" className="mt-1 text-lg font-bold text-slate-900">Venta #{sale.venta.numero_ticket}</h2></div>
          <button type="button" onClick={onClose} aria-label="Cerrar edición" className="rounded-lg p-2 text-slate-400 hover:bg-gray-100"><X size={15} /></button>
        </header>
        <form onSubmit={onSave} className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Cliente<input required maxLength="150" value={sale.cliente_nombre} onChange={(event) => onChange('cliente_nombre', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-slate-600">Teléfono o CI<input required={sale.metodo_pago === 'credito'} maxLength="50" value={sale.cliente_contacto} onChange={(event) => onChange('cliente_contacto', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-slate-600">Fecha y hora<input required type="datetime-local" value={sale.fecha_venta} onChange={(event) => onChange('fecha_venta', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-slate-600">Descuento<input type="number" min="0" step="0.01" value={sale.descuento} onChange={(event) => onChange('descuento', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Método de pago
              <select value={sale.metodo_pago} onChange={(event) => onChange('metodo_pago', event.target.value)} className={fieldClass}>
                <option value="efectivo">Efectivo</option><option value="qr">QR / Transferencia</option><option value="tarjeta">Tarjeta</option><option value="mixto">Mixto</option><option value="credito">Crédito</option>
              </select>
            </label>
            {sale.metodo_pago === 'efectivo' && <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Efectivo recibido<input type="number" min="0" step="0.01" value={sale.monto_recibido} onChange={(event) => onChange('monto_recibido', event.target.value)} className={fieldClass} /></label>}
            {sale.metodo_pago === 'mixto' && <>
              <label className="text-xs font-semibold text-slate-600">Monto efectivo<input type="number" min="0" step="0.01" value={sale.monto_efectivo} onChange={(event) => onChange('monto_efectivo', event.target.value)} className={fieldClass} /></label>
              <label className="text-xs font-semibold text-slate-600">Monto QR<input type="number" min="0" step="0.01" value={sale.monto_qr} onChange={(event) => onChange('monto_qr', event.target.value)} className={fieldClass} /></label>
            </>}
          </div>
          {sale.metodo_pago === 'credito' && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">El total editado quedará como saldo pendiente del cliente.</p>}
          <div className="rounded-lg border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><h3 className="text-xs font-bold text-slate-800">Productos y cantidades</h3><button type="button" onClick={() => onChange('items', [...sale.items, { producto_id: '', cantidad: 1 }])} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Agregar producto</button></div>
            <div className="space-y-2 p-3">
              {sale.items.map((item, index) => (
                <div key={`${item.producto_id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_100px_34px] items-center gap-2">
                  <select required value={item.producto_id} onChange={(event) => {
                    const selected = products.find((product) => product.id === event.target.value);
                    onChange('items', sale.items.map((entry, row) => row === index ? { ...entry, producto_id: event.target.value, nombre: selected?.nombre } : entry));
                  }} className="min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-xs">
                    <option value="">Seleccionar producto</option>
                    {products.filter((product) => product.activo !== false || product.id === item.producto_id).map((product) => <option key={product.id} value={product.id}>{product.nombre}{product.activo === false ? ' (inactivo)' : ''}</option>)}
                  </select>
                  <input aria-label="Cantidad" required type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(event) => onChange('items', sale.items.map((entry, row) => row === index ? { ...entry, cantidad: event.target.value } : entry))} className="min-h-10 rounded-lg border border-gray-200 px-2 text-xs" />
                  <button type="button" title="Quitar producto" aria-label="Quitar producto" onClick={() => onChange('items', sale.items.filter((_, row) => row !== index))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
                </div>
              ))}
              {!sale.items.length && <p className="py-4 text-center text-xs text-slate-400">Agrega al menos un producto a la venta.</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600">Cancelar</button>
            <button type="submit" disabled={busy || !sale.items.length} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CreditPaymentsModal({ detail, loading, saving, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [note, setNote] = useState('');
  if (!detail && !loading) return null;
  const sale = detail?.venta;
  const balance = Number(sale?.saldo_pendiente || 0);
  const paid = Number(sale?.total_pagado || 0);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="credit-payment-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Créditos y cobros</p><h2 id="credit-payment-title" className="mt-1 text-lg font-bold text-slate-900">{sale ? `Registrar pago · Venta #${sale.numero_ticket}` : 'Cargando crédito…'}</h2><p className="mt-1 text-xs text-slate-500">{sale?.cliente_nombre || ''}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar pagos" className="rounded-lg p-2 text-slate-400 hover:bg-gray-100"><X size={15} /></button>
        </header>
        {loading || !sale ? <Spinner label="Cargando saldo e historial…" /> : (
          <div className="space-y-5 p-5">
            <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-4 text-xs sm:gap-4">
              <div><dt className="text-slate-500">Total venta</dt><dd className="mt-1 font-bold text-slate-900">{money(sale.total)}</dd></div>
              <div><dt className="text-slate-500">Total pagado</dt><dd className="mt-1 font-bold text-emerald-700">{money(paid)}</dd></div>
              <div><dt className="text-slate-500">Saldo pendiente</dt><dd className="mt-1 font-bold text-amber-700">{money(balance)}</dd></div>
            </dl>
            {balance > 0 && <form onSubmit={(event) => onSave(event, { amount: Number(amount), method, note })} className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Monto a abonar
                <input required type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500" />
                <span className="mt-1 block text-[10px] font-normal text-slate-400">Máximo: {money(balance)}</span>
              </label>
              <label className="text-xs font-semibold text-slate-600">Método de pago
                <select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-emerald-500">
                  <option value="efectivo">Efectivo</option><option value="qr">QR / Transferencia</option><option value="tarjeta">Tarjeta</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Referencia o nota (opcional)
                <input maxLength="500" value={note} onChange={(event) => setNote(event.target.value)} placeholder="N.º de operación o comentario" className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500" />
              </label>
              <button type="submit" disabled={saving || !amount || Number(amount) > balance} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"><Banknote size={15} />{saving ? 'Registrando…' : 'Guardar Pago'}</button>
              <p className="text-[11px] text-slate-500 sm:col-span-2">El cobro se registra en el turno de caja activo. Si no hay turno abierto, primero debes aperturarlo.</p>
            </form>}
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-800">Historial de abonos</h3>
              {detail.pagos?.length ? <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-2.5">Fecha</th><th className="px-3 py-2.5 text-right">Monto</th><th className="px-3 py-2.5">Método</th><th className="px-3 py-2.5">Referencia</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">{detail.pagos.map((payment) => <tr key={payment.id}><td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{localDate(payment.fecha_pago)}</td><td className="px-3 py-2.5 text-right font-semibold text-slate-800">{money(payment.monto)}</td><td className="px-3 py-2.5 capitalize text-slate-600">{payment.metodo_pago}</td><td className="px-3 py-2.5 text-slate-500">{payment.referencia_nota || '—'}</td></tr>)}</tbody>
                </table>
              </div> : <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">Esta venta todavía no tiene abonos.</p>}
            </div>
            <div className="flex justify-end"><button type="button" onClick={onClose} className="min-h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600 hover:bg-gray-50">Cerrar</button></div>
          </div>
        )}
      </section>
    </div>
  );
}

const localInputDate = (value) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function SalesPage({ negocioId, products, business, canManage, onRefresh, notify }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ desde: '', hasta: '', cliente: '', metodo_pago: '' });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [view, setView] = useState('all');
  const [creditDetail, setCreditDetail] = useState(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const loadSales = useCallback(async () => {
    if (filters.desde && filters.hasta && filters.desde > filters.hasta) {
      notify('La fecha inicial no puede ser posterior a la fecha final.', 'error');
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      setSales(await api(`/api/ventas${params.size ? `?${params}` : ''}`, { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, negocioId, notify]);

  useEffect(() => { loadSales(); }, [loadSales]);

  async function showDetails(id, printAfter = false) {
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await api(`/api/ventas/${id}`, { negocioId });
      if (printAfter) setTicket(data);
      else setDetail(data);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  async function startEdit(id) {
    try {
      const data = await api(`/api/ventas/${id}`, { negocioId });
      setEditing({
        ...data,
        cliente_nombre: data.venta.cliente_nombre || '',
        cliente_contacto: data.venta.cliente_contacto || '',
        fecha_venta: localInputDate(data.venta.fecha_venta),
        metodo_pago: data.venta.metodo_pago,
        descuento: data.venta.descuento || 0,
        monto_recibido: data.venta.monto_recibido || data.venta.monto_efectivo || 0,
        monto_efectivo: data.venta.monto_efectivo || 0,
        monto_qr: data.venta.monto_qr || 0,
        items: data.detalles.map((item) => ({ producto_id: item.producto_id, cantidad: item.cantidad, nombre: item.nombre })),
      });
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  function changeEditor(field, value) {
    setEditing((current) => ({ ...current, [field]: value }));
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editing) return;
    setEditBusy(true);
    try {
      await api(`/api/ventas/${editing.venta.id}`, {
        method: 'PUT',
        negocioId,
        body: JSON.stringify({
          cliente_nombre: editing.cliente_nombre.trim(),
          cliente_contacto: editing.cliente_contacto.trim(),
          fecha_venta: new Date(editing.fecha_venta).toISOString(),
          descuento: Number(editing.descuento),
          metodo_pago: editing.metodo_pago,
          monto_efectivo: Number(editing.metodo_pago === 'efectivo' ? editing.monto_recibido : editing.monto_efectivo),
          monto_qr: Number(editing.monto_qr),
          items: editing.items.map((item) => ({ producto_id: item.producto_id, cantidad: Number(item.cantidad) })),
        }),
      });
      setEditing(null);
      notify('Venta actualizada correctamente.');
      await Promise.all([loadSales(), onRefresh()]);
      if (detail?.venta.id === editing.venta.id) await showDetails(editing.venta.id);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setEditBusy(false);
    }
  }

  async function cancelSale(sale) {
    if (!window.confirm(`¿Anular la venta #${sale.numero_ticket} por ${money(sale.total)}? Se restaurarán los productos al inventario y se ajustará el turno de caja. Esta acción no se puede deshacer.`)) return;
    setActionBusy(sale.id);
    try {
      await api(`/api/ventas/${sale.id}`, { method: 'DELETE', negocioId });
      notify(`Venta #${sale.numero_ticket} anulada. El stock fue devuelto al inventario.`);
      await Promise.all([loadSales(), onRefresh()]);
      if (detail?.venta.id === sale.id) await showDetails(sale.id);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setActionBusy('');
    }
  }

  async function openCredit(saleId) {
    setCreditDetail(null);
    setCreditLoading(true);
    try {
      setCreditDetail(await api(`/api/ventas/${saleId}`, { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setCreditLoading(false);
    }
  }

  async function savePayment(event, payment) {
    event.preventDefault();
    if (!creditDetail) return;
    setPaymentSaving(true);
    try {
      await api(`/api/ventas/${creditDetail.venta.id}/pagos`, {
        method: 'POST',
        negocioId,
        body: JSON.stringify({
          monto: payment.amount,
          metodo_pago: payment.method,
          referencia_nota: payment.note,
        }),
      });
      notify('Abono registrado y caja actualizada.');
      await Promise.all([loadSales(), onRefresh()]);
      setCreditDetail(await api(`/api/ventas/${creditDetail.venta.id}`, { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setPaymentSaving(false);
    }
  }

  const visibleSales = sales.filter((sale) => view === 'all'
    || (String(sale.metodo_pago).toLowerCase() === 'credito' && Number(sale.saldo_pendiente) > 0));
  const total = visibleSales.filter((sale) => String(sale.estado).toUpperCase() !== 'ANULADA')
    .reduce((sum, sale) => sum + Number(view === 'credits' ? sale.saldo_pendiente : sale.total), 0);
  const salesColumns = [
    { label: 'Ticket', value: (sale) => sale.numero_ticket },
    { label: 'Fecha', value: (sale) => localDate(sale.fecha_venta) },
    { label: 'Cliente', value: (sale) => sale.cliente_nombre || 'Cliente General' },
    { label: 'Método de pago', value: (sale) => sale.metodo_pago },
    { label: 'Estado', value: (sale) => sale.estado },
    { label: 'Total', value: (sale) => Number(sale.total) },
    { label: 'Saldo pendiente', value: (sale) => Number(sale.saldo_pendiente || 0) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Movimientos</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Historial de ventas</h1><p className="mt-1 text-sm text-slate-500">Consulta y filtra las transacciones del negocio.</p></div>
        <div className="flex flex-wrap items-end gap-3"><div className="rounded-lg border border-gray-100 bg-white px-4 py-2 shadow-sm"><p className="text-[11px] text-slate-400">{view === 'credits' ? 'Saldo por cobrar' : 'Ventas en resultados'}</p><p className="mt-0.5 text-sm font-bold text-slate-900">{visibleSales.length} · {money(total)}</p></div><ReportActions title="Historial de Ventas" business={business} rows={visibleSales} columns={salesColumns} fileName="historial-ventas" sheetName="Ventas" orientation="landscape" /></div>
      </div>
      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1fr_auto]">
          <label className="text-[11px] font-semibold text-slate-500">Desde<input type="date" value={filters.desde} onChange={(event) => setFilters({ ...filters, desde: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] text-slate-700 outline-none focus:border-emerald-500" /></label>
          <label className="text-[11px] font-semibold text-slate-500">Hasta<input type="date" value={filters.hasta} onChange={(event) => setFilters({ ...filters, hasta: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] text-slate-700 outline-none focus:border-emerald-500" /></label>
          <label className="text-[11px] font-semibold text-slate-500">Cliente<input value={filters.cliente} onChange={(event) => setFilters({ ...filters, cliente: event.target.value })} placeholder="Buscar cliente…" className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] text-slate-700 outline-none focus:border-emerald-500" /></label>
          <label className="text-[11px] font-semibold text-slate-500">Método de pago<select value={filters.metodo_pago} onChange={(event) => setFilters({ ...filters, metodo_pago: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-emerald-500"><option value="">Todos</option><option value="efectivo">Efectivo</option><option value="qr">QR / Transferencia</option><option value="tarjeta">Tarjeta</option><option value="mixto">Mixto</option><option value="credito">Crédito</option></select></label>
          <button type="button" onClick={() => setFilters({ desde: '', hasta: '', cliente: '', metodo_pago: '' })} className="min-h-10 self-end rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600 hover:bg-gray-50">Limpiar</button>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <nav className="flex gap-1 border-b border-gray-100 px-4">
          <button type="button" onClick={() => setView('all')} className={`border-b-2 px-3 py-3 text-xs font-bold ${view === 'all' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>Todas las ventas</button>
          <button type="button" onClick={() => setView('credits')} className={`border-b-2 px-3 py-3 text-xs font-bold ${view === 'credits' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500'}`}>Créditos y Cobros</button>
        </nav>
        <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">{view === 'credits' ? 'Créditos pendientes' : 'Transacciones'}</h2><p className="mt-1 text-xs text-slate-400">{view === 'credits' ? 'Ventas a crédito con saldo por cobrar.' : 'Hasta 200 resultados · datos del negocio seleccionado'}</p></div>
        {loading ? <Spinner label="Cargando ventas…" /> : visibleSales.length === 0 ? <p className="px-5 py-14 text-center text-sm text-slate-400">{view === 'credits' ? 'No hay créditos pendientes.' : 'No hay ventas que coincidan con los filtros.'}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">ID / Ticket</th><th className="px-5 py-3 font-semibold">Fecha</th><th className="px-5 py-3 font-semibold">Cliente</th><th className="px-5 py-3 font-semibold">Pago</th><th className="px-5 py-3 font-semibold">Estado</th>{view === 'credits' && <th className="px-5 py-3 text-right font-semibold">Saldo</th>}<th className="px-5 py-3 text-right font-semibold">Total</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-50">{visibleSales.map((sale) => {
                const annulled = String(sale.estado).toUpperCase() === 'ANULADA';
                const creditPending = String(sale.metodo_pago).toLowerCase() === 'credito' && Number(sale.saldo_pendiente) > 0;
                const stateLabel = creditPending
                  ? Number(sale.total_pagado) > 0 ? 'Abonando' : 'Pendiente'
                  : String(sale.estado).toLowerCase() === 'completada' ? 'Completada' : sale.estado;
                return <tr key={sale.id} className="hover:bg-gray-50/70">
                  <td className="px-5 py-3.5"><span className="font-semibold text-slate-800">#{sale.numero_ticket}</span><span className="mt-0.5 block font-mono text-[10px] text-slate-400">{sale.id.slice(0, 8)}</span></td>
                  <td className="px-5 py-3.5 text-slate-600">{localDate(sale.fecha_venta)}</td>
                  <td className="px-5 py-3.5 text-slate-700">{sale.cliente_nombre}</td>
                  <td className="px-5 py-3.5 capitalize text-slate-600">{sale.metodo_pago}</td>
                  <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${annulled ? 'bg-rose-50 text-rose-700' : creditPending ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{stateLabel}</span></td>
                  {view === 'credits' && <td className="px-5 py-3.5 text-right font-bold text-amber-700">{money(sale.saldo_pendiente)}</td>}
                  <td className={`px-5 py-3.5 text-right font-semibold ${annulled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{money(sale.total)}</td>
                  <td className="px-5 py-3.5"><div className="flex justify-end gap-1">
                    <button type="button" title="Ver detalle" aria-label={`Ver detalle de venta ${sale.numero_ticket}`} onClick={() => showDetails(sale.id)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Eye size={16} /></button>
                    <button type="button" title="Reimprimir ticket" aria-label={`Reimprimir ticket ${sale.numero_ticket}`} onClick={() => showDetails(sale.id, true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Printer size={16} /></button>
                    {creditPending && <button type="button" title="Registrar pago" aria-label={`Registrar pago de venta ${sale.numero_ticket}`} onClick={() => openCredit(sale.id)} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><Banknote size={16} /></button>}
                    {canManage && !annulled && <>
                      <button type="button" title="Editar venta" aria-label={`Editar venta ${sale.numero_ticket}`} onClick={() => startEdit(sale.id)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Pencil size={16} /></button>
                      <button type="button" title="Anular venta y devolver stock" aria-label={`Anular venta ${sale.numero_ticket}`} disabled={actionBusy === sale.id} onClick={() => cancelSale(sale)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={16} /></button>
                    </>}
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>
      <DetailModal detail={detail} loading={detailLoading} onClose={() => { setDetail(null); setDetailLoading(false); }} onPrint={(id) => showDetails(id, true)} />
      <EditSaleModal sale={editing} products={products || []} busy={editBusy} onClose={() => setEditing(null)} onSave={saveEdit} onChange={changeEditor} />
      {ticket && <TicketImpresion detail={ticket} isReprint onClose={() => setTicket(null)} />}
      {(creditDetail || creditLoading) && <CreditPaymentsModal key={creditDetail?.venta.id || 'loading'} detail={creditDetail} loading={creditLoading} saving={paymentSaving} onClose={() => { setCreditDetail(null); setCreditLoading(false); }} onSave={savePayment} />}
    </div>
  );
}
