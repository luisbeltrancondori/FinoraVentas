import { useEffect, useMemo, useState } from 'react';
import {
  Banknote, FileBarChart, FileSpreadsheet, PackageSearch, Printer,
  ShoppingBasket, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { api } from '../api.js';
import ReportHeader from './ReportHeader.jsx';
import { exportToExcel } from '../utils/exportToExcel.js';

const money = (value) => new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('es-BO', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—';

const today = new Date();
const dateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const initialDates = { desde: dateInputValue(monthStart), hasta: dateInputValue(today) };

const reports = [
  {
    id: 'utilidades',
    title: 'Reporte de Utilidades',
    description: 'Ventas totales, costos y ganancia neta agrupados por día.',
    endpoint: '/api/reportes/utilidades',
    icon: TrendingUp,
    dateRange: true,
    sheet: 'Utilidades',
    orientation: 'portrait',
    columns: [
      { key: 'fecha', label: 'Fecha', format: formatDate },
      { key: 'cantidad_ventas', label: 'Ventas' },
      { key: 'ventas_totales', label: 'Ventas totales', format: money },
      { key: 'costos', label: 'Costos', format: money },
      { key: 'ganancia_neta', label: 'Ganancia neta', format: money },
    ],
  },
  {
    id: 'cuentas-por-cobrar',
    title: 'Cuentas por Cobrar',
    description: 'Clientes con créditos pendientes y saldo por cobrar.',
    endpoint: '/api/reportes/cuentas-por-cobrar',
    icon: Users,
    dateRange: true,
    sheet: 'Cuentas por cobrar',
    orientation: 'portrait',
    columns: [
      { key: 'cliente', label: 'Cliente' },
      { key: 'contacto', label: 'Contacto' },
      { key: 'ventas_pendientes', label: 'Ventas pendientes' },
      { key: 'total_credito', label: 'Total crédito', format: money },
      { key: 'saldo_pendiente', label: 'Saldo pendiente', format: money },
      { key: 'venta_mas_antigua', label: 'Venta más antigua', format: formatDate },
    ],
  },
  {
    id: 'cuentas-por-pagar',
    title: 'Cuentas por Pagar',
    description: 'Proveedores con compras a crédito y saldos pendientes.',
    endpoint: '/api/reportes/cuentas-por-pagar',
    icon: Banknote,
    dateRange: true,
    sheet: 'Cuentas por pagar',
    orientation: 'portrait',
    columns: [
      { key: 'proveedor', label: 'Proveedor' },
      { key: 'nit_ci', label: 'NIT / CI' },
      { key: 'compras_pendientes', label: 'Compras pendientes' },
      { key: 'total_compras', label: 'Total compras', format: money },
      { key: 'saldo_pendiente', label: 'Saldo pendiente', format: money },
      { key: 'compra_mas_antigua', label: 'Compra más antigua', format: formatDate },
    ],
  },
  {
    id: 'cierre-caja',
    title: 'Cierre de Caja (Turnos)',
    description: 'Ingresos desglosados por método de pago en cada turno.',
    endpoint: '/api/reportes/cierre-caja',
    icon: Wallet,
    dateRange: true,
    sheet: 'Cierre de caja',
    orientation: 'portrait',
    columns: [
      { key: 'usuario', label: 'Usuario' },
      { key: 'fecha_apertura', label: 'Apertura', format: formatDate },
      { key: 'fecha_cierre', label: 'Cierre', format: formatDate },
      { key: 'estado', label: 'Estado' },
      { key: 'monto_inicial', label: 'Fondo inicial', format: money },
      { key: 'metodo_pago', label: 'Método de pago' },
      { key: 'total_recaudado', label: 'Total recaudado', format: money },
      { key: 'saldo_final', label: 'Saldo final contado', format: money },
    ],
  },
  {
    id: 'productos-inmovidos',
    title: 'Productos Inmovilizados',
    description: 'Productos activos sin ventas en los últimos 30 días.',
    endpoint: '/api/reportes/productos-inmovidos',
    icon: PackageSearch,
    dateRange: false,
    sheet: 'Productos inmovilizados',
    orientation: 'portrait',
    columns: [
      { key: 'codigo_barras', label: 'Código' },
      { key: 'producto', label: 'Producto' },
      { key: 'stock_actual', label: 'Stock' },
      { key: 'costo_unitario', label: 'Costo unitario', format: money },
      { key: 'valor_inmovilizado', label: 'Valor inmovilizado', format: money },
      { key: 'ultima_venta', label: 'Última venta', format: formatDate },
    ],
  },
  {
    id: 'compras-proveedor',
    title: 'Compras por Proveedor',
    description: 'Totales y descuentos de compras agrupados por proveedor.',
    endpoint: '/api/reportes/compras-proveedor',
    icon: ShoppingBasket,
    dateRange: true,
    sheet: 'Compras por proveedor',
    orientation: 'portrait',
    columns: [
      { key: 'proveedor', label: 'Proveedor' },
      { key: 'nit_ci', label: 'NIT / CI' },
      { key: 'cantidad_compras', label: 'Compras' },
      { key: 'subtotal', label: 'Subtotal', format: money },
      { key: 'descuentos', label: 'Descuentos', format: money },
      { key: 'total_compras', label: 'Total compras', format: money },
    ],
  },
];

function ReportCard({ report, selected, onSelect }) {
  const Icon = report.icon;
  return (
    <article className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm transition dark:bg-slate-900 ${selected ? 'border-emerald-500 ring-2 ring-emerald-500/10 dark:border-emerald-500' : 'border-gray-100 hover:border-emerald-200 dark:border-slate-800'}`}>
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><Icon size={19} /></span>
      <h2 className="mt-4 text-sm font-bold text-slate-900 dark:text-slate-100">{report.title}</h2>
      <p className="mt-1 flex-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{report.description}</p>
      <button type="button" onClick={() => onSelect(report)} className="mt-5 inline-flex min-h-9 items-center justify-center gap-2 self-start rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700">
        <FileBarChart size={15} /> Generar
      </button>
    </article>
  );
}

export default function ReportsPage({ negocioId, business }) {
  const [selected, setSelected] = useState(null);
  const [dates, setDates] = useState(initialDates);
  const [rows, setRows] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const exportRows = useMemo(() => {
    if (!selected) return [];
    return rows.map((row) => Object.fromEntries(
      selected.columns.map((column) => [column.label, column.format ? column.format(row[column.key]) : row[column.key] ?? '—']),
    ));
  }, [rows, selected]);

  useEffect(() => {
    if (!printing) return undefined;
    const root = document.documentElement;
    let finished = false;
    const finishPrinting = () => {
      if (finished) return;
      finished = true;
      root.classList.remove('reports-printing');
      setPrinting(false);
    };
    root.classList.add('reports-printing');
    window.addEventListener('afterprint', finishPrinting, { once: true });
    window.print();
    const timeoutId = window.setTimeout(finishPrinting, 1500);
    return () => {
      window.removeEventListener('afterprint', finishPrinting);
      window.clearTimeout(timeoutId);
      root.classList.remove('reports-printing');
    };
  }, [printing]);

  async function generateReport(event) {
    event.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError('');
    setHasGenerated(false);
    try {
      const query = selected.dateRange
        ? `?desde=${encodeURIComponent(dates.desde)}&hasta=${encodeURIComponent(dates.hasta)}`
        : '';
      const result = await api(`${selected.endpoint}${query}`, { negocioId });
      if (!Array.isArray(result)) throw new Error('El servidor devolvió un formato de reporte inválido.');
      setRows(result);
      setHasGenerated(true);
    } catch (requestError) {
      setRows([]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportReport() {
    if (!selected || !exportRows.length) return;
    setExporting(true);
    setError('');
    try {
      await exportToExcel(exportRows, selected.id, selected.sheet, {
        business,
        title: selected.title,
      });
    } catch (exportError) {
      setError(`No se pudo exportar a Excel: ${exportError.message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Análisis del negocio</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Reportes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Genera, filtra y exporta reportes detallados de tu operación.</p>
      </header>

      <section aria-label="Reportes disponibles" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => <ReportCard key={report.id} report={report} selected={selected?.id === report.id} onSelect={(next) => {
          setSelected(next);
          setRows([]);
          setHasGenerated(false);
          setError('');
        }} />)}
      </section>

      {selected && (
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center">
            <div><h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{selected.title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selected.description}</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportReport} disabled={!hasGenerated || !rows.length || exporting} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><FileSpreadsheet size={15} />{exporting ? 'Exportando…' : 'Exportar a Excel'}</button>
              <button type="button" onClick={() => setPrinting(true)} disabled={!hasGenerated || !rows.length || printing} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Printer size={15} />Imprimir Reporte</button>
            </div>
          </div>

          <form onSubmit={generateReport} className="report-filters flex flex-col gap-3 border-b border-gray-100 p-5 dark:border-slate-800 sm:flex-row sm:items-end">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Desde<input type="date" value={dates.desde} disabled={!selected.dateRange} onChange={(event) => setDates((current) => ({ ...current, desde: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-44" /></label>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Hasta<input type="date" value={dates.hasta} disabled={!selected.dateRange} onChange={(event) => setDates((current) => ({ ...current, hasta: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-44" /></label>
            {!selected.dateRange && <p className="pb-2 text-[11px] text-slate-400">Este reporte considera los últimos 30 días.</p>}
            <button type="submit" disabled={loading || (selected.dateRange && (!dates.desde || !dates.hasta || dates.desde > dates.hasta))} className="min-h-10 rounded-lg bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600">{loading ? 'Generando…' : 'Generar reporte'}</button>
          </form>

          {error && <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
          {hasGenerated && !error && (
            <div className="overflow-x-auto p-5">
              {!rows.length ? <p className="py-12 text-center text-sm text-slate-400">No hay resultados para los filtros seleccionados.</p> : (
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>{selected.columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {rows.map((row, index) => <tr key={`${selected.id}-${index}`} className="text-slate-600 dark:text-slate-300">
                      {selected.columns.map((column) => <td key={column.key} className="whitespace-nowrap px-4 py-3">{column.format ? column.format(row[column.key]) : row[column.key] ?? '—'}</td>)}
                    </tr>)}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {hasGenerated && rows.length > 0 && (
            <div id="print-area" className="reports-print-area hidden">
              <ReportHeader business={business} title={selected.title} />
              <table>
                <thead><tr>{selected.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
                <tbody>{rows.map((row, index) => <tr key={`${selected.id}-print-${index}`}>
                  {selected.columns.map((column) => <td key={column.key}>{column.format ? column.format(row[column.key]) : row[column.key] ?? '—'}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          )}
          {printing && <style>{`
            @media print {
              @page { size: letter portrait; margin: 15mm 10mm; }
              html.reports-printing body * { visibility: hidden !important; }
              html.reports-printing .reports-print-area,
              html.reports-printing .reports-print-area * { visibility: visible !important; }
              html.reports-printing #print-area { display: block !important; position: absolute !important; inset: 0 !important; width: 100% !important; max-width: 100% !important; color: #111827 !important; background: #fff !important; font: 9pt Arial, sans-serif !important; }
              html.reports-printing .reports-print-area .report-header { display: block !important; margin-bottom: 14px; border-bottom: 2px solid #111827; padding-bottom: 8px; }
              html.reports-printing .reports-print-area .report-header h1 { margin: 0 0 4px; font-size: 18pt; }
              html.reports-printing .reports-print-area .report-header h2 { margin: 10px 0 4px; font-size: 13pt; }
              html.reports-printing .reports-print-area .report-header p { margin: 2px 0; font-size: 8pt; }
              html.reports-printing #print-area table { width: 100% !important; max-width: 100% !important; border-collapse: collapse !important; font-size: 12px !important; }
              html.reports-printing .reports-print-area th, html.reports-printing .reports-print-area td { border: 1px solid #94a3b8 !important; padding: 5px !important; text-align: left !important; }
              html.reports-printing .reports-print-area th { background: #e2e8f0 !important; font-weight: 700 !important; }
              html.reports-printing .reports-print-area thead { display: table-header-group !important; }
              html.reports-printing .reports-print-area tr { break-inside: avoid !important; }
            }
          `}</style>}
        </section>
      )}
    </div>
  );
}
