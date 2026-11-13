import { useState } from 'react';
import { CheckCircle2, LoaderCircle, Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import PublicStoreHeader from './PublicStoreHeader.jsx';
import { api } from '../api.js';

const MAP_EMBED_URL = 'https://www.google.com/maps?q=-17.010675%2C-63.233880&z=16&output=embed';
const MAP_LINK = 'https://maps.app.goo.gl/unnKX9mnvZXLdNHq9';

export default function Contacto() {
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSuccess('');
    setError('');
    try {
      const result = await api('/api/public/contacto', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess(result.message || '¡Gracias! Tu mensaje fue enviado.');
      setForm({ nombre: '', email: '', mensaje: '' });
    } catch (requestError) {
      setError(requestError.message || 'No se pudo enviar el mensaje. Inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <PublicStoreHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800"><MessageSquare size={14} /> Estamos para ayudarte</span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Contáctanos</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Envíanos tu consulta o visítanos. Nuestro equipo estará encantado de atenderte.</p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-7">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold text-slate-900">Envíanos un mensaje</h2>
            <p className="mt-1 text-xs text-slate-500">Completa el formulario y nos pondremos en contacto contigo.</p>
            {success && <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /><span>{success}</span></div>}
            {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block text-xs font-semibold text-slate-600">Nombre
                <input required maxLength={150} autoComplete="name" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className={fieldClass} placeholder="Tu nombre" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Email
                <input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} placeholder="tu@correo.com" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Mensaje
                <textarea required maxLength={5000} rows={5} value={form.mensaje} onChange={(event) => setForm({ ...form, mensaje: event.target.value })} className={`${fieldClass} resize-y py-3`} placeholder="¿Cómo podemos ayudarte?" />
              </label>
              <button type="submit" disabled={submitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? <><LoaderCircle size={16} className="animate-spin" /> Enviando…</> : <><Mail size={16} /> Enviar Mensaje</>}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:px-6">
              <div><h2 className="font-bold text-slate-900">Encuéntranos</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} className="text-emerald-600" /> Tienda Forty</p></div>
              <a href={MAP_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"><MapPin size={14} /> Abrir en Google Maps</a>
            </div>
            <iframe
              title="Ubicación de Tienda Forty en Google Maps"
              src={MAP_EMBED_URL}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="h-72 w-full border-0 sm:h-[420px]"
            />
            <div className="flex items-center gap-2 p-4 text-xs text-slate-500"><Phone size={14} className="text-emerald-600" /> Contáctanos para consultas sobre productos y horarios de atención.</div>
          </section>
        </div>
      </main>
    </div>
  );
}
