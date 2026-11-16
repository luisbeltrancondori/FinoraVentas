import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Save, Trash2, Upload } from 'lucide-react';
import { api, assetUrl } from '../api.js';
import Spinner from './Spinner.jsx';

const fieldClass = 'mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60';

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function BannersAdminPage({ negocioId, notify }) {
  const [banners, setBanners] = useState([]);
  const [orders, setOrders] = useState({});
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [title, setTitle] = useState('');
  const [order, setOrder] = useState('0');
  const [image, setImage] = useState(null);
  const formRef = useRef(null);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [rows, offerConfig] = await Promise.all([
        api('/api/banners/admin', { negocioId, signal }),
        api('/api/banners/configuracion/ofertas', { negocioId, signal }),
      ]);
      setBanners(rows);
      setOrders(Object.fromEntries(rows.map((banner) => [banner.id, String(banner.orden)])));
      setDeadline(localDateTime(offerConfig.ofertas_hasta));
    } catch (error) {
      if (!signal?.aborted) notify(error.message, 'error');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [negocioId, notify]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function createBanner(event) {
    event.preventDefault();
    if (!image) {
      notify('Selecciona una imagen panorámica para el banner.', 'error');
      return;
    }
    const body = new FormData();
    body.set('titulo', title);
    body.set('orden', order);
    body.set('activo', 'true');
    body.set('imagen', image);
    setUploading(true);
    try {
      await api('/api/banners', { method: 'POST', negocioId, body });
      setTitle('');
      setOrder('0');
      setImage(null);
      formRef.current?.reset();
      notify('Banner agregado al carrusel.');
      await load();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function updateBanner(banner, changes) {
    setSavingId(banner.id);
    try {
      const updated = await api(`/api/banners/${banner.id}`, {
        method: 'PUT',
        negocioId,
        body: JSON.stringify(changes),
      });
      setBanners((current) => current.map((item) => (item.id === banner.id ? updated : item)));
      setOrders((current) => ({ ...current, [banner.id]: String(updated.orden) }));
      notify('Banner actualizado.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteBanner(banner) {
    if (!window.confirm(`¿Eliminar el banner${banner.titulo ? ` "${banner.titulo}"` : ''}?`)) return;
    setDeletingId(banner.id);
    try {
      await api(`/api/banners/${banner.id}`, { method: 'DELETE', negocioId });
      setBanners((current) => current.filter((item) => item.id !== banner.id));
      notify('Banner eliminado.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDeletingId(null);
    }
  }

  async function saveDeadline(event) {
    event.preventDefault();
    setSavingDeadline(true);
    try {
      const result = await api('/api/banners/configuracion/ofertas', {
        method: 'PUT',
        negocioId,
        body: JSON.stringify({ ofertas_hasta: deadline ? new Date(deadline).toISOString() : null }),
      });
      setDeadline(localDateTime(result.ofertas_hasta));
      notify(result.ofertas_hasta ? 'Fecha de fin de ofertas guardada.' : 'Temporizador de ofertas desactivado.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSavingDeadline(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Administración de tienda</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Banners y carrusel</h1>
        <p className="mt-1 text-sm text-slate-500">Administra las imágenes promocionales y la vigencia del temporizador de ofertas.</p>
      </header>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-bold text-slate-900">Fecha de fin de ofertas</h2>
          <p className="mt-1 text-xs text-slate-500">El contador público llegará a cero en esta fecha y hora local.</p>
        </div>
        <form onSubmit={saveDeadline} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold text-slate-600">Finaliza el
            <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={fieldClass} />
          </label>
          <button type="submit" disabled={savingDeadline} className={buttonClass}><Save size={15} /> Guardar vigencia</button>
          {deadline && <button type="button" disabled={savingDeadline} onClick={() => setDeadline('')} className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Desactivar contador</button>}
        </form>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-bold text-slate-900">Agregar banner promocional</h2>
          <p className="mt-1 text-xs text-slate-500">Usa imágenes panorámicas JPG, PNG o WebP de hasta 8 MB. Se recomienda formato horizontal 16:5.</p>
        </div>
        <form ref={formRef} onSubmit={createBanner} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_8rem_1.5fr_auto] lg:items-end">
          <label className="text-xs font-semibold text-slate-600">Título interno (opcional)
            <input maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Campaña de temporada" className={fieldClass} />
          </label>
          <label className="text-xs font-semibold text-slate-600">Orden
            <input required type="number" min="0" max="1000000" value={order} onChange={(event) => setOrder(event.target.value)} className={fieldClass} />
          </label>
          <label className="text-xs font-semibold text-slate-600">Imagen del banner
            <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} className={`${fieldClass} file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-semibold`} />
          </label>
          <button type="submit" disabled={uploading} className={buttonClass}><Upload size={15} /> {uploading ? 'Subiendo…' : 'Agregar banner'}</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">Banners de esta sucursal</h2>
          <p className="mt-1 text-xs text-slate-500">Los banners activos se muestran en orden ascendente en la página principal.</p>
        </div>
        {loading ? <Spinner label="Cargando banners…" /> : banners.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <ImagePlus size={30} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Todavía no hay banners</p>
            <p className="mt-1 text-xs text-slate-400">La tienda mostrará el banner de bienvenida hasta que agregues uno.</p>
          </div>
        ) : <div className="divide-y divide-slate-100">
          {banners.map((banner) => (
            <article key={banner.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <img src={assetUrl(banner.imagen_url)} alt="" className="h-24 w-full rounded-lg bg-slate-100 object-cover sm:w-48" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{banner.titulo || 'Banner sin título'}</p>
                <p className="mt-1 text-[11px] text-slate-400">ID {banner.id} · {banner.imagen_url}</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-[11px] font-semibold text-slate-500">Orden
                    <input type="number" min="0" max="1000000" value={orders[banner.id] ?? banner.orden} onChange={(event) => setOrders((current) => ({ ...current, [banner.id]: event.target.value }))} className="mt-1 h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm text-slate-800" />
                  </label>
                  <button type="button" disabled={savingId === banner.id || Number(orders[banner.id]) === Number(banner.orden)} onClick={() => updateBanner(banner, { orden: Number(orders[banner.id]) })} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Save size={14} /> Guardar orden</button>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={banner.activo} disabled={savingId === banner.id} onChange={(event) => updateBanner(banner, { activo: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  {banner.activo ? 'Activo' : 'Inactivo'}
                </label>
                <button type="button" disabled={deletingId === banner.id} onClick={() => deleteBanner(banner)} aria-label={`Eliminar banner ${banner.titulo || banner.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-100 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={14} /> Eliminar</button>
              </div>
            </article>
          ))}
        </div>}
      </section>
    </div>
  );
}
