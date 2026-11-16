import { useEffect, useState } from 'react';
import { Clock3, Timer } from 'lucide-react';

function getRemaining(deadline) {
  const difference = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(difference) || difference <= 0) return null;
  const seconds = Math.floor(difference / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export default function OfferCountdown({ deadline }) {
  const [remaining, setRemaining] = useState(() => deadline ? getRemaining(deadline) : null);

  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return undefined;
    }
    const update = () => setRemaining(getRemaining(deadline));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return (
    <aside aria-label="Vigencia de ofertas" className="mb-5 flex flex-col gap-3 rounded-2xl bg-slate-900 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300"><Timer size={19} /></span>
        <div>
          <p className="text-sm font-bold">Ofertas por tiempo limitado</p>
          <p className="mt-0.5 text-[11px] text-slate-300">{!deadline ? 'Consulta la vigencia de las promociones en tienda.' : remaining ? 'Aprovecha antes de que finalicen.' : 'La vigencia de estas ofertas ha finalizado.'}</p>
        </div>
      </div>
      {deadline && remaining && <div className="flex items-center gap-2" role="timer" aria-live="off">
        <Clock3 size={15} className="mr-1 text-emerald-300" />
        {[
          ['days', 'Días'],
          ['hours', 'Horas'],
          ['minutes', 'Min'],
          ['seconds', 'Seg'],
        ].map(([unit, label]) => (
          <div key={unit} className="min-w-12 rounded-lg bg-white/10 px-2 py-1.5 text-center">
            <span className="block font-mono text-lg font-bold tabular-nums">{pad(remaining[unit])}</span>
            <span className="block text-[9px] uppercase tracking-wide text-slate-300">{label}</span>
          </div>
        ))}
      </div>}
    </aside>
  );
}
