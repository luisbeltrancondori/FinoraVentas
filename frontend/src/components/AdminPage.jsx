import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Banknote, Building2, ClipboardList, Copy, Eye, KeyRound, Package, Pencil, Plus, Save, Shield, ShoppingBag, Trash2, Users, X } from 'lucide-react';
import { api } from '../api.js';
import Spinner from './Spinner.jsx';
import TicketImpresion from './TicketImpresion.jsx';
import { PurchaseNote } from './PurchasesPage.jsx';

const formatDate = (value) => value ? new Date(value).toLocaleString('es-BO') : '—';
const money = (value) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0);
const input = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';
const action = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60';
const card = 'overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm';

const permissionOptions = [
  ['dashboard.read', 'Consultar resumen'],
  ['sales.read', 'Consultar ventas'],
  ['sales.write', 'Registrar ventas'],
  ['cash.read', 'Consultar caja'],
  ['cash.write', 'Abrir y cerrar caja'],
  ['products.read', 'Consultar productos'],
  ['products.manage', 'Gestionar catálogo'],
  ['purchases.read', 'Consultar compras'],
  ['purchases.write', 'Registrar compras'],
  ['inventory.read', 'Consultar inventario'],
  ['inventory.write', 'Ajustar inventario'],
];
const roleDefaults = {
  administrador: ['*'],
  cajero: ['dashboard.read', 'sales.read', 'sales.write', 'cash.read', 'cash.write', 'products.read', 'inventory.read'],
  almacenero: ['dashboard.read', 'products.read', 'products.manage', 'purchases.read', 'purchases.write', 'inventory.read', 'inventory.write'],
};

export default function AdminPage({ view, negocioId, businesses, business, user, products, canManage, canAdjust, notify, onRefresh, onInventoryRefresh }) {
  if (view === 'branches') return <BranchesPage businesses={businesses} notify={notify} onRefresh={onRefresh} />;
  if (view === 'users') return <UsersPage businesses={businesses} notify={notify} />;
  if (view === 'suppliers') return <SuppliersPage negocioId={negocioId} notify={notify} canManage={canManage} />;
  if (view === 'kardex') return <KardexPage negocioId={negocioId} products={products} business={business} notify={notify} />;
  if (view === 'physical') return <PhysicalPage negocioId={negocioId} business={business} notify={notify} />;
  if (view === 'adjust-positive') return <InventoryAdjustmentsPage type="positivo" negocioId={negocioId} products={products} canAdjust={canAdjust} notify={notify} onRefresh={onInventoryRefresh} />;
  if (view === 'adjust-negative') return <InventoryAdjustmentsPage type="negativo" negocioId={negocioId} products={products} canAdjust={canAdjust} notify={notify} onRefresh={onInventoryRefresh} />;
  return <ProfilePage user={user} notify={notify} onRefresh={onRefresh} />;
}

function PageHeader({ eyebrow, title, description, button }) {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">{eyebrow}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    {button}
  </div>;
}

function BranchesPage({ businesses, notify, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const start = (business = null) => {
    setEditing(business || {});
    setForm(business ? { ...business } : { nombre: '', nit: '', direccion: '', telefono: '', moneda: 'Bs' });
  };
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const isEdit = Boolean(editing.id);
      await api(isEdit ? `/api/negocios/${editing.id}` : '/api/negocios', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      notify(isEdit ? 'Sucursal actualizada.' : 'Sucursal creada y vinculada a tu usuario.');
      setEditing(null);
      await onRefresh();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  }
  return <div className="space-y-5">
    <PageHeader eyebrow="Administración" title="Sucursales y negocios" description="Gestiona las sucursales disponibles para tu cuenta." button={<button type="button" onClick={() => start()} className={action}><Plus size={15} /> Nueva sucursal</button>} />
    <section className={card}>
      <div className="divide-y divide-slate-100">{businesses.map((branch) => <article key={branch.id} className="flex items-center gap-4 p-4 sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={19} /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{branch.nombre}</p><p className="mt-1 truncate text-xs text-slate-500">{[branch.nit, branch.direccion, branch.telefono].filter(Boolean).join(' · ') || 'Sin datos adicionales'} · {branch.moneda || 'Bs'}</p></div>
        <button type="button" onClick={() => start(branch)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Pencil size={14} /> Editar</button>
      </article>)}</div>
      {!businesses.length && <p className="p-8 text-center text-sm text-slate-500">No hay sucursales asignadas.</p>}
    </section>
    {editing !== null && <Modal title={editing.id ? 'Editar sucursal' : 'Nueva sucursal'} close={() => setEditing(null)}>
      <form onSubmit={submit} className="grid gap-3 p-5 sm:grid-cols-2">
        <Field label="Nombre *" className="sm:col-span-2"><input required maxLength={150} className={input} value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="NIT"><input className={input} value={form.nit || ''} onChange={(e) => setForm({ ...form, nit: e.target.value })} /></Field>
        <Field label="Moneda"><input maxLength={10} className={input} value={form.moneda || ''} onChange={(e) => setForm({ ...form, moneda: e.target.value })} /></Field>
        <Field label="Teléfono"><input className={input} value={form.telefono || ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
        <Field label="Dirección"><input className={input} value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Field>
        <FormActions saving={saving} close={() => setEditing(null)} />
      </form>
    </Modal>}
  </div>;
}

function UsersPage({ businesses, notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const blank = () => ({ nombre: '', email: '', role: 'cajero', password: '', permissions: {}, negocio_ids: businesses[0]?.id ? [businesses[0].id] : [] });
  const [form, setForm] = useState(blank);
  async function load() {
    setLoading(true);
    try { setRows(await api('/api/usuarios')); } catch (error) { notify(error.message, 'error'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function start(user = null) {
    setEditing(user || {});
    setForm(user ? {
      ...user,
      password: '',
      negocio_ids: user.negocio_ids || [],
      permissions: user.permissions || {},
    } : blank());
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const body = { ...form };
    if (!body.password) delete body.password;
    try {
      const isEdit = Boolean(editing.id);
      await api(isEdit ? `/api/usuarios/${editing.id}` : '/api/usuarios', {
        method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(body),
      });
      notify(isEdit ? 'Usuario actualizado.' : 'Usuario creado.');
      setEditing(null);
      await load();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  }
  async function resetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const result = await api(`/api/usuarios/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!result.success || typeof result.tempPassword !== 'string') {
        throw new Error('El servidor no devolvió una contraseña temporal válida.');
      }
      setResetResult({ user: resetTarget, tempPassword: result.tempPassword });
      setResetTarget(null);
      setCopied(false);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setResetting(false);
    }
  }
  async function copyTemporaryPassword() {
    try {
      await navigator.clipboard.writeText(resetResult.tempPassword);
      setCopied(true);
    } catch (error) {
      notify(`No se pudo copiar la contraseña: ${error.message}`, 'error');
    }
  }
  const titleRole = { administrador: 'Administrador', cajero: 'Cajero', almacenero: 'Almacenero' };
  return <div className="space-y-5">
    <PageHeader eyebrow="Accesos" title="Usuarios, roles y permisos" description="Asigna un rol y sucursales; configura permisos particulares para cada cuenta." button={<button type="button" onClick={() => start()} className={action}><Plus size={15} /> Nuevo usuario</button>} />
    <section className={card}>
      {loading ? <Spinner label="Cargando usuarios…" /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Usuario</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Sucursales</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acción</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-5 py-4"><p className="font-semibold text-slate-800">{row.nombre}</p><p className="mt-0.5 text-xs text-slate-500">{row.email}</p></td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><Shield size={13} />{titleRole[row.role] || row.role}</span></td><td className="px-5 py-4 text-xs text-slate-600">{(row.negocio_ids || []).length} asignada(s)</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.activo ? 'Activo' : 'Desactivado'}</span></td><td className="px-5 py-4 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => setResetTarget(row)} aria-label={`Restablecer contraseña de ${row.nombre}`} title={`Restablecer contraseña de ${row.nombre}`} className="grid h-9 w-9 place-items-center rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"><KeyRound size={15} /></button><button type="button" onClick={() => start(row)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Pencil size={14} /> Editar</button></div></td></tr>)}</tbody>
      </table>{!rows.length && <p className="p-8 text-center text-sm text-slate-500">No hay usuarios registrados.</p>}</div>}
    </section>
    {editing !== null && <Modal title={editing.id ? 'Editar usuario' : 'Crear usuario'} close={() => setEditing(null)}>
      <form onSubmit={submit} className="max-h-[78vh] overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo *"><input required maxLength={150} className={input} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
          <Field label="Correo *"><input required type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Rol *"><select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="administrador">Administrador</option><option value="cajero">Cajero</option><option value="almacenero">Almacenero</option></select></Field>
          <Field label={editing.id ? 'Nueva contraseña (opcional)' : 'Contraseña *'}><input required={!editing.id} type="password" minLength={12} maxLength={128} className={input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 12 caracteres" /></Field>
        </div>
        <fieldset className="mt-5"><legend className="text-xs font-bold text-slate-700">Sucursales autorizadas</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{businesses.map((branch) => <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700"><input type="checkbox" checked={form.negocio_ids.includes(branch.id)} onChange={(event) => setForm({ ...form, negocio_ids: event.target.checked ? [...form.negocio_ids, branch.id] : form.negocio_ids.filter((id) => id !== branch.id) })} />{branch.nombre}</label>)}</div></fieldset>
        <fieldset className="mt-5"><legend className="text-xs font-bold text-slate-700">Permisos personalizados <span className="font-normal text-slate-400">(sobre las capacidades predeterminadas del rol)</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{permissionOptions.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2.5 text-xs text-slate-600"><input type="checkbox" disabled={form.role === 'administrador'} checked={form.role === 'administrador' || (form.permissions[key] ?? (roleDefaults[form.role] || []).includes(key))} onChange={(event) => { const permissions = { ...form.permissions }; if (event.target.checked === (roleDefaults[form.role] || []).includes(key)) delete permissions[key]; else permissions[key] = event.target.checked; setForm({ ...form, permissions }); }} />{label}</label>)}</div>{form.role === 'administrador' && <p className="mt-2 text-xs text-slate-500">El rol administrador siempre conserva todos los permisos.</p>}</fieldset>
        {editing.id && <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Cuenta activa</label>}
        <FormActions saving={saving} close={() => setEditing(null)} />
      </form>
    </Modal>}
    {resetTarget && <Modal title="Confirmar restablecimiento" close={() => { if (!resetting) setResetTarget(null); }}>
      <div className="space-y-4 p-5">
        <p className="text-sm leading-6 text-slate-600">¿Estás seguro de que deseas restablecer la contraseña de <strong className="text-slate-900">{resetTarget.nombre}</strong>?</p>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">Se generará una contraseña temporal nueva. La contraseña actual dejará de funcionar inmediatamente.</p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" disabled={resetting} onClick={() => setResetTarget(null)} className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={resetting} onClick={resetPassword} className={action}><KeyRound size={14} />{resetting ? 'Restableciendo…' : 'Restablecer contraseña'}</button>
        </div>
      </div>
    </Modal>}
    {resetResult && <Modal title="Contraseña restablecida" close={() => setResetResult(null)}>
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">✓</span>
          <p className="text-sm leading-5 text-emerald-800">La contraseña de <strong>{resetResult.user.nombre}</strong> se restableció correctamente.</p>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Contraseña temporal</p>
          <div className="flex items-center gap-2">
            <code className="min-h-12 flex-1 select-all rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-center font-mono text-lg font-bold tracking-wider text-emerald-800">{resetResult.tempPassword}</code>
            <button type="button" onClick={copyTemporaryPassword} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Copy size={15} />{copied ? 'Copiada' : 'Copiar'}</button>
          </div>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">Comparte esta contraseña con el empleado. Por seguridad, pídele que la cambie en su Perfil apenas inicie sesión.</p>
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button type="button" onClick={() => setResetResult(null)} className={action}>Listo</button>
        </div>
      </div>
    </Modal>}
  </div>;
}

function SuppliersPage({ negocioId, notify, canManage }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  async function load() {
    try { setRows(await api('/api/proveedores', { negocioId })); } catch (error) { notify(error.message, 'error'); }
  }
  useEffect(() => { load(); }, [negocioId]);
  const filtered = useMemo(() => rows.filter((item) => `${item.nombre_empresa} ${item.contacto_nombre || ''}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  function start(row = null) {
    setEditing(row || {});
    setForm(row ? { ...row } : { nombre_empresa: '', contacto_nombre: '', telefono: '', nit_ci: '', direccion: '' });
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const isEdit = Boolean(editing.id);
      await api(isEdit ? `/api/proveedores/${editing.id}` : '/api/proveedores', { method: isEdit ? 'PATCH' : 'POST', negocioId, body: JSON.stringify(form) });
      notify(isEdit ? 'Proveedor actualizado.' : 'Proveedor registrado.');
      setEditing(null);
      await load();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  }
  async function remove(row) {
    if (!window.confirm(`¿Eliminar al proveedor ${row.nombre_empresa}?`)) return;
    try { await api(`/api/proveedores/${row.id}`, { method: 'DELETE', negocioId }); notify('Proveedor eliminado.'); await load(); } catch (error) { notify(error.message, 'error'); }
  }
  return <div className="space-y-5">
    <PageHeader eyebrow="Catálogo" title="Proveedores" description="Contactos comerciales vinculados a la sucursal seleccionada." button={canManage && <button type="button" onClick={() => start()} className={action}><Plus size={15} /> Nuevo proveedor</button>} />
    <section className={card}>
      <div className="border-b border-slate-100 p-4"><input className={`${input} sm:max-w-xs`} placeholder="Buscar proveedor…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {!filtered.length ? <p className="p-8 text-center text-sm text-slate-500">No hay proveedores para mostrar.</p> : <div className="divide-y divide-slate-100">{filtered.map((row) => <article key={row.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-800">{row.nombre_empresa}</p><p className="mt-1 truncate text-xs text-slate-500">{[row.contacto_nombre, row.telefono, row.nit_ci ? `NIT/CI: ${row.nit_ci}` : '', row.direccion].filter(Boolean).join(' · ') || 'Sin información adicional'}</p></div><button type="button" title={`Ver ${row.nombre_empresa}`} aria-label={`Ver ${row.nombre_empresa}`} onClick={() => setViewing(row)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye size={15} /></button>{canManage && <><button type="button" title={`Editar ${row.nombre_empresa}`} aria-label={`Editar ${row.nombre_empresa}`} onClick={() => start(row)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button><button type="button" title={`Eliminar ${row.nombre_empresa}`} aria-label={`Eliminar ${row.nombre_empresa}`} onClick={() => remove(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button></>}</article>)}</div>}
    </section>
    {editing !== null && <Modal title={editing.id ? 'Editar proveedor' : 'Nuevo proveedor'} close={() => setEditing(null)}><form onSubmit={submit} className="grid gap-3 p-5">
      <Field label="Empresa *"><input required maxLength={150} className={input} value={form.nombre_empresa} onChange={(e) => setForm({ ...form, nombre_empresa: e.target.value })} /></Field>
      <Field label="Contacto"><input className={input} value={form.contacto_nombre || ''} onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value })} /></Field>
      <Field label="Teléfono"><input className={input} value={form.telefono || ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
      <Field label="NIT / CI"><input maxLength={50} className={input} value={form.nit_ci || ''} onChange={(e) => setForm({ ...form, nit_ci: e.target.value })} /></Field>
      <Field label="Dirección"><input className={input} value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Field>
      <FormActions saving={saving} close={() => setEditing(null)} />
    </form></Modal>}
    {viewing && <Modal title="Detalle del proveedor" close={() => setViewing(null)}><div className="space-y-3 p-5 text-sm">{[['Empresa', viewing.nombre_empresa], ['Contacto', viewing.contacto_nombre], ['NIT/CI', viewing.nit_ci], ['Teléfono', viewing.telefono], ['Dirección', viewing.direccion]].map(([label, value]) => <p key={label}><span className="text-slate-500">{label}:</span> <strong className="text-slate-800">{value || '—'}</strong></p>)}</div></Modal>}
  </div>;
}

function KardexPage({ negocioId, products, business, notify }) {
  const [rows, setRows] = useState([]);
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api('/api/marcas', { negocioId }), api('/api/proveedores', { negocioId })])
      .then(([brandRows, supplierRows]) => {
        if (active) {
          setBrands(brandRows);
          setSuppliers(supplierRows);
        }
      })
      .catch((error) => { if (active) notify(error.message, 'error'); });
    return () => { active = false; };
  }, [negocioId, notify]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (productId) params.set('producto_id', productId);
    if (brandId) params.set('marca_id', brandId);
    if (supplierId) params.set('proveedor_id', supplierId);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [brandId, productId, search, supplierId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const suffix = query ? `?${query}` : '';
        const [movementRows, kpiData] = await Promise.all([
          api(`/api/inventario/kardex${suffix}`, { negocioId }),
          api(`/api/inventario/kardex/kpis${suffix}`, { negocioId }),
        ]);
        if (active) {
          setRows(movementRows);
          setKpis(kpiData);
        }
      } catch (error) {
        if (active) notify(error.message, 'error');
      } finally {
        if (active) setLoading(false);
      }
    }, search.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [negocioId, notify, query, search]);

  async function openMovement(row) {
    setSource(null);
    if (row.movimiento === 'venta') {
      setSourceLoading(true);
      try {
        setSource({ type: 'sale', detail: await api(`/api/ventas/${row.referencia_id}`, { negocioId }) });
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        setSourceLoading(false);
      }
      return;
    }
    if (row.movimiento === 'compra') {
      setSourceLoading(true);
      try {
        setSource({ type: 'purchase', detail: await api(`/api/compras/${row.referencia_id}`, { negocioId }) });
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        setSourceLoading(false);
      }
      return;
    }
    setSource({ type: 'adjustment', detail: row });
  }

  const kpiCards = [
    { title: 'Total vendido', value: `${Number(kpis?.total_vendido || 0).toLocaleString('es-BO')} unidades`, icon: ShoppingBag, color: 'text-violet-700 bg-violet-50' },
    { title: 'Saldo físico', value: `${Number(kpis?.saldo_fisico || 0).toLocaleString('es-BO')} unidades`, icon: Package, color: 'text-emerald-700 bg-emerald-50' },
    { title: 'Lotes en stock', value: `${Number(kpis?.cantidad_lotes || 0).toLocaleString('es-BO')} lotes activos`, icon: Banknote, color: 'text-amber-700 bg-amber-50' },
  ];

  return <div className="space-y-5">
    <PageHeader eyebrow="Inventario" title="Kardex de movimientos" description="Entradas por compras, salidas por ventas y ajustes físicos." />
    <section className={card}>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2 xl:col-span-1">Buscar producto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o código de barras" className={input} /></label>
        <label className="text-xs font-semibold text-slate-600">Marca<select className={input} value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">Todas las marcas</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Proveedor<select className={input} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Todos los proveedores</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.nombre_empresa}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Producto para KPIs<select className={input} value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Todos los productos filtrados</option>{products.map((item) => <option key={item.id} value={item.id}>{item.nombre} {item.codigo_barras ? `· ${item.codigo_barras}` : ''}</option>)}</select></label>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {kpiCards.map((item) => { const Icon = item.icon; return <article key={item.title} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{item.title}</p><span className={`grid h-9 w-9 place-items-center rounded-lg ${item.color}`}><Icon size={17} /></span></div><p className="mt-3 text-xl font-bold tracking-tight text-slate-900">{loading && !kpis ? '—' : item.value}</p><p className="mt-1 text-[10px] text-slate-400">{productId ? 'Producto seleccionado' : 'Total de los productos filtrados'}</p></article>; })}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600"><ClipboardList size={16} className="text-emerald-700" /> Movimientos registrados</span><span className="text-xs text-slate-400">{rows.length} resultados · máximo 500</span></div>
      {loading ? <Spinner label="Consultando movimientos…" /> : !rows.length ? <p className="p-8 text-center text-sm text-slate-500">No se encontraron movimientos con esos filtros.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Movimiento</th><th className="px-4 py-3">Producto / Referencia</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-right">Saldo actual</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={`${row.movimiento}-${row.referencia_id}-${row.producto_id}`} onClick={() => openMovement(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMovement(row); } }} tabIndex={0} role="button" aria-label={`Ver origen del movimiento ${row.movimiento}: ${row.producto_nombre}`} className="cursor-pointer transition hover:bg-emerald-50/60 focus:bg-emerald-50 focus:outline-none"><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(row.fecha)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.movimiento.replace('_', ' ')}</span></td><td className="px-4 py-3"><p className="font-medium text-slate-800">{row.producto_nombre}</p><p className="text-xs text-slate-400">{row.descripcion}</p></td><td className={`px-4 py-3 text-right font-semibold ${Number(row.cantidad) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{Number(row.cantidad) > 0 ? '+' : ''}{row.cantidad}</td><td className="px-4 py-3 text-right text-slate-600">{row.saldo}</td></tr>)}</tbody></table></div>}
    </section>
    {sourceLoading && <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/40"><Spinner label="Cargando documento de origen…" /></div>}
    {source?.type === 'sale' && <TicketImpresion detail={source.detail} business={business} isReprint onClose={() => setSource(null)} />}
    {source?.type === 'purchase' && <PurchaseNote detail={source.detail} business={business} onClose={() => setSource(null)} />}
    {source?.type === 'adjustment' && <Modal title="Detalle del ajuste" close={() => setSource(null)}><div className="space-y-3 p-5 text-sm"><p><span className="text-slate-500">Producto:</span> <strong>{source.detail.producto_nombre}</strong></p><p><span className="text-slate-500">Tipo:</span> <strong className="capitalize">{source.detail.movimiento.replace('_', ' ')}</strong></p><p><span className="text-slate-500">Fecha:</span> <strong>{formatDate(source.detail.fecha)}</strong></p><p><span className="text-slate-500">Diferencia:</span> <strong>{Number(source.detail.cantidad) > 0 ? '+' : ''}{source.detail.cantidad}</strong></p><p><span className="text-slate-500">Saldo posterior:</span> <strong>{source.detail.saldo}</strong></p><p><span className="text-slate-500">Motivo:</span> <strong>{source.detail.descripcion || '—'}</strong></p><div className="flex justify-end border-t border-slate-100 pt-3"><button type="button" onClick={() => setSource(null)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"><X size={14} /> Cerrar</button></div></div></Modal>}
  </div>;
}

function PhysicalPage({ negocioId, business, notify }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, reportRows] = await Promise.all([
        api('/api/inventarios-fisicos/preparar', { negocioId }),
        api('/api/inventarios-fisicos', { negocioId }),
      ]);
      setProducts(catalog.map((product) => ({ ...product, saldo_fisico: '' })));
      setReports(reportRows);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [negocioId, notify]);

  useEffect(() => { load(); }, [load]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter((product) => (
      !query
      || String(product.nombre || '').toLocaleLowerCase().includes(query)
      || String(product.codigo_barras || '').toLocaleLowerCase().includes(query)
    ));
  }, [products, search]);

  const countedProducts = products.filter((product) => product.saldo_fisico !== '');
  const adjustmentValue = (product) => {
    if (product.saldo_fisico === '') return 0;
    return Number(product.saldo_fisico) - Number(product.stock_sistema);
  };
  const adjustmentTotal = (product) => adjustmentValue(product) * Number(product.costo || 0);
  const positiveTotal = countedProducts.reduce((total, product) => total + Math.max(0, adjustmentTotal(product)), 0);
  const negativeTotal = countedProducts.reduce((total, product) => total + Math.min(0, adjustmentTotal(product)), 0);
  const printProducts = products.filter((product) => (
    product.saldo_fisico !== '' || adjustmentValue(product) !== 0
  ));

  async function submit(event) {
    event.preventDefault();
    if (!countedProducts.length) {
      notify('Ingresa el saldo físico de al menos un producto antes de guardar.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api('/api/inventarios-fisicos', {
        method: 'POST',
        negocioId,
        body: JSON.stringify({
          detalles: countedProducts.map(({ id, saldo_fisico }) => ({
            producto_id: id,
            saldo_contado: Number(saldo_fisico),
          })),
        }),
      });
      notify('Inventario guardado como borrador/reporte. No se ha modificado el stock. Puede revisar las diferencias y generar ajustes manuales si es necesario.');
      await load();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function updateCount(productId, value) {
    if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) return;
    setProducts((current) => current.map((product) => (
      product.id === productId ? { ...product, saldo_fisico: value } : product
    )));
  }

  function focusNext(index) {
    inputRefs.current[index + 1]?.focus();
    inputRefs.current[index + 1]?.select();
  }

  return <div className="space-y-5">
    <style>{`
      @media print {
        @page { size: letter landscape; margin: 10mm; }
        body * { visibility: hidden !important; }
        #physical-inventory-print, #physical-inventory-print * { visibility: visible !important; }
        #physical-inventory-print { display: block !important; position: absolute !important; inset: 0 !important; width: 100% !important; color: #111827 !important; background: white !important; }
        #physical-inventory-print table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; }
        #physical-inventory-print th, #physical-inventory-print td { border: 1px solid #9ca3af !important; padding: 4px 6px !important; }
        #physical-inventory-print thead { display: table-header-group !important; }
        #physical-inventory-print tr { break-inside: avoid !important; }
      }
    `}</style>
    <PageHeader eyebrow="Inventario" title="Inventario físico" description="Cuenta todos los productos en una hoja tipo Excel. Guardar crea un reporte y no modifica las existencias." button={<div className="flex gap-2"><button type="button" onClick={() => window.print()} disabled={!printProducts.length} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ClipboardList size={15} /> Imprimir Reporte</button><button type="button" onClick={submit} disabled={saving || loading || !countedProducts.length} className={action}><Save size={15} />{saving ? 'Guardando…' : 'Guardar Inventario'}</button></div>} />
    <section className={card}>
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><label className="w-full max-w-md text-xs font-semibold text-slate-600">Buscar por nombre o código<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Escribe nombre o código de barras…" className={input} /></label><div className="flex flex-wrap gap-3 text-xs"><span className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">Productos: <strong>{products.length}</strong></span><span className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">Contados: <strong>{countedProducts.length}</strong></span><span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Diferencias +: <strong>{money(positiveTotal)}</strong></span><span className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">Diferencias −: <strong>{money(Math.abs(negativeTotal))}</strong></span></div></div>
      {loading ? <Spinner label="Cargando todos los productos activos…" /> : !products.length ? <p className="p-8 text-center text-sm text-slate-500">No hay productos activos para contar.</p> : !filteredProducts.length ? <p className="p-8 text-center text-sm text-slate-500">No hay productos que coincidan con la búsqueda.</p> : (
        <form onSubmit={submit}>
          <div className="max-h-[calc(100vh-330px)] min-h-[360px] overflow-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600 shadow-sm"><tr><th className="border-b border-slate-200 px-3 py-3">Código</th><th className="border-b border-slate-200 px-3 py-3">Producto</th><th className="border-b border-slate-200 px-3 py-3 text-right">Stock Sistema</th><th className="border-b border-slate-200 px-3 py-3 text-right">Saldo Físico</th><th className="border-b border-slate-200 px-3 py-3 text-right">Ajuste</th><th className="border-b border-slate-200 px-3 py-3 text-right">Costo Unitario</th><th className="border-b border-slate-200 px-3 py-3 text-right">Total Ajuste (Bs)</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredProducts.map((product, index) => {
                const difference = adjustmentValue(product);
                const total = adjustmentTotal(product);
                return <tr key={product.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-emerald-50/60">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-500">{product.codigo_barras || '—'}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{product.nombre}<span className="ml-1 font-normal text-slate-500">{product.presentacion || ''}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{Number(product.stock_sistema).toLocaleString('es-BO')}</td>
                  <td className="px-3 py-1.5 text-right"><input ref={(element) => { inputRefs.current[index] = element; }} aria-label={`Saldo físico de ${product.nombre}`} type="number" min="0" step="0.01" value={product.saldo_fisico} onChange={(event) => updateCount(product.id, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); focusNext(index); } }} className="h-9 w-28 rounded-md border border-slate-200 bg-white px-2 text-right text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${difference < 0 ? 'text-rose-600' : difference > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{difference > 0 ? '+' : ''}{product.saldo_fisico === '' ? '' : difference.toLocaleString('es-BO')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(product.costo)}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${total < 0 ? 'text-rose-600' : total > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{product.saldo_fisico === '' ? '' : money(total)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500"><span>Presiona Enter en un saldo físico para avanzar a la siguiente fila.</span><span>Este conteo es solo un reporte; para modificar stock usa Ajustes Positivos/Negativos.</span></div>
        </form>
      )}
    </section>
    <div id="physical-inventory-print" className="hidden">
      <header style={{ marginBottom: '18px', borderBottom: '2px solid #111827', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{business?.nombre || 'Finora POS'}</h1>
        <h2 style={{ margin: '6px 0', fontSize: '16px' }}>REPORTE DE INVENTARIO FÍSICO</h2>
        <p style={{ margin: 0, fontSize: '10px' }}>Fecha: {new Date().toLocaleString('es-BO')} · Productos contados: {printProducts.length}</p>
      </header>
      <table>
        <thead><tr><th>Código</th><th>Producto / Presentación</th><th>Stock Sistema</th><th>Saldo Físico</th><th>Ajuste</th><th>Costo Unitario</th><th>Total Ajuste (Bs)</th></tr></thead>
        <tbody>{printProducts.map((product) => {
          const difference = adjustmentValue(product);
          const total = adjustmentTotal(product);
          return <tr key={product.id}>
            <td>{product.codigo_barras || '—'}</td><td>{product.nombre} {product.presentacion || ''}</td>
            <td style={{ textAlign: 'right' }}>{product.stock_sistema}</td><td style={{ textAlign: 'right' }}>{product.saldo_fisico}</td>
            <td style={{ textAlign: 'right', color: difference < 0 ? '#b91c1c' : difference > 0 ? '#047857' : '#6b7280' }}>{difference > 0 ? '+' : ''}{difference}</td>
            <td style={{ textAlign: 'right' }}>{money(product.costo)}</td>
            <td style={{ textAlign: 'right', color: total < 0 ? '#b91c1c' : total > 0 ? '#047857' : '#6b7280' }}>{money(total)}</td>
          </tr>;
        })}</tbody>
      </table>
      <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '28px', marginTop: '14px', fontSize: '12px', fontWeight: 700 }}>
        <span style={{ color: '#047857' }}>Ajustes positivos: {money(positiveTotal)}</span>
        <span style={{ color: '#b91c1c' }}>Ajustes negativos: {money(Math.abs(negativeTotal))}</span>
      </footer>
    </div>
    <section className={card}>
      <header className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Reportes guardados</h2><p className="mt-1 text-xs text-slate-500">Los reportes no alteran existencias ni se agregan al Kardex.</p></header>
      {!reports.length ? <p className="p-8 text-center text-sm text-slate-500">Todavía no hay reportes de inventario físico.</p> : <div className="divide-y divide-slate-100">{reports.map((report) => <details key={report.id} className="group p-4"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-800">{new Date(report.creado_en).toLocaleString('es-BO')}</p><p className="mt-1 text-xs text-slate-500">{report.motivo} · {report.detalles.length} productos · {report.usuario_nombre}</p></div><span className="text-xs font-semibold text-emerald-700 group-open:hidden">Ver diferencias</span><span className="hidden text-xs font-semibold text-slate-500 group-open:inline">Ocultar</span></summary><div className="mt-3 overflow-x-auto rounded-lg border border-slate-100"><table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Sistema</th><th className="px-3 py-2 text-right">Contado</th><th className="px-3 py-2 text-right">Diferencia</th><th className="px-3 py-2 text-right">Total ajuste</th></tr></thead><tbody className="divide-y divide-slate-100">{report.detalles.map((item) => <tr key={item.producto_id}><td className="px-3 py-2 font-mono">{item.codigo_barras || '—'}</td><td className="px-3 py-2">{item.producto_nombre} {item.presentacion}</td><td className="px-3 py-2 text-right">{item.saldo_sistema}</td><td className="px-3 py-2 text-right">{item.saldo_contado}</td><td className={`px-3 py-2 text-right font-semibold ${Number(item.diferencia) < 0 ? 'text-rose-600' : Number(item.diferencia) > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{Number(item.diferencia) > 0 ? '+' : ''}{item.diferencia}</td><td className="px-3 py-2 text-right">{money(Number(item.diferencia) * Number(item.costo_unitario))}</td></tr>)}</tbody></table></div></details>)}</div>}
    </section>
  </div>;
}

function InventoryAdjustmentsPage({ type, negocioId, products, canAdjust, notify, onRefresh }) {
  const adjustmentType = type;
  const positive = adjustmentType === 'positivo';
  const Icon = positive ? ArrowUp : ArrowDown;
  const [form, setForm] = useState({ producto_id: '', cantidad: '', motivo: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api(`/api/inventario/ajustes?tipo=${adjustmentType}`, { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [adjustmentType, negocioId, notify]);
  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/api/inventario/ajustes', {
        method: 'POST',
        negocioId,
        body: JSON.stringify({ ...form, cantidad: Number(form.cantidad), tipo: adjustmentType }),
      });
      notify(`Ajuste ${positive ? 'positivo' : 'negativo'} aplicado y registrado en el Kardex.`);
      setForm({ producto_id: '', cantidad: '', motivo: '' });
      setSelectedProduct(null);
      await Promise.all([load(), onRefresh()]);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const buttonClass = positive
    ? 'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60'
    : 'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60';

  return <div className="space-y-5">
    <PageHeader eyebrow="Inventario" title={`Ajustes ${positive ? 'Positivos' : 'Negativos'}`} description={positive ? 'Registra entradas manuales para corregir existencias.' : 'Registra salidas manuales como mermas o productos vencidos.'} />
    <section className={`${card} p-5 sm:p-7`}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 text-xs font-semibold text-slate-600"><label htmlFor="inventory-adjust-product-search">Producto *</label><ProductCombobox id="inventory-adjust-product-search" negocioId={negocioId} selectedProduct={selectedProduct} onSelect={(product) => { setSelectedProduct(product); setForm({ ...form, producto_id: product.id }); }} onClear={() => { setSelectedProduct(null); setForm({ ...form, producto_id: '' }); }} notify={notify} /></div>
        {selectedProduct && <p className="-mt-2 text-xs font-medium text-slate-500 sm:col-span-2">Stock actual: <span className="font-bold text-slate-800">{selectedProduct.stock}</span></p>}
        <Field label="Cantidad *"><input required type="number" min="0.01" step="0.01" className={input} value={form.cantidad} onChange={(event) => setForm({ ...form, cantidad: event.target.value })} placeholder="0.00" /></Field>
        <Field label="Motivo *"><input required maxLength={300} className={input} value={form.motivo} onChange={(event) => setForm({ ...form, motivo: event.target.value })} placeholder={positive ? 'Ej. Error de conteo, devolución' : 'Ej. Merma, robo, vencimiento'} /></Field>
        <div className="flex items-end"><button disabled={!canAdjust || saving || !products.length} className={buttonClass}><Icon size={16} />{saving ? 'Aplicando…' : `Aplicar ajuste ${positive ? 'positivo' : 'negativo'}`}</button></div>
        {!canAdjust && <p className="text-xs text-amber-700 sm:col-span-2">No tienes permiso para modificar existencias.</p>}
      </form>
    </section>
    <section className={card}>
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className={`grid h-9 w-9 place-items-center rounded-lg ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}><Icon size={17} /></span><div><h2 className="text-sm font-bold text-slate-900">Historial de ajustes {positive ? 'positivos' : 'negativos'}</h2><p className="mt-1 text-xs text-slate-500">Los movimientos aplicados quedan registrados en el Kardex.</p></div></header>
      {loading ? <Spinner label="Cargando ajustes…" /> : !rows.length ? <p className="p-8 text-center text-sm text-slate-500">No hay ajustes de este tipo registrados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Usuario</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(row.creado_en)}</td><td className="px-4 py-3 font-semibold text-slate-800">{row.producto_nombre}</td><td className={`px-4 py-3 text-right font-bold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>{positive ? '+' : '−'}{Math.abs(Number(row.cantidad))}</td><td className="px-4 py-3 text-slate-600">{row.motivo}</td><td className="px-4 py-3 text-slate-600">{row.usuario_nombre}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function ProductCombobox({ id, negocioId, selectedProduct, onSelect, onClear, notify }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = query.trim();
    if (!search || selectedProduct) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search, autocomplete: '1' });
        const productsFound = await api(`/api/productos?${params}`, { negocioId });
        if (active) {
          setResults(productsFound);
          setOpen(true);
        }
      } catch (error) {
        if (active) notify(error.message, 'error');
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [negocioId, notify, query, selectedProduct]);

  function choose(product) {
    onSelect(product);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function clearSelection() {
    onClear();
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return <div className="relative">
    <input
      id={id}
      required
      autoComplete="off"
      value={selectedProduct ? `${selectedProduct.nombre} · ${selectedProduct.codigo_barras || 'Sin código'}` : query}
      onChange={(event) => {
        if (selectedProduct) clearSelection();
        const nextQuery = event.target.value;
        setQuery(nextQuery);
        setResults([]);
        setOpen(Boolean(nextQuery.trim()));
      }}
      onFocus={() => { if (!selectedProduct && query.trim()) setOpen(true); }}
      placeholder="Buscar por nombre o código de barras…"
      className={input}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={`${id}-results`}
    />
    {selectedProduct && <button type="button" onClick={clearSelection} aria-label="Cambiar producto" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">Cambiar</button>}
    {!selectedProduct && open && (query.trim() || loading) && <ul id={`${id}-results`} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
      {loading && <li className="px-3 py-2 text-xs font-normal text-slate-500">Buscando productos…</li>}
      {!loading && results.map((product) => <li key={product.id} role="option" aria-selected="false">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(product)} className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-emerald-50">
          <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{product.nombre}</span><span className="mt-0.5 block text-[10px] font-normal text-slate-500">{product.codigo_barras || 'Sin código'}</span></span>
          <span className="shrink-0 text-[10px] font-semibold text-slate-600">Stock: {product.stock}</span>
        </button>
      </li>)}
      {!loading && query.trim() && results.length === 0 && <li className="px-3 py-2 text-xs font-normal text-slate-500">No se encontraron productos.</li>}
    </ul>}
  </div>;
}

function ProfilePage({ user, notify, onRefresh }) {
  const [form, setForm] = useState({ nombre: user.nombre, email: user.email, current_password: '', new_password: '' });
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const body = { nombre: form.nombre, email: form.email };
    if (form.new_password) {
      body.current_password = form.current_password;
      body.new_password = form.new_password;
    }
    try {
      await api('/api/perfil', { method: 'PATCH', body: JSON.stringify(body) });
      notify('Perfil actualizado.');
      setForm({ ...form, current_password: '', new_password: '' });
      await onRefresh();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  }
  return <div className="space-y-5">
    <PageHeader eyebrow="Cuenta" title="Perfil de usuario" description="Actualiza tus datos y cambia tu contraseña personal." />
    <section className={`${card} max-w-2xl p-5 sm:p-7`}><div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Users size={19} /></span><div><p className="font-semibold text-slate-900">{user.nombre}</p><p className="text-xs capitalize text-slate-500">{user.role}</p></div></div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre"><input required maxLength={150} className={input} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="Correo"><input required type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><Field label="Contraseña actual"><input type="password" autoComplete="current-password" className={input} value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} /></Field><Field label="Nueva contraseña"><input type="password" autoComplete="new-password" minLength={12} className={input} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} placeholder="Mínimo 12 caracteres" /></Field></div>
        <button disabled={saving} className={action}><Save size={15} />{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </form>
    </section>
  </div>;
}

function Field({ label, className = '', children }) {
  return <label className={`block space-y-1.5 text-xs font-semibold text-slate-600 ${className}`}>{label}{children}</label>;
}

function FormActions({ saving, close }) {
  return <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={close} className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button disabled={saving} className={action}><Save size={14} />{saving ? 'Guardando…' : 'Guardar'}</button></div>;
}

function Modal({ title, close, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section role="dialog" aria-modal="true" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">{title}</h2><button type="button" onClick={close} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">×</button></header>{children}</section></div>;
}
