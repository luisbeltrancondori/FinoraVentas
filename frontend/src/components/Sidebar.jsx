import { useEffect, useState } from 'react';
import {
  Archive, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpRight, Boxes, Building2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  FileText, HelpCircle, Image, LayoutDashboard, LogOut, Package, PanelsTopLeft, Shield, ShoppingCart, Tag, Tags, UserRound, Users, Wallet, X,
} from 'lucide-react';
import HelpCenterModal from './HelpCenterModal.jsx';

const groups = [
  { title: null, items: [{ id: 'dashboard', label: 'Resumen', icon: LayoutDashboard, permission: 'dashboard.read' }] },
  { title: null, items: [{ id: 'reports', label: 'Reportes', icon: FileText, permission: 'reports.read' }] },
  { title: null, items: [{ id: 'cash', label: 'Caja y turno', icon: Wallet, permission: 'cash.read' }] },
  { title: 'Ventas', icon: ArrowUpRight, items: [
    { id: 'pos', label: 'Nueva venta / POS', icon: ShoppingCart, permission: 'sales.write' },
    { id: 'sales', label: 'Historial de ventas', icon: ArrowUpRight, permission: 'sales.read' },
    { id: 'proformas', label: 'Proformas Web', icon: ClipboardList, permission: 'sales.read' },
    { id: 'clients', label: 'Clientes', icon: Users, permission: 'sales.read' },
  ] },
  { title: 'Compras', icon: ArrowDownToLine, items: [
    { id: 'purchase-new', label: 'Nueva compra', icon: ArrowDownToLine, permission: 'purchases.write' },
    { id: 'purchases', label: 'Historial de compras', icon: ClipboardList, permission: 'purchases.read' },
  ] },
  { title: 'Productos', icon: Package, items: [
    { id: 'products', label: 'Catálogo general', icon: Package, permission: 'products.read' },
    { id: 'categories', label: 'Categorías', icon: Tag, permission: 'products.read' },
    { id: 'brands', label: 'Marcas', icon: Tags, permission: 'products.read' },
    { id: 'presentations', label: 'Presentaciones', icon: Boxes, permission: 'products.read' },
    { id: 'suppliers', label: 'Proveedores', icon: Building2, permission: 'products.read' },
  ] },
  { title: 'Inventario', icon: Archive, items: [
    { id: 'kardex', label: 'Kardex', icon: ClipboardList, permission: 'inventory.read' },
    { id: 'physical', label: 'Inventario físico', icon: Boxes, permission: 'inventory.write' },
    { id: 'adjust-positive', label: 'Ajustes Positivos', icon: ArrowUp, permission: 'inventory.write' },
    { id: 'adjust-negative', label: 'Ajustes Negativos', icon: ArrowDown, permission: 'inventory.write' },
  ] },
  { title: 'Configuración y administración', icon: Shield, adminOnly: true, items: [
    { id: 'branches', label: 'Sucursales / negocios', icon: Building2 },
    { id: 'users', label: 'Usuarios, roles y permisos', icon: Users },
    { id: 'banners', label: 'Banners / Carrusel', icon: Image },
    { id: 'profile', label: 'Perfil de usuario', icon: UserRound, anyRole: true },
  ] },
];

function Navigation({ page, onNavigate, user, compact = false, collapsed = false }) {
  const [expanded, setExpanded] = useState(() => {
    const active = groups.find((group) => group.items.some((item) => item.id === page));
    return active?.title || '';
  });
  const permissions = user.permisos || [];
  const administrator = user.role === 'administrador' || permissions.includes('*');
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => (
      (item.anyRole || administrator && group.adminOnly || !group.adminOnly)
      && (!item.permission || administrator || permissions.includes(item.permission))
    )),
  })).filter((group) => group.items.length > 0);

  if (collapsed && !compact) {
    return <div className="space-y-1">
      {visibleGroups.flatMap((group) => group.items).map((item) => {
        const Icon = item.icon;
        const active = page === item.id;
        return <button key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={active ? 'page' : undefined} aria-label={item.label} title={item.label} className={`group relative flex min-h-11 w-full items-center justify-center rounded-lg transition ${active ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
          {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r bg-emerald-400" />}
          <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>;
      })}
    </div>;
  }

  return <div className={compact ? 'flex min-w-max gap-1' : 'space-y-1'}>
    {visibleGroups.map((group, index) => {
      const activeGroup = group.items.some((item) => item.id === page);
      const expandable = Boolean(group.title);
      const isExpanded = expandable && expanded === group.title;
      if (!expandable) {
        const item = group.items[0];
        const Icon = item.icon;
        const active = page === item.id;
        return <button type="button" key={item.id} onClick={() => onNavigate(item.id)} aria-current={active ? 'page' : undefined} className={`${compact ? 'shrink-0 whitespace-nowrap' : 'w-full'} group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium transition ${active ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
          {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r bg-emerald-400" />}
          <Icon aria-hidden="true" size={17} strokeWidth={1.8} className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'} />
          {item.label}
        </button>;
      }
      const GroupIcon = group.icon;
      return <section key={group.title} className={compact ? 'relative' : 'pt-1'}>
        {!compact && index > 1 && <div className="mx-3 mb-2 mt-4 border-t border-slate-800" />}
        <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? '' : group.title)} className={`${compact ? 'min-h-10 whitespace-nowrap' : 'w-full'} flex items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold transition ${activeGroup ? 'text-slate-100' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
          <GroupIcon size={15} className={activeGroup ? 'text-emerald-400' : 'text-slate-500'} />
          <span>{group.title}</span><ChevronDown size={14} className={`ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        {isExpanded && <div className={`${compact ? 'absolute left-0 top-11 z-40 min-w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl' : 'mt-1 space-y-0.5 pl-2'}`}>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return <button key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={active ? 'page' : undefined} className={`${compact ? 'w-full' : 'w-full'} flex min-h-9 items-center gap-3 rounded-lg px-3 text-left text-[12px] font-medium transition ${active ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
              <Icon size={15} className={active ? 'text-emerald-400' : 'text-slate-500'} />{item.label}
            </button>;
          })}
        </div>}
      </section>;
    })}
  </div>;
}

export default function Sidebar({ page, onNavigate, user, onLogout, collapsed, onToggleCollapsed, connection, mobileOpen, onCloseMobile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = (nextPage) => {
    onNavigate(nextPage);
    onCloseMobile();
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen, onCloseMobile]);

  return <>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-800 bg-slate-900 px-3 py-5 transition-[width] duration-200 lg:flex ${collapsed ? 'w-[76px]' : 'w-[258px] px-4'}`}>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1`}>
        <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><PanelsTopLeft size={20} strokeWidth={2} /></span>
        {!collapsed && <div><p className="text-[15px] font-bold tracking-tight text-white">Finora POS</p><p className="text-[11px] text-slate-400">Gestión comercial</p></div>}
        </div>
        {!collapsed && <button type="button" onClick={onToggleCollapsed} aria-label="Colapsar menú" title="Colapsar menú" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><ChevronLeft size={17} /></button>}
      </div>
      {collapsed && <button type="button" onClick={onToggleCollapsed} aria-label="Expandir menú" title="Expandir menú" className="mt-4 grid h-9 w-full place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"><ChevronRight size={17} /></button>}
      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto"><Navigation page={page} onNavigate={navigate} user={user} collapsed={collapsed} /></nav>
      <div className="mb-3 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="Centro de ayuda"
          title={collapsed ? 'Centro de ayuda' : undefined}
          className={`group flex min-h-10 w-full items-center rounded-lg text-left text-[13px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-100 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}
        >
          <HelpCircle size={17} strokeWidth={1.8} className="shrink-0 text-slate-500 group-hover:text-emerald-400" />
          {!collapsed && <span>Centro de ayuda</span>}
        </button>
      </div>
      <div className={`mt-4 border-t border-slate-800 pt-4 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center rounded-lg py-2 ${collapsed ? '' : 'gap-3 px-2'}`} title={collapsed ? user.nombre : undefined}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-200"><UserRound size={17} /></span>
          {!collapsed && <><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-100">{user.nombre}</p><p className="mt-0.5 text-[10px] capitalize text-slate-500">{user.role}</p></div><button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><LogOut size={16} /></button></>}
        </div>
      </div>
    </aside>
    {mobileOpen && <>
      <button type="button" aria-label="Cerrar menú" onClick={onCloseMobile} className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(84vw,320px)] flex-col border-r border-slate-800 bg-slate-900 px-4 py-5 shadow-2xl transition-transform duration-300 lg:hidden">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><PanelsTopLeft size={20} strokeWidth={2} /></span>
            <div><p className="text-[15px] font-bold tracking-tight text-white">Finora POS</p><p className="text-[11px] text-slate-400">Gestión comercial</p></div>
          </div>
          <button type="button" onClick={onCloseMobile} aria-label="Cerrar menú" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={19} /></button>
        </div>
        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto"><Navigation page={page} onNavigate={navigate} user={user} /></nav>
        <div className="mb-3 border-b border-slate-800 pb-3">
          <button type="button" onClick={() => setHelpOpen(true)} className="group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-100">
            <HelpCircle size={17} strokeWidth={1.8} className="shrink-0 text-slate-500 group-hover:text-emerald-400" />Centro de ayuda
          </button>
        </div>
        <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-200"><UserRound size={17} /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-100">{user.nombre}</p><p className="mt-0.5 text-[10px] capitalize text-slate-500">{user.role}</p></div>
          <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><LogOut size={16} /></button>
        </div>
      </aside>
    </>}
    {helpOpen && <HelpCenterModal connection={connection} onClose={() => setHelpOpen(false)} />}
  </>;
}
