import { useEffect } from 'react';
import {
  Code2, Headset, MessageCircle, Phone, X,
} from 'lucide-react';

export default function HelpCenterModal({ onClose, connection = 'checking' }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const status = connection === 'online'
    ? 'Sistema en línea'
    : connection === 'offline'
      ? 'Sin conexión'
      : 'Verificando conexión';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-center-title"
        className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border-t-4 border-emerald-500 bg-white shadow-2xl"
      >
        <header className="relative flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Headset size={24} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 pr-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Soporte y Asistencia</p>
            <h2 id="help-center-title" className="mt-1 text-lg font-extrabold leading-tight tracking-tight text-slate-900 sm:text-xl">
              SOLUCIONES INFORMATICAS LBC
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar centro de ayuda"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-7">
          <section className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-800">
              <Code2 size={18} className="text-emerald-700" />
              <h3 className="text-sm font-bold">Finora</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Sistema de Punto de Venta (POS) integral para comercios y ventas, optimizado para el control de inventario, gestión de ventas y compras, administración de caja, créditos de clientes y generación de reportes gerenciales.
            </p>
          </section>

          <section className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contacto y soporte</h3>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Phone size={16} className="text-emerald-700" />
                <a href="tel:+59162108877" className="hover:text-emerald-700">+591 62108877</a>
              </p>
            </div>
            <a
              href="https://wa.me/59162108877"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          </section>

          <section className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
              <Code2 size={17} />
            </span>
            <div>
              <p className="text-[10px] font-semibold text-slate-400">Desarrollador / Responsable</p>
              <p className="mt-1 text-sm font-bold text-slate-800">Ing. Luis Beltrán Condori Cano</p>
            </div>
          </section>
        </div>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:items-center sm:px-7">
          <p className="text-[10px] font-medium text-slate-500">Finora POS - Versión 1.0.0</p>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            <span className={`h-2 w-2 rounded-full ${connection === 'online' ? 'bg-emerald-500' : connection === 'offline' ? 'bg-rose-500' : 'animate-pulse bg-amber-400'}`} />
            {status}
          </p>
        </footer>
      </section>
    </div>
  );
}
