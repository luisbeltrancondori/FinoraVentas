import { useState } from 'react';
import { Printer, X } from 'lucide-react';

const money = (value) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0);
const localDate = (value) => new Date(value).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
const paymentNames = {
  efectivo: 'Efectivo',
  qr: 'QR / Transferencia',
  tarjeta: 'Tarjeta',
  mixto: 'Pago mixto',
  credito: 'Crédito',
};

export default function TicketImpresion({ detail, business, onClose, isReprint = false }) {
  const [paper, setPaper] = useState('80');
  if (!detail?.venta) return null;
  const sale = detail.venta;
  const store = business || {
    nombre: sale.negocio_nombre,
    nit: sale.negocio_nit,
    direccion: sale.negocio_direccion,
    telefono: sale.negocio_telefono,
  };
  const rows = detail.detalles || [];
  const cashReceived = Number(sale.monto_recibido || sale.monto_efectivo || 0);
  const change = Math.max(0, cashReceived - Number(sale.total || 0));
  const creditBalance = Number(sale.saldo_pendiente ?? sale.monto_credito ?? (sale.metodo_pago === 'credito' ? sale.total : 0));
  const payments = detail.pagos || detail.historial_pagos || [];

  return (
    <div className="ticket-print-root fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <style>{`
        @page { margin: 4mm; }
        @page thermal58 { size: 58mm auto; margin: 2mm; }
        @page thermal80 { size: 80mm auto; margin: 2mm; }
        @page sheetA4 { size: A4; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          .ticket-print-root, .ticket-print-root * { visibility: visible !important; }
          .ticket-print-root { position: absolute !important; inset: 0 !important; display: block !important; overflow: visible !important; padding: 0 !important; background: white !important; }
          .ticket-print-actions { display: none !important; }
          .ticket-paper { margin: 0 auto !important; border: 0 !important; box-shadow: none !important; }
          .ticket-paper.paper-58 { width: 58mm !important; max-width: 58mm !important; }
          .ticket-paper.paper-80 { width: 80mm !important; max-width: 80mm !important; }
          .ticket-paper.paper-a4 { width: 190mm !important; max-width: 190mm !important; }
          .ticket-paper.paper-58 { page: thermal58; }
          .ticket-paper.paper-80 { page: thermal80; }
          .ticket-paper.paper-a4 { page: sheetA4; }
        }
      `}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="ticket-preview-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="ticket-print-actions flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div><h2 id="ticket-preview-title" className="text-sm font-bold text-slate-900">Vista previa del ticket</h2><p className="text-xs text-slate-500">Venta #{sale.numero_ticket}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar vista previa" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={17} /></button>
        </header>
        <div className="ticket-print-actions flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <label className="text-xs font-semibold text-slate-600">Formato
            <select value={paper} onChange={(event) => setPaper(event.target.value)} className="ml-2 min-h-9 rounded-lg border border-slate-200 bg-white px-2">
              <option value="58">Térmica 58 mm</option><option value="80">Térmica 80 mm</option><option value="a4">Hoja A4</option>
            </select>
          </label>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700"><Printer size={15} /> Imprimir Ticket</button>
        </div>
        <div className="max-h-[70vh] overflow-auto bg-slate-100 p-5 sm:p-8">
          <article className={`ticket-paper paper-${paper} mx-auto w-full max-w-[80mm] border border-slate-200 bg-white p-5 font-mono text-[11px] leading-relaxed text-black shadow-sm`}>
            <div className="text-center">
              <h1 className="text-base font-bold uppercase">{store?.nombre || 'Sucursal'}</h1>
              {store?.nit && <p>NIT: {store.nit}</p>}
              {store?.direccion && <p>{store.direccion}</p>}
              {store?.telefono && <p>Tel: {store.telefono}</p>}
              <p className="my-2 border-t border-dashed border-black pt-2 font-bold">COMPROBANTE DE VENTA</p>
              {isReprint && <p className="mb-2 inline-block border border-black px-2 py-0.5 text-[9px] font-bold tracking-widest">REIMPRESIÓN · COPIA</p>}
            </div>
            <div className="space-y-0.5">
              <p>Comprobante: #{sale.numero_ticket}</p>
              <p>Fecha: {localDate(sale.fecha_venta)}</p>
              <p>Cajero: {sale.cajero_nombre || sale.usuario_nombre || 'No disponible'}</p>
              <p>Cliente: {sale.cliente_nombre || 'Cliente General'}</p>
              {sale.cliente_contacto && <p>Contacto / CI: {sale.cliente_contacto}</p>}
            </div>
            <table className="mt-3 w-full table-fixed border-y border-dashed border-black text-left">
              <thead><tr className="border-b border-dashed border-black"><th className="w-[12%] py-1">Cant.</th><th className="w-[38%] py-1">Descripción</th><th className="w-[24%] py-1 text-right">P. unit.</th><th className="w-[26%] py-1 text-right">Subtotal</th></tr></thead>
              <tbody>{rows.map((item) => (
                <tr key={item.id || `${item.producto_id}-${item.nombre}`}>
                  <td className="py-1 align-top">{item.cantidad}</td>
                  <td className="break-words py-1 align-top">{item.nombre || 'Producto'}{item.codigo_barras ? <span className="block text-[9px]">{item.codigo_barras}</span> : null}</td>
                  <td className="py-1 text-right align-top">{money(item.precio_unitario)}</td>
                  <td className="py-1 text-right align-top">{money(item.subtotal)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="mt-2 space-y-0.5">
              <p className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal)}</span></p>
              <p className="flex justify-between"><span>Descuento</span><span>{money(sale.descuento)}</span></p>
              <p className="flex justify-between border-t border-dashed border-black pt-1 text-sm font-bold"><span>TOTAL A PAGAR</span><span>{money(sale.total)}</span></p>
              <p className="flex justify-between"><span>Pago</span><span>{paymentNames[sale.metodo_pago] || sale.metodo_pago}</span></p>
              {sale.metodo_pago === 'mixto' && <>
                <p className="flex justify-between"><span>Efectivo</span><span>{money(sale.monto_efectivo)}</span></p>
                <p className="flex justify-between"><span>QR / Transferencia</span><span>{money(sale.monto_qr)}</span></p>
              </>}
              {sale.metodo_pago === 'efectivo' && <p className="flex justify-between"><span>Cambio</span><span>{money(change)}</span></p>}
              {sale.metodo_pago === 'credito' && <p className="flex justify-between font-bold"><span>Saldo pendiente</span><span>{money(creditBalance)}</span></p>}
            </div>
            {sale.metodo_pago === 'credito' && payments.length > 0 && <section className="mt-3 border-t border-dashed border-black pt-2">
              <p className="mb-1 text-center font-bold">HISTORIAL DE PAGOS</p>
              {payments.map((payment) => (
                <p key={payment.id} className="flex justify-between gap-2">
                  <span>{localDate(payment.fecha_pago)} · {paymentNames[payment.metodo_pago] || payment.metodo_pago}</span>
                  <span className="shrink-0">{money(payment.monto)}</span>
                </p>
              ))}
            </section>}
            {sale.metodo_pago === 'credito' && creditBalance === 0 && <p className="mt-2 text-center font-bold">PAGADO TOTAL</p>}
            <p className="mt-4 border-t border-dashed border-black pt-2 text-center">Gracias por su compra</p>
            {String(sale.estado).toUpperCase() === 'ANULADA' && <p className="mt-2 text-center font-bold">*** VENTA ANULADA ***</p>}
          </article>
        </div>
      </section>
    </div>
  );
}
