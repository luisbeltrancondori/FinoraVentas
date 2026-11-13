import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import Spinner from './Spinner.jsx';

const card = 'overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm';
const field = 'mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] text-slate-800 outline-none focus:border-emerald-500';

export default function CategoriasPage({ negocioId, canManage, notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api('/api/categorias', { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [negocioId]);

  function start(item = null) {
    setRecord(item || {});
    setName(item?.nombre || '');
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const editing = Boolean(record?.id);
      await api(editing ? `/api/categorias/${record.id}` : '/api/categorias', {
        method: editing ? 'PUT' : 'POST',
        negocioId,
        body: JSON.stringify({ nombre: name.trim() }),
      });
      notify(editing ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.');
      setRecord(null);
      await load();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`¿Eliminar la categoría "${item.nombre}"?`)) return;
    try {
      await api(`/api/categorias/${item.id}`, { method: 'DELETE', negocioId });
      notify('Categoría eliminada correctamente.');
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Catálogo</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Categorías</h1><p className="mt-1 text-sm text-slate-500">Organiza los productos de tu negocio por categoría.</p></div>
      {canManage && <button type="button" onClick={() => start()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"><Plus size={15} /> Nueva categoría</button>}
    </div>
    <section className={card}>
      {loading ? <Spinner label="Cargando categorías…" /> : !rows.length ? <p className="p-10 text-center text-sm text-slate-500">Aún no hay categorías registradas.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[13px]">
          <thead className="border-b border-gray-100 bg-gray-50/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Nombre</th><th className="px-5 py-3 text-right font-semibold">Productos asociados</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead>
          <tbody className="divide-y divide-gray-50">{rows.map((item) => <tr key={item.id} className="hover:bg-gray-50/70">
            <td className="px-5 py-4"><span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Tag size={15} /></span><span className="font-semibold text-slate-800">{item.nombre}</span></td>
            <td className="px-5 py-4 text-right text-slate-600">{item.productos}</td>
            <td className="px-5 py-4 text-right"><div className="inline-flex items-center gap-1">
              <button type="button" title={`Ver ${item.nombre}`} aria-label={`Ver ${item.nombre}`} onClick={() => setViewing(item)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye size={16} /></button>
              {canManage && <><button type="button" title={`Editar ${item.nombre}`} aria-label={`Editar ${item.nombre}`} onClick={() => start(item)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Pencil size={16} /></button><button type="button" title={`Eliminar ${item.nombre}`} aria-label={`Eliminar ${item.nombre}`} onClick={() => remove(item)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
      )}
    </section>
    {record !== null && <Modal title={record.id ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setRecord(null)}>
      <form onSubmit={submit} className="p-5">
        <label className="block text-xs font-semibold text-slate-600">Nombre<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={field} /></label>
        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setRecord(null)} className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600">Cancelar</button><button disabled={saving} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button></div>
      </form>
    </Modal>}
    {viewing && <Modal title="Detalle de categoría" onClose={() => setViewing(null)}><div className="space-y-3 p-5 text-sm"><p><span className="text-slate-500">Nombre:</span> <strong className="text-slate-800">{viewing.nombre}</strong></p><p><span className="text-slate-500">Productos asociados:</span> <strong className="text-slate-800">{viewing.productos}</strong></p><p className="break-all text-xs text-slate-400">ID: {viewing.id}</p></div></Modal>}
  </div>;
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-slate-900">{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button></header>
      {children}
    </section>
  </div>;
}
