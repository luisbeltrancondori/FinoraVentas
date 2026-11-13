import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { api } from '../api.js';
import Spinner from './Spinner.jsx';

const emptyCustomer = {
  nombre_completo: '',
  nit_ci: '',
  telefono: '',
  email: '',
  direccion: '',
};

export default function ClientesPage({ negocioId, canManage, notify }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [editor, setEditor] = useState(null);

  const loadCustomers = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      setCustomers(await api(`/api/clientes${params.size ? `?${params}` : ''}`, { negocioId, signal }));
    } catch (error) {
      if (!signal?.aborted) notify(error.message, 'error');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [negocioId, notify, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadCustomers(controller.signal), 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadCustomers]);

  function openCreate() {
    setEditor({ ...emptyCustomer, id: null });
  }

  function openEdit(customer) {
    setEditor({
      id: customer.id,
      nombre_completo: customer.nombre_completo || customer.nombre || '',
      nit_ci: customer.nit_ci || '',
      telefono: customer.telefono || '',
      email: customer.email || '',
      direccion: customer.direccion || '',
    });
  }

  async function saveCustomer(event) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    try {
      const isEditing = Boolean(editor.id);
      await api(isEditing ? `/api/clientes/${editor.id}` : '/api/clientes', {
        method: isEditing ? 'PUT' : 'POST',
        negocioId,
        body: JSON.stringify({
          nombre_completo: editor.nombre_completo.trim(),
          nit_ci: editor.nit_ci.trim(),
          telefono: editor.telefono.trim(),
          email: editor.email.trim(),
          direccion: editor.direccion.trim(),
        }),
      });
      setEditor(null);
      notify(isEditing ? 'Cliente actualizado correctamente.' : 'Cliente registrado correctamente.');
      await loadCustomers();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer) {
    const name = customer.nombre_completo || customer.nombre;
    if (!window.confirm(`¿Eliminar al cliente "${name}"? No se puede eliminar si tiene ventas asociadas.`)) return;
    setDeleting(String(customer.id));
    try {
      await api(`/api/clientes/${customer.id}`, { method: 'DELETE', negocioId });
      notify('Cliente eliminado correctamente.');
      await loadCustomers();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDeleting('');
    }
  }

  const fieldClass = 'mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Directorio</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">Administra los datos de tus clientes y sus cuentas de venta.</p>
        </div>
        {canManage && <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
          <Plus size={16} /> Nuevo cliente
        </button>}
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Users size={17} className="text-emerald-700" /> Directorio de clientes <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{customers.length}</span></div>
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Buscar clientes</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, NIT/CI o teléfono…" className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
          </label>
        </div>
        {loading ? <Spinner label="Cargando clientes…" /> : customers.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Users size={26} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">{search ? 'No encontramos clientes con esa búsqueda.' : 'Aún no hay clientes registrados.'}</p>
            {canManage && !search && <button type="button" onClick={openCreate} className="mt-3 text-xs font-bold text-emerald-700 hover:text-emerald-800">Registrar el primer cliente</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="px-5 py-3 font-semibold">Nombre</th><th className="px-5 py-3 font-semibold">NIT/CI</th><th className="px-5 py-3 font-semibold">Teléfono</th><th className="px-5 py-3 font-semibold">Email</th><th className="px-5 py-3 font-semibold">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{customer.nombre_completo || customer.nombre}</td>
                    <td className="px-5 py-3.5 text-slate-600">{customer.nit_ci || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{customer.telefono || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{customer.email || '—'}</td>
                    <td className="px-5 py-3.5">
                      {canManage ? <div className="flex gap-1">
                        <button type="button" title="Editar cliente" aria-label={`Editar ${customer.nombre_completo || customer.nombre}`} onClick={() => openEdit(customer)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Pencil size={15} /></button>
                        <button type="button" title="Eliminar cliente" aria-label={`Eliminar ${customer.nombre_completo || customer.nombre}`} disabled={deleting === String(customer.id)} onClick={() => deleteCustomer(customer)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={15} /></button>
                      </div> : <span className="text-xs text-slate-400">Solo lectura</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditor(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="customer-editor-title" className="my-auto w-full max-w-xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Directorio</p><h2 id="customer-editor-title" className="mt-1 text-lg font-bold text-slate-900">{editor.id ? 'Editar cliente' : 'Nuevo cliente'}</h2></div>
            <button type="button" onClick={() => setEditor(null)} aria-label="Cerrar formulario" className="rounded-lg p-2 text-slate-400 hover:bg-gray-100"><X size={16} /></button>
          </header>
          <form onSubmit={saveCustomer} className="space-y-4 p-5">
            <label className="block text-xs font-semibold text-slate-600">Nombre completo <span className="text-rose-600">*</span>
              <input autoFocus required maxLength={150} value={editor.nombre_completo} onChange={(event) => setEditor({ ...editor, nombre_completo: event.target.value })} className={fieldClass} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-600">NIT/CI<input maxLength={50} value={editor.nit_ci} onChange={(event) => setEditor({ ...editor, nit_ci: event.target.value })} className={fieldClass} /></label>
              <label className="block text-xs font-semibold text-slate-600">Teléfono<input maxLength={50} value={editor.telefono} onChange={(event) => setEditor({ ...editor, telefono: event.target.value })} className={fieldClass} /></label>
              <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Email<input type="email" maxLength={254} value={editor.email} onChange={(event) => setEditor({ ...editor, email: event.target.value })} className={fieldClass} /></label>
              <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Dirección<textarea rows={2} maxLength={1000} value={editor.direccion} onChange={(event) => setEditor({ ...editor, direccion: event.target.value })} className={`${fieldClass} py-2`} /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" disabled={saving} onClick={() => setEditor(null)} className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600 hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Guardando…' : editor.id ? 'Guardar cambios' : 'Registrar cliente'}</button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}
