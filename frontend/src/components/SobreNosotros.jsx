import { ArrowRight, HeartHandshake, ShieldCheck, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicStoreHeader from './PublicStoreHeader.jsx';

export default function SobreNosotros() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <PublicStoreHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-slate-100">
          <div className="grid items-center gap-8 p-6 sm:p-10 md:grid-cols-2 md:gap-12 lg:p-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 shadow-sm"><Store size={14} /> Nuestra historia</span>
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Sobre Tienda Forty</h1>
              <p className="mt-5 text-base leading-7 text-slate-600">En Tienda Forty nos dedicamos a proveer los mejores productos para tu hogar. Nacimos con el compromiso de ofrecer calidad, buenos precios y un servicio excepcional a nuestra comunidad.</p>
              <p className="mt-4 text-sm leading-7 text-slate-600">Trabajamos cada día para que encuentres en un solo lugar productos esenciales, opciones para compartir y la atención cercana que mereces. Queremos ser parte de tu día a día y ayudarte a llevar lo mejor a casa.</p>
              <Link to="/" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800">Explorar productos <ArrowRight size={16} /></Link>
            </div>
            <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100/70 p-8 sm:min-h-80">
              <div aria-hidden="true" className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/50" />
              <div aria-hidden="true" className="absolute -bottom-16 -left-8 h-56 w-56 rounded-full bg-emerald-200/50" />
              <div className="relative grid max-w-sm gap-4">
                <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm">
                  <HeartHandshake size={25} className="text-emerald-700" />
                  <h2 className="mt-3 font-bold text-slate-900">Cercanía y confianza</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Atención amable y compromiso con las familias de nuestra comunidad.</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm">
                  <ShieldCheck size={25} className="text-emerald-700" />
                  <h2 className="mt-3 font-bold text-slate-900">Calidad para tu hogar</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Una selección de productos pensada para acompañar cada día.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6 lg:px-8">Tienda Forty · Calidad, buenos precios y servicio para tu hogar.</footer>
    </div>
  );
}
