import { useCallback, useEffect, useState } from 'react';
import {
  Banknote, CheckCircle2, ClipboardList, CreditCard, QrCode,
  ReceiptText, RefreshCw, X,
} from 'lucide-react';
import { api } from '../api.js';
import Spinner from './Spinner.jsx';
import TicketImpresion from './TicketImpresion.jsx';

const money = (value) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0);
const localDate = (value) => new Date(value).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
const paymentMethods = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'qr', label: 'QR / Transferencia', icon: QrCode },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'mixto', label: 'Pago mixto', icon: ReceiptText },
  { id: 'credito', label: 'Crédito', icon: CreditCard },
];

export default function ProformasPage({
  negocioId, business, cashier, canManage, onSaleRefresh, notify,
}) {
  const [proformas, setProformas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedProforma, setSelectedProforma] = useState(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedQr, setMixedQr] = useState('');
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [ticket, setTicket] = useState(null);

  const loadProformas = useCallback(async (signal) => {
    setLoading(true);
    try {
      setProformas(await api('/api/proformas-web', { negocioId, signal }));
    } catch (error) {
      if (!signal?.aborted) notify(error.message, 'error');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [negocioId, notify]);

  useEffect(() => {
    const controller = new AbortController();
    loadProformas(controller.signal);
    return () => controller.abort();
  }, [loadProformas]);

  useEffect(() => {
    if (!selectedProforma || metodoPago !== 'credito' || clients.length) return undefined;
    const controller = new AbortController();
    setClientsLoading(true);
    api('/api/clientes?limit=1000', { negocioId, signal: controller.signal })
      .then(setClients)
      .catch((error) => {
        if (!controller.signal.aborted) notify(error.message, 'error');
      })
      .finally(() => {
        if (!controller.signal.aborted) setClientsLoading(false);
      });
    return () => controller.abort();
  }, [clients.length, metodoPago, negocioId, notify, selectedProforma]);

  function startSale(proforma) {
    setSelectedProforma(proforma);
    setClienteNombre(
      proforma.cliente_nombre && proforma.cliente_nombre !== 'Cliente Web'
        ? proforma.cliente_nombre
        : 'Cliente General',
    );
    setClienteId('');
    setMetodoPago('');
    setCashReceived(String(Number(proforma.total) || 0));
    setMixedCash('');
    setMixedQr('');
  }

  async function confirmSale(event) {
    event.preventDefault();
    if (!selectedProforma || processingId !== null) return;
    const total = Number(selectedProforma.total);
    const cashAmount = Number(cashReceived) || 0;
    const mixedCashAmount = Number(mixedCash) || 0;
    const mixedQrAmount = Number(mixedQr) || 0;
    const selectedClient = clients.find((client) => String(client.id) === clienteId);

    if (!clienteNombre.trim()) {
      notify('Ingresa el nombre del cliente.', 'error');
      return;
    }
    if (!metodoPago) {
      notify('Selecciona el método de pago antes de confirmar la venta.', 'error');
      return;
    }
    if (metodoPago === 'efectivo' && cashAmount < total) {
      notify('El efectivo recibido debe cubrir el total del pedido.', 'error');
      return;
    }
    if (metodoPago === 'mixto') {
      const paid = Math.round((mixedCashAmount + mixedQrAmount) * 100) / 100;
      if (mixedCashAmount <= 0 || mixedQrAmount <= 0 || paid !== total) {
        notify('El pago mixto requiere efectivo y QR, y ambos deben sumar el total exacto.', 'error');
        return;
      }
    }
    if (metodoPago === 'credito') {
      if (!selectedClient) {
        notify('Selecciona un cliente registrado para vender a crédito.', 'error');
        return;
      }
      if (!(selectedClient.telefono || selectedClient.nit_ci || selectedProforma.telefono)) {
        notify('El cliente de la venta a crédito debe tener teléfono o NIT/CI registrado.', 'error');
        return;
      }
    }

    setProcessingId(selectedProforma.id);
    try {
      const result = await api(`/api/proformas-web/${selectedProforma.id}/convertir-venta`, {
        method: 'POST',
        negocioId,
        body: JSON.stringify({
          cliente_nombre: clienteNombre.trim(),
          cliente_id: clienteId || undefined,
          cliente_contacto: selectedClient?.telefono || selectedClient?.nit_ci || selectedProforma.telefono || undefined,
          metodo_pago: metodoPago,
          monto_efectivo: metodoPago === 'efectivo'
            ? cashAmount
            : metodoPago === 'mixto' ? mixedCashAmount : 0,
          monto_qr: metodoPago === 'mixto' ? mixedQrAmount : undefined,
        }),
      });
      setTicket({
        venta: {
          ...result.venta,
          cajero_nombre: result.venta.cajero_nombre || cashier,
          negocio_nombre: result.venta.negocio_nombre || business?.nombre,
          negocio_nit: result.venta.negocio_nit || business?.nit,
          negocio_direccion: result.venta.negocio_direccion || business?.direccion,
          negocio_telefono: result.venta.negocio_telefono || business?.telefono,
          monto_recibido: result.venta.monto_recibido ?? result.venta.monto_efectivo,
        },
        detalles: result.detalles,
        pagos: result.pagos || [],
      });
      setSelectedProforma(null);
      notify(`Pedido convertido en venta #${result.venta.numero_ticket}.`);
      await loadProformas();
      try {
        await onSaleRefresh();
      } catch (error) {
        notify(`La venta se registró, pero no se pudo actualizar el panel: ${error.message}`, 'error');
      }
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setProcessingId(null);
    }
  }

  const selectedClient = clients.find((client) => String(client.id) === clienteId);
  const total = Number(selectedProforma?.total) || 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Tienda pública</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Pedidos web pendientes</h1>
          <p className="mt-1 text-sm text-slate-500">Revisa los pedidos, selecciona el cobro y registra la venta.</p>
        </div>
        <button type="button" onClick={() => loadProformas()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {loading && !proformas.length ? <Spinner label="Cargando pedidos web…" /> : proformas.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <ClipboardList size={32} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No hay pedidos pendientes</p>
            <p className="mt-1 text-xs text-slate-400">Los pedidos enviados desde la tienda aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Productos</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proformas.map((proforma) => (
                  <tr key={proforma.id} className="align-top">
                    <td className="px-4 py-4 font-semibold text-slate-700">#{proforma.id}</td>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-800">{proforma.cliente_nombre}</p><p className="mt-1 text-xs text-slate-400">{proforma.telefono || 'Sin teléfono'}</p></td>
                    <td className="max-w-sm px-4 py-4 text-xs leading-5 text-slate-600">
                      {(Array.isArray(proforma.items) ? proforma.items : []).map((item) => (
                        <p key={item.producto_id}>{item.nombre} × {item.cantidad} <span className="text-slate-400">· {money(item.subtotal)}</span></p>
                      ))}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900">{money(proforma.total)}</td>
                    <td className="px-4 py-4 text-xs text-slate-500">{localDate(proforma.created_at)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => startSale(proforma)}
                        disabled={!canManage || processingId !== null}
                        title={!canManage ? 'No tienes permiso para registrar ventas' : undefined}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} /> Vender
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedProforma && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
        <form onSubmit={confirmSale} className="my-auto w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Confirmar pedido #{selectedProforma.id}</p><h2 className="mt-1 text-lg font-bold text-slate-900">Registrar venta e imprimir</h2></div>
            <button type="button" onClick={() => setSelectedProforma(null)} aria-label="Cerrar confirmación" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
          </header>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Total del pedido: <strong className="text-slate-900">{money(total)}</strong></p>

          <label className="block text-xs font-semibold text-slate-600">Nombre del cliente
            <input required maxLength="150" value={clienteNombre} onChange={(event) => setClienteNombre(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-600">Método de pago</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {paymentMethods.map((method) => (
                <button key={method.id} type="button" aria-pressed={metodoPago === method.id} onClick={() => setMetodoPago(method.id)}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[10px] font-bold ${metodoPago === method.id ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <method.icon aria-hidden="true" size={16} />{method.label}
                </button>
              ))}
            </div>
          </fieldset>

          {metodoPago === 'efectivo' && <label className="block text-xs font-semibold text-slate-600">Efectivo recibido
            <input required type="number" min={total} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>}

          {metodoPago === 'mixto' && <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600">Monto efectivo
              <input required type="number" min="0.01" step="0.01" value={mixedCash} onChange={(event) => setMixedCash(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="text-xs font-semibold text-slate-600">Monto QR
              <input required type="number" min="0.01" step="0.01" value={mixedQr} onChange={(event) => setMixedQr(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <p className="col-span-2 text-xs text-slate-500">Pagado: {money((Number(mixedCash) || 0) + (Number(mixedQr) || 0))} · Total: {money(total)}</p>
          </div>}

          {metodoPago === 'credito' && <div>
            <label className="block text-xs font-semibold text-slate-600">Cliente registrado
              <select required value={clienteId} onChange={(event) => {
                const nextId = event.target.value;
                setClienteId(nextId);
                const selected = clients.find((client) => String(client.id) === nextId);
                if (selected) setClienteNombre(selected.nombre_completo || selected.nombre || '');
              }} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                <option value="">{clientsLoading ? 'Cargando clientes…' : 'Selecciona un cliente'}</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.nombre_completo}{client.telefono ? ` · ${client.telefono}` : ''}</option>)}
              </select>
            </label>
            {selectedClient && !(selectedClient.telefono || selectedClient.nit_ci || selectedProforma.telefono) && <p className="mt-1 text-xs text-rose-600">El cliente necesita teléfono o NIT/CI para registrar crédito.</p>}
          </div>}

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setSelectedProforma(null)} disabled={processingId !== null} className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={!canManage || processingId !== null || clientsLoading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCircle2 size={15} /> {processingId !== null ? 'Procesando venta…' : 'Confirmar Venta e Imprimir'}
            </button>
          </footer>
        </form>
      </div>}

      {ticket && <TicketImpresion detail={ticket} business={business} onClose={() => setTicket(null)} />}
    </div>
  );
}
