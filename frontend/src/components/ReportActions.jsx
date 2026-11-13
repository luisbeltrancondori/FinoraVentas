import { useEffect, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import ReportHeader from './ReportHeader.jsx';
import { exportToExcel } from '../utils/exportToExcel.js';

export default function ReportActions({
  title,
  business,
  rows,
  columns,
  fileName,
  sheetName = 'Reporte',
  orientation = 'landscape',
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const printColumns = columns.filter((column) => column.print !== false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportRows = safeRows.map((row) => Object.fromEntries(
    columns.map((column) => [column.label, column.value(row)]),
  ));

  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      await exportToExcel(exportRows, fileName, sheetName, { business, title });
    } catch (error) {
      setExportError(`No se pudo exportar el archivo Excel: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!printing) return undefined;
    const root = document.documentElement;
    let finished = false;
    const finishPrinting = () => {
      if (finished) return;
      finished = true;
      root.classList.remove('report-printing');
      setPrinting(false);
    };
    root.classList.add('report-printing');
    window.addEventListener('afterprint', finishPrinting, { once: true });
    window.print();
    const timeoutId = window.setTimeout(finishPrinting, 1000);
    return () => {
      window.removeEventListener('afterprint', finishPrinting);
      window.clearTimeout(timeoutId);
      root.classList.remove('report-printing');
    };
  }, [printing]);

  return <>
    <div className="report-actions flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleExport} disabled={!safeRows.length || exporting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><FileSpreadsheet size={15} /> {exporting ? 'Generando Excel…' : 'Exportar a Excel'}</button>
      <button type="button" onClick={() => setPrinting(true)} disabled={!safeRows.length || printing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><Printer size={15} /> Imprimir Reporte</button>
    </div>
    {exportError && <p role="alert" className="mt-1 text-xs text-rose-600">{exportError}</p>}
    <div id="print-area" className="pos-print-report hidden">
      <ReportHeader business={business} title={title} />
      <table>
        <thead><tr>{printColumns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
        <tbody>{safeRows.map((row, index) => <tr key={row.id || row.producto_id || index}>{printColumns.map((column) => <td key={column.label}>{column.value(row) ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {printing && <style>{`
      @media print {
        @page { size: A4 ${orientation}; margin: 15mm 10mm; }
        html.report-printing body * { visibility: hidden !important; }
        html.report-printing .pos-print-report, html.report-printing .pos-print-report * { visibility: visible !important; }
        html.report-printing #print-area { display: block !important; position: absolute !important; inset: 0 !important; width: 100% !important; max-width: 100% !important; color: #111827 !important; background: white !important; font: 9pt Arial, sans-serif !important; }
        html.report-printing .pos-print-report .report-header { display: block !important; margin-bottom: 14px; border-bottom: 2px solid #111827; padding-bottom: 8px; }
        html.report-printing .pos-print-report .report-header h1 { margin: 0 0 4px; font-size: 18pt; }
        html.report-printing .pos-print-report .report-header h2 { margin: 10px 0 4px; font-size: 13pt; }
        html.report-printing .pos-print-report .report-header p { margin: 2px 0; font-size: 8pt; }
        html.report-printing #print-area table { width: 100% !important; max-width: 100% !important; border-collapse: collapse !important; font-size: 12px !important; }
        html.report-printing .pos-print-report th, html.report-printing .pos-print-report td { border: 1px solid #94a3b8 !important; padding: 5px !important; text-align: left !important; }
        html.report-printing .pos-print-report th { background: #e2e8f0 !important; font-weight: 700 !important; }
        html.report-printing .pos-print-report thead { display: table-header-group !important; }
        html.report-printing .pos-print-report tr { break-inside: avoid !important; }
      }
    `}</style>}
  </>;
}
