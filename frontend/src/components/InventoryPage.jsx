import { useEffect, useMemo, useState } from 'react';
import { Boxes, Eye, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { api, assetUrl } from '../api.js';
import Spinner from './Spinner.jsx';
import ReportActions from './ReportActions.jsx';

const money = (value) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0);
const emptyProduct = {
  nombre: '', codigo_barras: '', precio_compra: '', precio_venta: '', precio_mayorista: '',
  descripcion_larga: '', especificaciones: '',
  en_oferta: false, precio_oferta: '',
  stock_actual: '0', stock_minimo: '5', categoria_id: '', marca_id: '', presentacion_id: '', proveedor_id: '', imagen_url: '', fecha_vencimiento: '',
};
const catalogMeta = {
  brands: { endpoint: '/api/marcas', singular: 'marca', title: 'Marcas', subtitle: 'Administra las marcas del catálogo de productos.', icon: Tags },
  presentations: { endpoint: '/api/presentaciones', singular: 'presentación', title: 'Presentaciones', subtitle: 'Define formatos y unidades de tus productos.', icon: Boxes },
};

function InventoryTabs({ view, onNavigate }) {
  const tabs = [
    { id: 'products', label: 'Productos' },
    { id: 'brands', label: 'Marcas' },
    { id: 'presentations', label: 'Presentaciones' },
  ];
  return (
    <nav aria-label="Secciones de inventario" className="flex gap-1 overflow-x-auto border-b border-gray-100">
      {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => onNavigate(tab.id)} aria-current={view === tab.id ? 'page' : undefined} className={`whitespace-nowrap border-b-2 px-4 py-3 text-[13px] font-semibold ${view === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}
    </nav>
  );
}

function ProductFormModal({ negocioId, notify, onClose, onSaved, product = null }) {
  const [form, setForm] = useState(product ? {
    ...emptyProduct,
    ...product,
    precio_compra: String(product.precio_compra ?? ''),
    precio_venta: String(product.precio_venta ?? ''),
    descripcion_larga: String(product.descripcion_larga ?? ''),
    especificaciones: String(product.especificaciones ?? ''),
    en_oferta: product.en_oferta === true,
    precio_oferta: product.precio_oferta == null ? '' : String(product.precio_oferta),
    precio_mayorista: product.precio_mayorista == null ? '' : String(product.precio_mayorista),
    stock_actual: String(product.stock_actual ?? '0'),
    stock_minimo: String(product.stock_minimo ?? '5'),
    categoria_id: product.categoria_id || '',
    marca_id: product.marca_id || '',
    presentacion_id: product.presentacion_id || '',
    proveedor_id: product.proveedor_id || '',
    fecha_vencimiento: product.fecha_vencimiento ? String(product.fecha_vencimiento).slice(0, 10) : '',
  } : emptyProduct);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [lookups, setLookups] = useState({ categories: [], brands: [], presentations: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api('/api/categorias', { negocioId }),
      api('/api/marcas', { negocioId }),
      api('/api/presentaciones', { negocioId }),
      api('/api/proveedores', { negocioId }),
    ]).then(([categories, brands, presentations, suppliers]) => {
      if (active) setLookups({ categories, brands, presentations, suppliers });
    }).catch((error) => { if (active) notify(error.message, 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [negocioId, notify]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      const { imagen_url: _currentImageUrl, ...productFields } = form;
      const fields = {
        ...productFields,
        precio_compra: Number(form.precio_compra || 0),
        precio_venta: Number(form.precio_venta),
        en_oferta: form.en_oferta ? 'true' : 'false',
        precio_oferta: form.en_oferta ? Number(form.precio_oferta) : '',
        precio_mayorista: form.precio_mayorista ? Number(form.precio_mayorista) : '',
        stock_actual: Number(form.stock_actual || 0),
        stock_minimo: Number(form.stock_minimo || 0),
        categoria_id: form.categoria_id || '',
        marca_id: form.marca_id || '',
        presentacion_id: form.presentacion_id || '',
        proveedor_id: form.proveedor_id || '',
        fecha_vencimiento: form.fecha_vencimiento || '',
        quitar_imagen: removeImage ? 'true' : 'false',
      };
      Object.entries(fields).forEach(([key, value]) => body.append(key, value == null ? '' : String(value)));
      if (imageFile) body.append('imagen', imageFile);
      const result = await api(product ? `/api/productos/${product.id}` : '/api/productos', {
        method: product ? 'PUT' : 'POST',
        negocioId,
        body,
      });
      if (!result?.id) throw new Error('El servidor no confirmó el producto guardado.');
      notify(product ? 'Producto actualizado correctamente.' : 'Producto registrado correctamente.');
      await onSaved();
      onClose();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = 'mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';
  return (
    <Modal title={product ? 'Editar producto' : 'Registrar producto'} subtitle={product ? 'Actualiza los datos e imagen del producto.' : 'Añade un artículo al catálogo y define sus niveles de inventario.'} onClose={onClose}>
      {loading ? <Spinner label="Cargando catálogos…" /> : (
        <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Nombre del producto *
            <input autoFocus required maxLength="150" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className={fieldClass} placeholder="Ej. Café molido 250 g" />
          </label>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">Imagen del producto (JPG, PNG o WebP; máximo 5 MB)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setImageFile(event.target.files?.[0] || null); setRemoveImage(false); }} className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700`} />
            </label>
            {(previewUrl || (form.imagen_url && !removeImage)) && <div className="mt-3 flex items-center gap-3">
              <img src={previewUrl || assetUrl(form.imagen_url)} alt="Vista previa del producto" className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
              {product && <button type="button" onClick={() => { setImageFile(null); setRemoveImage(true); }} className="text-xs font-semibold text-rose-600 hover:text-rose-700">Quitar imagen</button>}
            </div>}
          </div>
          <label className="text-xs font-semibold text-slate-600">Código de barras
            <input maxLength="50" value={form.codigo_barras} onChange={(event) => setForm({ ...form, codigo_barras: event.target.value })} className={fieldClass} placeholder="Escanea o ingresa el código" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Categoría
            <select value={form.categoria_id} onChange={(event) => setForm({ ...form, categoria_id: event.target.value })} className={fieldClass}><option value="">Sin categoría</option>{lookups.categories.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Marca
            <select value={form.marca_id} onChange={(event) => setForm({ ...form, marca_id: event.target.value })} className={fieldClass}><option value="">Sin marca</option>{lookups.brands.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Presentación
            <select value={form.presentacion_id} onChange={(event) => setForm({ ...form, presentacion_id: event.target.value })} className={fieldClass}><option value="">Sin presentación</option>{lookups.presentations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Proveedor
            <select value={form.proveedor_id} onChange={(event) => setForm({ ...form, proveedor_id: event.target.value })} className={fieldClass}><option value="">Sin proveedor</option>{lookups.suppliers.map((item) => <option key={item.id} value={item.id}>{item.nombre_empresa}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Costo de compra
            <input type="number" min="0" step="0.01" value={form.precio_compra} onChange={(event) => setForm({ ...form, precio_compra: event.target.value })} className={fieldClass} placeholder="0.00" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Precio de venta *
            <input required type="number" min="0" step="0.01" value={form.precio_venta} onChange={(event) => setForm({ ...form, precio_venta: event.target.value })} className={fieldClass} placeholder="0.00" />
          </label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Descripción larga
            <textarea maxLength={5000} rows={4} value={form.descripcion_larga} onChange={(event) => setForm({ ...form, descripcion_larga: event.target.value })} className={`${fieldClass} resize-y py-2`} placeholder="Describe el producto, sus usos y características principales." />
          </label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Especificaciones
            <textarea maxLength={3000} rows={3} value={form.especificaciones} onChange={(event) => setForm({ ...form, especificaciones: event.target.value })} className={`${fieldClass} resize-y py-2`} placeholder={'Ej. Peso: 1 kg\nOrigen: Local'} />
          </label>
          <label className="flex items-center gap-2 self-end pb-3 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={form.en_oferta} onChange={(event) => setForm({ ...form, en_oferta: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Publicar como oferta
          </label>
          {form.en_oferta && <label className="text-xs font-semibold text-slate-600">Precio de oferta *
            <input required type="number" min="0" max={form.precio_venta || undefined} step="0.01" value={form.precio_oferta} onChange={(event) => setForm({ ...form, precio_oferta: event.target.value })} className={fieldClass} placeholder="Menor al precio de venta" />
          </label>}
          <label className="text-xs font-semibold text-slate-600">Precio mayorista
            <input type="number" min="0" step="0.01" value={form.precio_mayorista} onChange={(event) => setForm({ ...form, precio_mayorista: event.target.value })} className={fieldClass} placeholder="Opcional" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Stock inicial
            <input type="number" min="0" step="0.01" value={form.stock_actual} onChange={(event) => setForm({ ...form, stock_actual: event.target.value })} className={fieldClass} />
          </label>
          <label className="text-xs font-semibold text-slate-600">Alerta de stock mínimo
            <input type="number" min="0" step="0.01" value={form.stock_minimo} onChange={(event) => setForm({ ...form, stock_minimo: event.target.value })} className={fieldClass} />
          </label>
          <label className="text-xs font-semibold text-slate-600">Fecha de vencimiento inicial
            <input type="date" value={form.fecha_vencimiento || ''} onChange={(event) => setForm({ ...form, fecha_vencimiento: event.target.value })} className={fieldClass} />
          </label>
          <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-4 sm:col-span-2">
            <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{saving ? 'Guardando…' : 'Guardar producto'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6"><div><h2 id="modal-title" className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Cerrar modal" className="rounded-md p-2 text-slate-400 hover:bg-gray-100"><X size={16} /></button></header>
        {children}
      </section>
    </div>
  );
}

function ProductList({ products, negocioId, business, notify, onRefresh, canManage }) {
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return products.filter((product) => !text || `${product.nombre} ${product.codigo_barras || ''}`.toLocaleLowerCase().includes(text));
  }, [products, query]);
  const productColumns = [
    { label: 'Código', value: (product) => product.codigo_barras || '—' },
    { label: 'Producto', value: (product) => product.nombre },
    { label: 'Categoría', value: (product) => product.categoria_nombre || '—' },
    { label: 'Marca', value: (product) => product.marca_nombre || '—' },
    { label: 'Costo', value: (product) => Number(product.precio_compra || 0) },
    { label: 'Precio de venta', value: (product) => Number(product.precio_venta || 0) },
    { label: 'Stock', value: (product) => Number(product.stock_actual || 0) },
    { label: 'Estado', value: (product) => product.activo === false ? 'Inactivo' : 'Activo' },
  ];
  async function removeProduct(product) {
    if (!window.confirm(`¿Desactivar "${product.nombre}"? Dejará de estar disponible para nuevas ventas, pero se conservará en el historial.`)) return;
    try {
      await api(`/api/productos/${product.id}`, { method: 'DELETE', negocioId });
      notify('Producto desactivado; se conservaron sus registros históricos.');
      await onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  }
  return (
    <>
      <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div><h2 className="text-sm font-bold text-slate-900">Catálogo de productos</h2><p className="mt-1 text-xs text-slate-400">{products.length} artículos registrados</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre o código…" className="min-h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-emerald-500 sm:w-64" />
          <ReportActions title="Catálogo de Productos" business={business} rows={filtered} columns={productColumns} fileName="catalogo-productos" sheetName="Productos" orientation="portrait" />
          {canManage && <button type="button" onClick={() => setModal(true)} className="flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus size={15} /> Nuevo producto</button>}
        </div>
      </div>
      {!filtered.length ? <div className="px-5 py-14 text-center"><p className="text-sm font-semibold text-slate-700">{query ? 'Sin resultados' : 'Inventario vacío'}</p><p className="mt-1 text-xs text-slate-400">{query ? 'Prueba con otro término de búsqueda.' : 'Registra productos para comenzar.'}</p></div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-[13px]">
            <thead className="border-y border-gray-100 bg-gray-50/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Producto</th><th className="px-5 py-3 font-semibold">Categoría / Marca</th><th className="px-5 py-3 text-right font-semibold">Costo</th><th className="px-5 py-3 text-right font-semibold">Precio</th><th className="px-5 py-3 text-right font-semibold">Stock</th><th className="px-5 py-3 text-right font-semibold">Estado</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{filtered.map((product) => {
              const inactive = product.activo === false;
              const lowStock = !inactive && Number(product.stock_actual) <= Number(product.stock_minimo);
              return <tr key={product.id} className="hover:bg-gray-50/70"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">{product.imagen_url ? <img src={assetUrl(product.imagen_url)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-slate-400">Sin foto</div>}</div><div><p className="font-semibold text-slate-800">{product.nombre}</p><p className="mt-0.5 text-[11px] text-slate-400">{product.codigo_barras || 'Sin código'}</p></div></div></td><td className="px-5 py-3.5 text-slate-600">{product.categoria_nombre || '—'}{product.marca_nombre ? <span className="block text-[11px] text-slate-400">{product.marca_nombre}</span> : null}</td><td className="px-5 py-3.5 text-right text-slate-500">{money(product.precio_compra)}</td><td className="px-5 py-3.5 text-right font-semibold text-slate-800">{money(product.precio_venta)}</td><td className="px-5 py-3.5 text-right font-medium text-slate-700">{product.stock_actual} <span className="text-slate-400">{product.presentacion_nombre || ''}</span></td><td className="px-5 py-3.5 text-right"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${inactive ? 'bg-gray-100 text-slate-500' : lowStock ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{inactive ? 'Inactivo' : lowStock ? 'Stock crítico' : 'Disponible'}</span></td><td className="px-5 py-3.5 text-right"><button type="button" title={`Ver ${product.nombre}`} aria-label={`Ver ${product.nombre}`} onClick={() => setViewingProduct(product)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye size={16} /></button>{canManage && <><button type="button" title={`Editar ${product.nombre}`} aria-label={`Editar ${product.nombre}`} onClick={() => setEditingProduct(product)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Pencil size={16} /></button>{!inactive && <button type="button" title={`Desactivar ${product.nombre}`} aria-label={`Desactivar ${product.nombre}`} onClick={() => removeProduct(product)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>}</>}</td></tr>;
            })}</tbody>
          </table>
        </div>
      )}
      {modal && <ProductFormModal key="new-product" negocioId={negocioId} notify={notify} onClose={() => setModal(false)} onSaved={onRefresh} />}
      {editingProduct && <ProductFormModal key={editingProduct.id} product={editingProduct} negocioId={negocioId} notify={notify} onClose={() => setEditingProduct(null)} onSaved={onRefresh} />}
      {viewingProduct && <Modal title="Detalle del producto" onClose={() => setViewingProduct(null)}><div className="space-y-3 p-5 text-sm">{viewingProduct.imagen_url && <img src={assetUrl(viewingProduct.imagen_url)} alt={viewingProduct.nombre} className="mx-auto max-h-48 rounded-lg object-contain" />}{[['Nombre', viewingProduct.nombre], ['Código de barras', viewingProduct.codigo_barras], ['Categoría', viewingProduct.categoria_nombre], ['Marca', viewingProduct.marca_nombre], ['Presentación', viewingProduct.presentacion_nombre], ['Costo', money(viewingProduct.precio_compra)], ['Precio de venta', money(viewingProduct.precio_venta)], ['Stock', viewingProduct.stock_actual], ['Estado', viewingProduct.activo === false ? 'Inactivo' : 'Activo']].map(([label, value]) => <p key={label}><span className="text-slate-500">{label}:</span> <strong className="text-slate-800">{value || '—'}</strong></p>)}</div></Modal>}
    </>
  );
}

function ReferenceCatalog({ type, negocioId, notify, canManage }) {
  const meta = catalogMeta[type];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api(meta.endpoint, { negocioId }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [negocioId, type]);

  function start(item = null) {
    setRecord(item || {});
    setName(item?.nombre || '');
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const editing = Boolean(record?.id);
      await api(editing ? `${meta.endpoint}/${record.id}` : meta.endpoint, { method: editing ? 'PUT' : 'POST', negocioId, body: JSON.stringify({ nombre: name }) });
      setName('');
      setRecord(null);
      notify(`${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} ${editing ? 'actualizada' : 'creada'} correctamente.`);
      await load();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`¿Eliminar ${meta.singular} "${item.nombre}"?`)) return;
    try {
      await api(`${meta.endpoint}/${item.id}`, { method: 'DELETE', negocioId });
      notify(`${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} eliminada correctamente.`);
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-bold text-slate-900">{meta.title} registradas</h2><p className="mt-1 text-xs text-slate-400">{rows.length} elementos en este negocio</p></div>{canManage && <button type="button" onClick={() => start()} className="flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"><Plus size={15} /> Nueva {meta.singular}</button>}</div>
      {loading ? <Spinner label={`Cargando ${meta.title.toLocaleLowerCase()}…`} /> : rows.length === 0 ? <div className="px-5 py-14 text-center"><p className="text-sm font-semibold text-slate-700">Aún no hay {meta.title.toLocaleLowerCase()}</p><p className="mt-1 text-xs text-slate-400">Agrega elementos para asociarlos a tus productos.</p></div> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-[13px]"><thead className="border-y border-gray-100 bg-gray-50/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Nombre</th><th className="px-5 py-3 text-right font-semibold">Productos asociados</th><th className="px-5 py-3 text-right font-semibold">Identificador</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody className="divide-y divide-gray-50">{rows.map((row) => { const Icon = meta.icon; return <tr key={row.id} className="hover:bg-gray-50/70"><td className="px-5 py-4"><span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon size={16} /></span><span className="font-semibold text-slate-800">{row.nombre}</span></td><td className="px-5 py-4 text-right text-slate-600">{row.productos}</td><td className="px-5 py-4 text-right font-mono text-[11px] text-slate-400">{row.id.slice(0, 8)}</td><td className="px-5 py-4 text-right"><button type="button" title={`Ver ${row.nombre}`} aria-label={`Ver ${row.nombre}`} onClick={() => setViewing(row)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye size={15} /></button>{canManage && <><button type="button" title={`Editar ${row.nombre}`} aria-label={`Editar ${row.nombre}`} onClick={() => start(row)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Pencil size={15} /></button><button type="button" title={`Eliminar ${row.nombre}`} aria-label={`Eliminar ${row.nombre}`} onClick={() => remove(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button></>}</td></tr>; })}</tbody></table></div>
      )}
      {record !== null && <Modal title={`${record.id ? 'Editar' : 'Nueva'} ${meta.singular}`} subtitle="Este registro quedará asociado al negocio actual." onClose={() => setRecord(null)}><form onSubmit={submit} className="p-5 sm:p-6"><label className="block text-xs font-semibold text-slate-600">Nombre<input autoFocus required maxLength="100" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-emerald-500" /></label><div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setRecord(null)} className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-slate-600">Cancelar</button><button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button></div></form></Modal>}
      {viewing && <Modal title={`Detalle de ${meta.singular}`} onClose={() => setViewing(null)}><div className="space-y-3 p-5 text-sm"><p><span className="text-slate-500">Nombre:</span> <strong className="text-slate-800">{viewing.nombre}</strong></p><p><span className="text-slate-500">Productos asociados:</span> <strong className="text-slate-800">{viewing.productos}</strong></p><p className="break-all text-xs text-slate-400">ID: {viewing.id}</p></div></Modal>}
    </>
  );
}

export default function InventoryPage({ view, products, negocioId, business, canManage, onRefresh, notify, onNavigate }) {
  return (
    <div className="space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Catálogo</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Inventario</h1><p className="mt-1 text-sm text-slate-500">Productos, marcas y presentaciones de tu negocio.</p></div>
      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <InventoryTabs view={view} onNavigate={onNavigate} />
        {view === 'products' ? <ProductList products={products} negocioId={negocioId} business={business} notify={notify} onRefresh={onRefresh} canManage={canManage} /> : <ReferenceCatalog key={view} type={view} negocioId={negocioId} notify={notify} canManage={canManage} />}
      </section>
    </div>
  );
}
