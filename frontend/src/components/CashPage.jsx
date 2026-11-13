import { useCallback, useEffect, useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { api } from '../api.js';

const money = (value) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0);

function CashModal({ title, description, onClose, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="cash-modal-title" className="w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"><header className="flex items-start justify-between border-b border-gray-100 px-5 py-4"><div><h2 id="cash-modal-title" className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-400">{description}</p></div><button type="button" onClick={onClose} aria-label="Cerrar modal" className="rounded-md p-2 text-slate-400 hover:bg-gray-100"><X size={15} /></button></header>{children}</section></div>;
}

export default function CashPage({ negocioId, turn, onRefresh, notify }) {
  const [openingAmount, setOpeningAmount] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');
  const expectedCash = Number(turn?.monto_inicial || 0) + Number(turn?.total_efectivo_esperado || 0);
  const input = 'mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await api('/api/turnos', { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    }
  }, [negocioId, notify]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  async function openTurn(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/turnos/abrir', { method: 'POST', negocioId, body: JSON.stringify({ monto_inicial: Number(openingAmount || 0) }) });
      setOpeningAmount('');
      setModal('');
      notify('Turno de caja abierto correctamente.');
      await Promise.all([onRefresh(), refreshHistory()]);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function closeTurn(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api('/api/turnos/cerrar', { method: 'POST', negocioId, body: JSON.stringify({ turno_id: turn.id, monto_real_contado: Number(countedAmount) }) });
      setCountedAmount('');
      setModal('');
      notify(`Turno cerrado. Diferencia: ${money(response.turno.diferencia)}.`);
      await Promise.all([onRefresh(), refreshHistory()]);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Operación diaria</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Caja y turnos</h1><p className="mt-1 text-sm text-slate-500">Control de apertura, flujo de efectivo y cierre.</p></div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${turn ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-slate-500'}`}>{turn ? 'TURNO ABIERTO' : 'TURNO CERRADO'}</span><h2 className="mt-4 text-lg font-bold text-slate-900">{turn ? 'Resumen de caja' : 'No hay caja activa'}</h2><p className="mt-1 text-sm text-slate-500">{turn ? `Apertura ${new Date(turn.fecha_apertura).toLocaleString('es-BO')}` : 'Apertura un turno para registrar ventas.'}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Clock3 size={18} /></span></div>
          {turn ? (
            <dl className="mt-5 divide-y divide-gray-100">
              <div className="flex justify-between py-3 text-[13px]"><dt className="text-slate-500">Fondo inicial</dt><dd className="font-semibold text-slate-800">{money(turn.monto_inicial)}</dd></div>
              <div className="flex justify-between py-3 text-[13px]"><dt className="text-slate-500">Ventas en efectivo</dt><dd className="font-semibold text-slate-800">{money(turn.total_efectivo_esperado)}</dd></div>
              <div className="flex justify-between py-3 text-[13px]"><dt className="text-slate-500">Ventas QR</dt><dd className="font-semibold text-slate-800">{money(turn.total_qr_esperado)}</dd></div>
              <div className="flex justify-between py-3 text-[13px]"><dt className="text-slate-500">Ventas con tarjeta</dt><dd className="font-semibold text-slate-800">{money(turn.total_tarjeta_esperado)}</dd></div>
              <div className="flex justify-between border-t border-gray-100 py-4 text-sm font-bold"><dt className="text-slate-800">Efectivo esperado</dt><dd className="text-emerald-700">{money(expectedCash)}</dd></div>
            </dl>
          ) : <button type="button" onClick={() => setModal('open')} className="mt-5 min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700">Aperturar caja</button>}
        </section>
        {turn && (
          <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold text-slate-900">Cierre de turno</h2><p className="mt-1 text-sm text-slate-500">Realiza el arqueo y registra el efectivo contado.</p>
            <div className="mt-5 rounded-lg bg-gray-50 p-4"><p className="text-xs text-slate-400">Efectivo esperado en caja</p><p className="mt-1 text-xl font-bold text-slate-900">{money(expectedCash)}</p></div>
            <button type="button" onClick={() => setModal('close')} className="mt-4 min-h-10 rounded-lg border bg-emerald-600 px-4 text-xs font-semibold text-slate-700 hover:bg-gray-50">Realizar arqueo y cerrar</button>
          </section>
        )}
      </div>
      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-bold text-slate-900">Historial de Turnos y Arqueos</h2>
          <p className="mt-1 text-xs text-slate-500">Aperturas, cierres y montos registrados para esta sucursal.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha de apertura</th>
                <th className="px-4 py-3 font-semibold">Fecha de cierre</th>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 text-right font-semibold">Fondo inicial</th>
                <th className="px-4 py-3 text-right font-semibold">Monto final contado</th>
                <th className="px-4 py-3 text-right font-semibold">Ventas efectivo</th>
                <th className="px-4 py-3 text-right font-semibold">Ventas QR</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.length ? history.map((entry) => {
                const isOpen = String(entry.estado).toUpperCase() === 'ABIERTA';
                return (
                  <tr key={entry.id} className="text-slate-600">
                    <td className="whitespace-nowrap px-4 py-3">{new Date(entry.fecha_apertura).toLocaleString('es-BO')}</td>
                    <td className="whitespace-nowrap px-4 py-3">{entry.fecha_cierre ? new Date(entry.fecha_cierre).toLocaleString('es-BO') : '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{entry.usuario_nombre}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{money(entry.monto_inicial)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{entry.monto_real_contado == null ? '—' : money(entry.monto_real_contado)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{money(entry.total_efectivo_esperado)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{money(entry.total_qr_esperado)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-slate-600'}`}>{isOpen ? 'Abierto' : 'Cerrado'}</span></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-400">Todavía no hay turnos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {modal === 'open' && <CashModal title="Aperturar caja" description="Define el fondo inicial para iniciar el turno." onClose={() => setModal('')}><form onSubmit={openTurn} className="space-y-5 p-5"><label className="block text-xs font-semibold text-slate-600">Fondo inicial<input autoFocus required type="number" min="0" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="0.00" className={input} /></label><div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setModal('')} className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600">Cancelar</button><button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Aperturando…' : 'Confirmar apertura'}</button></div></form></CashModal>}
      {modal === 'close' && <CashModal title="Cerrar turno" description="Ingresa el efectivo físico contado en caja." onClose={() => setModal('')}><form onSubmit={closeTurn} className="space-y-4 p-5"><div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-xs"><span className="text-slate-500">Efectivo esperado</span><strong className="text-slate-800">{money(expectedCash)}</strong></div><label className="block text-xs font-semibold text-slate-600">Efectivo contado<input autoFocus required type="number" min="0" step="0.01" value={countedAmount} onChange={(event) => setCountedAmount(event.target.value)} placeholder="0.00" className={input} /></label>{countedAmount !== '' && <p className="text-xs text-slate-500">Diferencia estimada: <strong className={Number(countedAmount) - expectedCash < 0 ? 'text-rose-600' : 'text-emerald-700'}>{money(Number(countedAmount) - expectedCash)}</strong></p>}<div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setModal('')} className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600">Cancelar</button><button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Cerrando…' : 'Confirmar cierre'}</button></div></form></CashModal>}
    </div>
  );
}
