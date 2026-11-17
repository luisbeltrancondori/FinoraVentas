import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardCopy, Printer, RefreshCw, ShoppingCart } from 'lucide-react';
import { api } from '../api.js';
import Spinner from './Spinner.jsx';

const number = (value, digits = 1) => new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(Number(value) || 0);

const money = (value) => `Bs ${new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0)}`;

const inputClass = 'min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

function daysUntilNextSaturday() {
  const today = new Date().getDay();
  return ((6 - today + 7) % 7) || 7;
}

export default function PurchaseSuggestionsPage({ negocioId, business, user, canManage, onGeneratePurchase, notify }) {
  const [daysCoverage, setDaysCoverage] = useState(7);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api(`/api/compras/sugerido?sucursal_id=${encodeURIComponent(negocioId)}&dias_cobertura=${daysCoverage}`, { negocioId })
      .then((result) => {
        if (!active) return;
        const rows = result.sugerencias || [];
        setSuggestions(rows);
        setSelected(Object.fromEntries(rows.map((item) => [item.producto_id, true])));
        setQuantities(Object.fromEntries(rows.map((item) => [item.producto_id, String(item.cantidad_sugerida)])));
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [daysCoverage, negocioId, refreshKey]);

  const suppliers = useMemo(() => {
    const unique = new Map();
    suggestions.forEach((item) => {
      const id = item.proveedor_id || '';
      if (!unique.has(id)) unique.set(id, item.proveedor_nombre || 'Sin proveedor');
    });
    return [...unique.entries()].sort((first, second) => first[1].localeCompare(second[1], 'es'));
  }, [suggestions]);
  const visibleSuggestions = useMemo(
    () => suggestions.filter((item) => !supplierFilter || (item.proveedor_id || '') === supplierFilter),
    [suggestions, supplierFilter],
  );
  const selectedRows = suggestions.filter((item) => selected[item.producto_id]);
  const visibleSelectedRows = visibleSuggestions.filter((item) => selected[item.producto_id]);

  function setVisibleSelected(checked) {
    setSelected((current) => ({
      ...current,
      ...Object.fromEntries(visibleSuggestions.map((item) => [item.producto_id, checked])),
    }));
  }

  function generatePurchase() {
    if (!visibleSelectedRows.length) {
      notify('Selecciona al menos un producto para generar la compra.', 'error');
      return;
    }
    const supplierIds = new Set(visibleSelectedRows.map((item) => item.proveedor_id || ''));
    if (supplierIds.size > 1) {
      notify('Filtra por un proveedor para generar una compra con sus productos.', 'error');
      return;
    }
    const items = visibleSelectedRows.map((item) => ({
      producto_id: item.producto_id,
      nombre: item.producto_nombre,
      cantidad: Number(quantities[item.producto_id]),
      costo_unitario: Number(item.costo_unitario) || 0,
      fecha_vencimiento: item.fecha_vencimiento || null,
    }));
    if (items.some((item) => !Number.isFinite(item.cantidad) || item.cantidad <= 0)) {
      notify('Las cantidades seleccionadas deben ser mayores a cero.', 'error');
      return;
    }
    onGeneratePurchase({
      supplier: visibleSelectedRows[0].proveedor_id ? {
        id: visibleSelectedRows[0].proveedor_id,
        nombre_empresa: visibleSelectedRows[0].proveedor_nombre,
      } : null,
      items,
    });
  }

  async function copyWhatsAppList() {
    if (!visibleSuggestions.length) {
      notify('No hay productos para copiar con este filtro.', 'error');
      return;
    }
    const groups = new Map();
    visibleSuggestions.forEach((item) => {
      const supplierName = item.proveedor_nombre || 'Sin proveedor';
      if (!groups.has(supplierName)) groups.set(supplierName, []);
      groups.get(supplierName).push(item);
    });
    const lines = [`Pedido de reposición · cobertura ${daysCoverage} días`];
    groups.forEach((items, supplierName) => {
      lines.push('', `Proveedor: ${supplierName}`);
      items.forEach((item) => {
        lines.push(`• ${quantities[item.producto_id] || 0} × ${item.producto_nombre} (stock: ${number(item.stock_actual)})`);
      });
    });
    try {
      if (!navigator.clipboard?.writeText) throw new Error('El navegador no permite copiar al portapapeles.');
      await navigator.clipboard.writeText(lines.join('\n'));
      notify('Lista copiada. Ya puedes pegarla en WhatsApp.');
    } catch (copyError) {
      notify(copyError.message || 'No se pudo copiar la lista.', 'error');
    }
  }

  const allVisibleSelected = visibleSuggestions.length > 0
    && visibleSuggestions.every((item) => selected[item.producto_id]);
  const supplierFilterName = suppliers.find(([id]) => id === supplierFilter)?.[1] || 'Todos los proveedores';
  const printDate = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
  const totalUnitsToBuy = visibleSelectedRows.reduce((total, item) => total + (Number(quantities[item.producto_id]) || 0), 0);
  const selectedBudget = selectedRows.reduce((total, item) => (
    total + (Number(quantities[item.producto_id]) || 0) * (Number(item.costo_unitario) || 0)
  ), 0);
  const printBudget = visibleSelectedRows.reduce((total, item) => (
    total + (Number(quantities[item.producto_id]) || 0) * (Number(item.costo_unitario) || 0)
  ), 0);

  return (
    <div className="purchase-suggestions-root space-y-5">
      <style>{`
        @media print {
          @page { size: letter; margin: 15mm; }
          body * { visibility: hidden !important; }
          .purchase-suggestions-print,
          .purchase-suggestions-print * { visibility: visible !important; }
          .purchase-suggestions-root > :not(.purchase-suggestions-print):not(style) {
            display: none !important;
          }
          .purchase-suggestions-print {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            color: #111827 !important;
            background: #fff !important;
            font-family: Arial, sans-serif !important;
          }
          .purchase-suggestions-print .print-header {
            display: flex !important;
            visibility: visible !important;
          }
          .purchase-suggestions-print .print-header > * {
            visibility: visible !important;
          }
          .purchase-suggestions-print .print-header h1,
          .purchase-suggestions-print .print-header p {
            display: block !important;
            visibility: visible !important;
          }
          .purchase-suggestions-print .print-header-divider {
            display: block !important;
            visibility: visible !important;
            border: 0 !important;
            border-top: 1px solid #9ca3af !important;
            margin: 16px 0 !important;
          }
          .purchase-suggestions-print table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10pt !important;
          }
          .purchase-suggestions-print th,
          .purchase-suggestions-print td {
            border: 1px solid #9ca3af !important;
            padding: 8px 7px !important;
            color: #111827 !important;
            text-align: left !important;
          }
          .purchase-suggestions-print th {
            background: #f3f4f6 !important;
            font-weight: 700 !important;
          }
          .purchase-suggestions-print tr { break-inside: avoid; }
          .purchase-suggestions-print .print-checkbox {
            display: inline-block;
            width: 13px;
            height: 13px;
            border: 1px solid #111827;
            vertical-align: middle;
          }
          .purchase-suggestions-print .print-metadata {
            min-width: 230px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            padding: 10px 12px;
          }
          .purchase-suggestions-print .print-footer {
            margin-top: 24px;
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Abastecimiento</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Sugerido de compras</h1>
          <p className="mt-1 text-sm text-slate-500">Reposición calculada según el stock mínimo y el consumo de los últimos 30 días.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} disabled={!visibleSelectedRows.length} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Printer size={15} /> Imprimir lista
          </button>
          <button type="button" onClick={copyWhatsAppList} disabled={!visibleSuggestions.length} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <ClipboardCopy size={15} /> Copiar lista para WhatsApp
          </button>
          <button type="button" onClick={generatePurchase} disabled={!canManage || !visibleSelectedRows.length} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            <ShoppingCart size={15} /> Generar orden / Pasar a nueva compra
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="block text-xs font-semibold text-slate-600">
          Días a cubrir hasta próxima compra
          <input type="number" min="1" max="365" step="1" value={daysCoverage} onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isInteger(value) && value >= 1 && value <= 365) setDaysCoverage(value);
          }} className={`${inputClass} mt-1 block w-full sm:w-40`} />
        </label>
        <button type="button" onClick={() => setDaysCoverage(daysUntilNextSaturday())} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <CalendarDays size={15} /> Hasta el próximo sábado
        </button>
        <label className="block text-xs font-semibold text-slate-600 sm:ml-auto">
          Proveedor
          <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className={`${inputClass} mt-1 block w-full sm:min-w-56`}>
            <option value="">Todos los proveedores</option>
            {suppliers.map(([id, name]) => <option key={id || 'none'} value={id}>{name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setRefreshKey((current) => current + 1)} aria-label="Actualizar sugerencias" className="grid min-h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          <RefreshCw size={15} />
        </button>
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div><h2 className="text-sm font-bold text-slate-900">Productos para reponer</h2>          <p className="mt-1 text-xs text-slate-500">{visibleSuggestions.length} productos visibles · {selectedRows.length} seleccionados</p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">Cobertura: {daysCoverage} días</span>
        </div>
        {loading ? <Spinner label="Calculando sugerencias…" /> : error ? null : !visibleSuggestions.length ? (
          <p className="px-5 py-14 text-center text-sm text-slate-400">No hay productos que requieran reposición para este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-3"><input type="checkbox" aria-label="Seleccionar todos los productos visibles" checked={allVisibleSelected} onChange={(event) => setVisibleSelected(event.target.checked)} /></th>
                  <th className="px-3 py-3 font-semibold">Producto</th>
                  <th className="px-3 py-3 font-semibold">Proveedor</th>
                  <th className="px-3 py-3 text-right font-semibold">Stock actual</th>
                  <th className="px-3 py-3 text-right font-semibold">Consumo diario prom.</th>
                  <th className="px-3 py-3 font-semibold">Alcanza para</th>
                  <th className="px-3 py-3 text-right font-semibold">Cantidad sugerida a comprar</th>
                  <th className="px-3 py-3 text-right font-semibold">Costo Unit. (Bs)</th>
                  <th className="px-3 py-3 text-right font-semibold">Subtotal Ref. (Bs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleSuggestions.map((item) => {
                  const daysRemaining = item.dias_restantes == null ? null : Number(item.dias_restantes);
                  const urgent = daysRemaining != null && daysRemaining <= daysCoverage;
                  return (
                    <tr key={item.producto_id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-3"><input type="checkbox" aria-label={`Seleccionar ${item.producto_nombre}`} checked={Boolean(selected[item.producto_id])} onChange={(event) => setSelected((current) => ({ ...current, [item.producto_id]: event.target.checked }))} /></td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{item.producto_nombre}</td>
                      <td className="px-3 py-3 text-slate-600">{item.proveedor_nombre || 'Sin proveedor'}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{number(item.stock_actual)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{number(item.consumo_diario)} unid/día</td>
                      <td className="px-3 py-3">
                        {daysRemaining == null
                          ? <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Sin ventas recientes</span>
                          : <span className={`rounded-full px-2.5 py-1 font-semibold ${urgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{number(daysRemaining)} días{urgent ? ' · ¡Urgente!' : ''}</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input type="number" min="0" step="0.01" aria-label={`Cantidad sugerida para ${item.producto_nombre}`} value={quantities[item.producto_id] ?? ''} onChange={(event) => setQuantities((current) => ({ ...current, [item.producto_id]: event.target.value }))} className="min-h-9 w-28 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-emerald-500" />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">{money(item.costo_unitario)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-800">{money((Number(quantities[item.producto_id]) || 0) * (Number(item.costo_unitario) || 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-label="Presupuesto total estimado" className="flex flex-col justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-bold text-emerald-900">Presupuesto Total Estimado</h2>
          <p className="mt-1 text-xs text-emerald-800">{selectedRows.length} productos seleccionados</p>
        </div>
        <strong className="text-xl font-extrabold text-emerald-800">{money(selectedBudget)}</strong>
      </section>
      {!canManage && <p className="text-xs text-slate-500">Tienes permiso de consulta; solicita permiso de escritura en compras para generar una orden.</p>}
      <section className="purchase-suggestions-print hidden">
        <div className="print-header" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, borderBottom: '3px solid #059669', paddingBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, color: '#047857', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sucursal</p>
            <h2 style={{ margin: '4px 0 0', fontSize: 23, fontWeight: 700 }}>{business?.nombre || 'Finora POS'}</h2>
            {business?.direccion && <p style={{ margin: '7px 0 0', fontSize: 11 }}>{business.direccion}</p>}
            {business?.telefono && <p style={{ margin: '4px 0 0', fontSize: 11 }}>Teléfono: {business.telefono}</p>}
          </div>
          <div className="print-metadata">
            <h1 style={{ margin: 0, color: '#047857', fontSize: 16, fontWeight: 700, letterSpacing: '0.04em' }}>REQUERIMIENTO DE PRODUCTOS</h1>
            <p style={{ margin: '3px 0 9px', fontSize: 10, fontStyle: 'italic' }}>Lista de reposición al mayorista</p>
            <p style={{ margin: '3px 0', fontSize: 10 }}>Fecha y hora: {printDate}</p>
            <p style={{ margin: '3px 0', fontSize: 10 }}>Cobertura: {daysCoverage} días</p>
            <p style={{ margin: '3px 0', fontSize: 10 }}>Emitido por: {user?.nombre || 'Usuario'}</p>
            <p style={{ margin: '3px 0', fontSize: 10 }}>Proveedor: {supplierFilterName}</p>
          </div>
        </div>
        <hr className="print-header-divider my-4 border-gray-400" />
        <table>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>[ ]</th>
              <th>Producto</th>
              <th>Proveedor</th>
              <th>Stock Actual</th>
              <th>Cantidad a Comprar</th>
              <th>Precio Unit.</th>
              <th>Subtotal Ref.</th>
              <th style={{ minWidth: 130 }}>Notas</th>
            </tr>
          </thead>
          <tbody>
            {visibleSelectedRows.map((item) => (
              <tr key={`print-${item.producto_id}`}>
                <td style={{ textAlign: 'center' }}><span className="print-checkbox" /></td>
                <td>{item.producto_nombre}</td>
                <td>{item.proveedor_nombre || 'Sin proveedor'}</td>
                <td>{number(item.stock_actual)}</td>
                <td>{quantities[item.producto_id] || 0}</td>
                <td>{money(item.costo_unitario)}</td>
                <td>{money((Number(quantities[item.producto_id]) || 0) * (Number(item.costo_unitario) || 0))}</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="print-footer">
          <p style={{ margin: 0, borderTop: '2px solid #059669', paddingTop: 10, fontSize: 11, fontWeight: 700 }}>
            Total de ítems a comprar: {number(totalUnitsToBuy)} unidades ({visibleSelectedRows.length} productos)
          </p>
          <p style={{ margin: '10px 0 0', color: '#065f46', fontSize: 14, fontWeight: 800 }}>
            PRESUPUESTO TOTAL ESTIMADO (Bs): {money(printBudget)}
          </p>
          <div style={{ display: 'flex', gap: 24, marginTop: 28, fontSize: 11 }}>
            <div style={{ flex: 1, borderTop: '1px solid #6b7280', paddingTop: 6 }}>Firma al recibir la mercadería</div>
            <div style={{ flex: 2, borderTop: '1px solid #6b7280', paddingTop: 6 }}>Observaciones</div>
          </div>
        </footer>
      </section>
    </div>
  );
}
