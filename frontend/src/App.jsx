import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Bell, Check, ChevronDown, LogOut, Menu, Moon, Sun, UserRound, X } from 'lucide-react';
import { api, apiUrl } from './api.js';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AdminPage from './components/AdminPage.jsx';
import CashPage from './components/CashPage.jsx';
import CategoriasPage from './components/CategoriasPage.jsx';
import ClientesPage from './components/ClientesPage.jsx';
import InventoryPage from './components/InventoryPage.jsx';
import LoginPage from './components/LoginPage.jsx';
import PosPage from './components/PosPage.jsx';
import PurchasesPage from './components/PurchasesPage.jsx';
import SalesPage from './components/SalesPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import Spinner from './components/Spinner.jsx';
import Storefront from './components/Storefront.jsx';
import SobreNosotros from './components/SobreNosotros.jsx';
import Contacto from './components/Contacto.jsx';

const DashboardPage = lazy(() => import('./components/DashboardPage.jsx'));
const ReportsPage = lazy(() => import('./components/ReportsPage.jsx'));

const pageTitles = {
  dashboard: 'Resumen',
  reports: 'Reportes',
  cash: 'Caja y turno',
  pos: 'Nueva venta / POS',
  sales: 'Historial de ventas',
  clients: 'Clientes',
  'purchase-new': 'Nueva compra',
  purchases: 'Historial de compras',
  products: 'Catálogo general',
  categories: 'Categorías',
  brands: 'Marcas',
  presentations: 'Presentaciones',
  suppliers: 'Proveedores',
  kardex: 'Kardex',
  physical: 'Inventario físico',
  'adjust-positive': 'Ajustes Positivos',
  'adjust-negative': 'Ajustes Negativos',
  branches: 'Sucursales / negocios',
  users: 'Usuarios, roles y permisos',
  profile: 'Perfil de usuario',
};

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div role={toast.type === 'error' ? 'alert' : 'status'} className={`fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.type === 'error' ? 'bg-rose-700' : 'bg-slate-900'}`}>
      {toast.type === 'error' ? <AlertCircle size={17} /> : <Check size={17} />}
      <span>{toast.message}</span>
      <button type="button" aria-label="Cerrar notificación" onClick={onDismiss} className="ml-2 opacity-80 hover:opacity-100"><X size={15} /></button>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [businesses, setBusinesses] = useState([]);
  const [negocioId, setNegocioId] = useState('');
  const [page, setPage] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [turn, setTurn] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [connection, setConnection] = useState('checking');
  const [toast, setToast] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('pos.sidebarCollapsed') === 'true');
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem('pos.theme') === 'dark');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [inventoryAlerts, setInventoryAlerts] = useState({ vencimientos: [], bajo_stock: [] });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(notify.timeout), [notify]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    window.localStorage.setItem('pos.theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem('pos.sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const loadSession = useCallback(async () => {
    const data = await api('/api/auth/me');
    setUser(data.user);
    setBusinesses(data.negocios);
    const storedId = window.localStorage.getItem('pos.negocioId');
    const selected = data.negocios.some((business) => business.id === storedId)
      ? storedId
      : data.active_business_id || data.negocios[0]?.id || '';
    if (selected && selected !== data.active_business_id) {
      await api('/api/auth/business', { method: 'POST', body: JSON.stringify({ negocio_id: selected }) });
    }
    setNegocioId(selected);
    window.localStorage.setItem('pos.negocioId', selected);
    setAuthError('');
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const status = await api('/api/auth/status');
        if (!active) return;
        setNeedsSetup(status.needs_setup);
        try {
          await loadSession();
        } catch (error) {
          if (error.message.includes('API') || error.message.includes('fetch')) throw error;
          if (active) setUser(null);
        }
      } catch (error) {
        if (active) setAuthError(`${error.message}. API: ${apiUrl}`);
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    initialize();
    return () => { active = false; };
  }, [loadSession]);

  useEffect(() => {
    const controller = new AbortController();
    const check = () => api('/api/health', { signal: controller.signal })
      .then(() => setConnection('online'))
      .catch((error) => { if (error.name !== 'AbortError') setConnection('offline'); });
    check();
    const intervalId = window.setInterval(check, 15000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  const permissions = user?.permisos || [];
  const can = useCallback((permission) => (
    user?.role === 'administrador' || permissions.includes('*') || permissions.includes(permission)
  ), [permissions, user]);

  const loadInventoryAlerts = useCallback(async () => {
    if (!negocioId || !can('products.read')) return;
    setNotificationLoading(true);
    setNotificationError('');
    try {
      setInventoryAlerts(await api('/api/inventario/notificaciones', { negocioId }));
    } catch (error) {
      setNotificationError(error.message);
    } finally {
      setNotificationLoading(false);
    }
  }, [can, negocioId]);

  useEffect(() => {
    if (!user || !negocioId) return undefined;
    loadInventoryAlerts();
    const timer = window.setInterval(loadInventoryAlerts, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadInventoryAlerts, negocioId, user]);

  useEffect(() => {
    function closeMenus(event) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
      }
      if (event.type === 'mousedown'
        && !notificationsRef.current?.contains(event.target)
        && !profileRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('keydown', closeMenus);
    document.addEventListener('mousedown', closeMenus);
    return () => {
      document.removeEventListener('keydown', closeMenus);
      document.removeEventListener('mousedown', closeMenus);
    };
  }, []);

  const refreshProducts = useCallback(async () => {
    if (!negocioId || !can('products.read')) return;
    setProducts(await api('/api/productos', { negocioId }));
  }, [can, negocioId]);

  const refreshTurn = useCallback(async () => {
    if (!negocioId || !can('cash.read')) return;
    setTurn((await api('/api/turnos/actual', { negocioId })).turno);
  }, [can, negocioId]);

  const refreshDashboard = useCallback(async () => {
    if (!negocioId || !can('dashboard.read')) return;
    setDashboard(await api('/api/dashboard/resumen', { negocioId }));
  }, [can, negocioId]);

  const refreshSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const refreshInventory = useCallback(async () => {
    await Promise.all([refreshProducts(), refreshDashboard()]);
  }, [refreshDashboard, refreshProducts]);

  useEffect(() => {
    if (!user || !negocioId) return undefined;
    let active = true;
    setContentLoading(true);
    const requests = [];
    if (can('products.read')) requests.push(api('/api/productos', { negocioId }));
    else requests.push(Promise.resolve(null));
    if (can('cash.read')) requests.push(api('/api/turnos/actual', { negocioId }));
    else requests.push(Promise.resolve(null));
    if (can('dashboard.read')) requests.push(api('/api/dashboard/resumen', { negocioId }));
    else requests.push(Promise.resolve(null));
    Promise.all(requests)
      .then(([productData, turnData, dashboardData]) => {
        if (!active) return;
        if (productData) setProducts(productData);
        if (turnData) setTurn(turnData.turno);
        if (dashboardData) setDashboard(dashboardData);
      })
      .catch((error) => {
        if (active) {
          if (error.message.includes('sesión') || error.message.includes('sesion')) {
            setUser(null);
            setAuthError('Tu sesión expiró. Inicia sesión nuevamente.');
          } else notify(error.message, 'error');
        }
      })
      .finally(() => { if (active) setContentLoading(false); });
    return () => { active = false; };
  }, [can, negocioId, notify, user]);

  async function changeBusiness(event) {
    const selected = event.target.value;
    try {
      await api('/api/auth/business', { method: 'POST', body: JSON.stringify({ negocio_id: selected }) });
      setNegocioId(selected);
      window.localStorage.setItem('pos.negocioId', selected);
      setProducts([]);
      setTurn(null);
      setDashboard(null);
    } catch (error) { notify(error.message, 'error'); }
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (error) { notify(error.message, 'error'); }
    setUser(null);
    setProducts([]);
    setDashboard(null);
    setTurn(null);
    setBusinesses([]);
    navigate('/login', { replace: true });
  }

  async function authenticateEmployee() {
    await loadSession();
    navigate('/', { replace: true });
  }

  const currentBusiness = businesses.find((business) => business.id === negocioId);
  const onSaleRefresh = useCallback(async () => {
    await Promise.all([refreshProducts(), refreshTurn(), refreshDashboard()]);
  }, [refreshDashboard, refreshProducts, refreshTurn]);

  let content = null;
  if (page === 'dashboard') content = <DashboardPage data={dashboard} negocioId={negocioId} onNavigate={setPage} />;
  else if (page === 'reports') content = <ReportsPage negocioId={negocioId} business={currentBusiness} />;
  else if (page === 'pos') content = <PosPage products={products} negocioId={negocioId} turn={turn} business={currentBusiness} cashier={user.nombre} onRefresh={onSaleRefresh} notify={notify} />;
  else if (['products', 'brands', 'presentations'].includes(page)) {
    content = <InventoryPage view={page} products={products} negocioId={negocioId} business={currentBusiness} canManage={can('products.manage')} onRefresh={refreshInventory} notify={notify} onNavigate={setPage} />;
  } else if (page === 'categories') {
    content = <CategoriasPage negocioId={negocioId} canManage={can('products.manage')} notify={notify} />;
  }   else if (page === 'sales') content = <SalesPage negocioId={negocioId} products={products} business={currentBusiness} canManage={can('sales.write')} onRefresh={onSaleRefresh} notify={notify} />;
  else if (page === 'clients') content = <ClientesPage negocioId={negocioId} canManage={can('sales.write')} notify={notify} />;
  else if (page === 'purchases' || page === 'purchase-new') {
    content = <PurchasesPage products={products} negocioId={negocioId} business={currentBusiness} notify={notify} onRefresh={refreshInventory} canManage={can('purchases.write')} openFormInitially={page === 'purchase-new'} onNavigate={setPage} />;
  } else if (page === 'cash') content = <CashPage negocioId={negocioId} turn={turn} onRefresh={onSaleRefresh} notify={notify} />;
  else if (['branches', 'users', 'suppliers', 'kardex', 'physical', 'adjust-positive', 'adjust-negative', 'profile'].includes(page)) {
    content = <AdminPage view={page} negocioId={negocioId} businesses={businesses} business={currentBusiness} user={user} products={products} canManage={can('products.manage')} canAdjust={can('inventory.write')} notify={notify} onRefresh={refreshSession} onInventoryRefresh={refreshInventory} />;
  }

  const publicPath = location.pathname === '/' || location.pathname === '/nosotros' || location.pathname === '/contacto';
  if (!user && publicPath) {
    return (
      <Routes>
        <Route path="/" element={<Storefront onEmployeeLogin={() => navigate('/login')} />} />
        <Route path="/nosotros" element={<SobreNosotros />} />
        <Route path="/contacto" element={<Contacto />} />
      </Routes>
    );
  }
  if (authLoading) return <div className="grid min-h-screen place-items-center bg-slate-50"><Spinner label="Conectando con el sistema…" /></div>;
  if (!user) return <LoginPage setupRequired={needsSetup} error={authError} onAuthenticated={authenticateEmployee} />;

  return (
    <div className={`app-shell min-h-screen bg-canvas transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[258px]'}`}>
      <Sidebar page={page} onNavigate={setPage} user={user} onLogout={logout} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} connection={connection} mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menú de navegación" aria-expanded={mobileMenuOpen} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"><Menu size={19} /></button>
            <div className={`h-2.5 w-2.5 rounded-full ${connection === 'online' ? 'bg-emerald-500' : connection === 'checking' ? 'animate-pulse bg-amber-400' : 'bg-rose-500'}`} />
            <div><p className="text-sm font-bold text-slate-900">{pageTitles[page]}</p><p className="text-[11px] text-slate-400">{connection === 'online' ? 'API conectada' : connection === 'checking' ? 'Verificando conexión…' : 'Sin conexión con la API'}</p></div>
            {contentLoading && <span className="ml-1 h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />}
          </div>
          <div className="flex items-center gap-2">
            {businesses.length > 0 && <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="hidden sm:inline">Sucursal</span>
              <select value={negocioId} onChange={changeBusiness} className="min-h-10 max-w-48 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500">{businesses.map((business) => <option key={business.id} value={business.id}>{business.nombre}</option>)}</select>
            </label>}
            {can('cash.read') && <span className={`hidden rounded-full px-3 py-1 text-[11px] font-bold sm:inline ${turn ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{turn ? 'Caja abierta' : 'Caja cerrada'}</span>}
            <button type="button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={darkMode ? 'Modo claro' : 'Modo oscuro'} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
            {can('products.read') && <div ref={notificationsRef} className="relative">
              <button type="button" aria-expanded={notificationsOpen} aria-label={`Notificaciones (${inventoryAlerts.vencimientos.length + inventoryAlerts.bajo_stock.length})`} title="Notificaciones de inventario" onClick={() => { setNotificationsOpen((value) => !value); setProfileMenuOpen(false); if (!notificationsOpen) loadInventoryAlerts(); }} className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                <Bell size={17} />
                {(inventoryAlerts.vencimientos.length + inventoryAlerts.bajo_stock.length > 0) && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500 dark:border-slate-900" />}
              </button>
              {notificationsOpen && <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700"><div><p className="text-sm font-bold text-slate-900 dark:text-slate-100">Notificaciones</p><p className="text-[11px] text-slate-500 dark:text-slate-400">Alertas de inventario</p></div><button type="button" onClick={loadInventoryAlerts} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">Actualizar</button></div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {notificationLoading && <p className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400">Consultando inventario…</p>}
                  {notificationError && <p role="alert" className="px-3 py-3 text-xs text-rose-600">{notificationError}</p>}
                  {!notificationLoading && !notificationError && inventoryAlerts.vencimientos.map((alert) => <button key={`expiry-${alert.producto_id}-${alert.fecha_vencimiento}`} type="button" onClick={() => { setPage('products'); setNotificationsOpen(false); }} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-amber-50 dark:hover:bg-slate-800"><p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Próximo a vencer · {alert.dias_restantes} días</p><p className="mt-1 text-xs text-slate-700 dark:text-slate-200">{alert.producto_nombre} · lote: {alert.stock_lote}</p></button>)}
                  {!notificationLoading && !notificationError && inventoryAlerts.bajo_stock.map((alert) => <button key={`stock-${alert.producto_id}`} type="button" onClick={() => { setPage('products'); setNotificationsOpen(false); }} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-rose-50 dark:hover:bg-slate-800"><p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Producto con bajo stock</p><p className="mt-1 text-xs text-slate-700 dark:text-slate-200">{alert.producto_nombre} · {alert.stock_actual} disponibles (mín. {alert.stock_minimo})</p></button>)}
                  {!notificationLoading && !notificationError && !inventoryAlerts.vencimientos.length && !inventoryAlerts.bajo_stock.length && <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No hay alertas de inventario.</p>}
                </div>
              </div>}
            </div>}
            <div className="relative" ref={profileRef}>
              <button type="button" aria-expanded={profileMenuOpen} onClick={() => { setProfileMenuOpen((value) => !value); setNotificationsOpen(false); }} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{(user.nombre || 'U').trim().slice(0, 1).toLocaleUpperCase()}</span>
                <span className="hidden max-w-32 truncate text-xs font-semibold text-slate-700 dark:text-slate-200 sm:block">{user.nombre}</span><ChevronDown size={14} className="text-slate-400" />
              </button>
              {profileMenuOpen && <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{user.nombre}</p><p className="mt-0.5 text-[10px] capitalize text-slate-500 dark:text-slate-400">{user.role}</p></div>
                <button type="button" onClick={() => { setPage('profile'); setProfileMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><UserRound size={15} /> Mi Perfil</button>
                <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800"><LogOut size={15} /> Cerrar Sesión</button>
              </div>}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">
        {contentLoading ? <Spinner label="Cargando datos de la sucursal…" /> : <Suspense fallback={<Spinner label="Cargando resumen gerencial…" />}>{content}</Suspense>}
        <p className="mt-8 text-center text-[11px] text-slate-400">{currentBusiness?.nombre || 'Sistema POS'} · {user.nombre}</p>
      </main>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
