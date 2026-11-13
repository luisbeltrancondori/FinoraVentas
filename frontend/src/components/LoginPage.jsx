import { useState } from 'react';
import {
  Check, Eye, EyeOff, KeyRound, PanelsTopLeft, ShieldCheck,
} from 'lucide-react';
import { api } from '../api.js';

const benefits = [
  'Multi-sucursal',
  'Control de inventario',
  'Ventas al contado y crédito',
];

export default function LoginPage({ setupRequired, onAuthenticated, error: initialError }) {
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState(initialError || '');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [recoveryInfoOpen, setRecoveryInfoOpen] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const path = setupRequired ? '/api/auth/setup' : '/api/auth/login';
      await api(path, {
        method: 'POST',
        body: JSON.stringify({ ...form, remember_me: !setupRequired && rememberMe }),
      });
      await onAuthenticated();
    } catch (requestError) {
      setError(requestError.message === 'Correo o contraseña incorrectos.'
        ? 'Correo o contraseña incorrectos'
        : requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#94a3b8 0.7px, transparent 0.7px)', backgroundSize: '22px 22px' }} />
        <div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-32 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-950/30"><PanelsTopLeft size={21} /></span>
          <div><p className="font-bold tracking-tight">Finora POS</p><p className="text-xs text-slate-400">Gestión comercial</p></div>
        </div>
        <div className="relative max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Operación segura</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Control claro para cada movimiento de tu negocio.</h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">Ventas, inventario y caja en un solo espacio, con acceso por usuario y sucursal.</p>
          <ul className="mt-7 space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><Check size={13} strokeWidth={2.5} /></span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© 2026 Soluciones Informáticas LBC. Todos los derechos reservados.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><PanelsTopLeft size={20} /></span>
            <div><p className="font-bold text-slate-900">Finora POS</p><p className="text-xs text-slate-500">Gestión comercial</p></div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-9">
            <div className="mb-7 grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              {setupRequired ? <ShieldCheck size={21} /> : <KeyRound size={20} />}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{setupRequired ? 'Configura tu acceso' : 'Bienvenido de nuevo'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {setupRequired
                ? 'Crea la cuenta del administrador inicial. Solo está disponible mientras no existan usuarios.'
                : 'Ingresa con tu cuenta para acceder al punto de venta.'}
            </p>

            {error && (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
              {setupRequired && (
                <label className="block text-xs font-semibold text-slate-600">Nombre completo
                  <input required maxLength={150} autoComplete="name" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className={inputClass} placeholder="Nombre del administrador" />
                </label>
              )}
              <label className="block text-xs font-semibold text-slate-600">Correo electrónico
                <input required type="email" maxLength={254} autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} placeholder="nombre@empresa.com" />
              </label>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-600">Contraseña</label>
                <div className="relative mt-1.5">
                  <input
                    id="login-password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    minLength={setupRequired ? 12 : 1}
                    maxLength={128}
                    autoComplete={setupRequired ? 'new-password' : 'current-password'}
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    className={`${inputClass} pr-12`}
                    placeholder={setupRequired ? 'Mínimo 12 caracteres' : 'Tu contraseña'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 transition hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!setupRequired && (
                  <button
                    type="button"
                    onClick={() => setRecoveryInfoOpen(true)}
                    className="mt-2 block w-full text-right text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>

              {setupRequired ? (
                <p className="text-xs leading-5 text-slate-500">Usa al menos 12 caracteres. No existe una contraseña predeterminada.</p>
              ) : (
                <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Recordarme
                </label>
              )}

              <button type="submit" disabled={saving} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-wait disabled:opacity-60">
                {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {saving ? 'Ingresando…' : setupRequired ? 'Crear administrador' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">Sesión privada y protegida · Sistema POS</p>
        </div>
      </section>
      {recoveryInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRecoveryInfoOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-recovery-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="password-recovery-title" className="text-lg font-bold text-slate-900">Recuperar contraseña</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Por motivos de seguridad, las contraseñas solo pueden ser restablecidas por el Administrador del sistema. Por favor, comunícate con tu encargado para que te asigne una nueva contraseña temporal.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setRecoveryInfoOpen(false)}
                className="min-h-10 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
              >
                Entendido
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
