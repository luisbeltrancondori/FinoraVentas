import { useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowUpRight, Boxes, CircleDollarSign, ShoppingCart, Wallet,
} from 'lucide-react';
import { api } from '../api.js';

const money = (value) => new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const number = (value) => new Intl.NumberFormat('es-BO', {
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const dateLabel = (value, range) => {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return range === 'año'
    ? date.toLocaleDateString('es-BO', { month: 'short' })
    : date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
};

const fullDate = (value) => value
  ? new Date(value).toLocaleDateString('es-BO', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—';

const PAYMENT_ORDER = ['Efectivo', 'QR', 'Crédito', 'Tarjeta'];
const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

function MetricCard({ label, value, note, icon: Icon, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <article className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={18} /></span>
      </div>
      <div className="mt-4 min-h-8 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">{value}</div>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{note}</p>
    </article>
  );
}

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children = 'Sin datos para el período seleccionado.' }) {
  return <div className="grid h-56 place-items-center rounded-lg bg-gray-50 px-4 text-center text-xs text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">{children}</div>;
}

function Table({ headers, rows, emptyText, renderRow }) {
  if (!rows?.length) return <Empty>{emptyText}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[400px] text-left text-xs">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-slate-800/70 dark:text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2.5 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

export default function DashboardPage({ data, negocioId, onNavigate }) {
  const [range, setRange] = useState('7dias');
  const [salesTime, setSalesTime] = useState(data?.ventas_tiempo || []);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');
  const kpis = data?.kpis || {};
  const metodosPagoData = [...(data?.metodos_pago || [])].sort(
    (first, second) => PAYMENT_ORDER.indexOf(first.metodo_pago) - PAYMENT_ORDER.indexOf(second.metodo_pago),
  );
  const chartData = metodosPagoData.map((item) => ({
    name: item.metodo_pago,
    value: Number(item.total),
  }));

  useEffect(() => {
    if (range === '7dias') {
      setSalesTime(data?.ventas_tiempo || []);
      setChartError('');
      return undefined;
    }
    let active = true;
    setChartLoading(true);
    setChartError('');
    api(`/api/dashboard/ventas-tiempo?rango=${encodeURIComponent(range)}`, { negocioId })
      .then((result) => { if (active) setSalesTime(result); })
      .catch((error) => { if (active) setChartError(error.message); })
      .finally(() => { if (active) setChartLoading(false); });
    return () => { active = false; };
  }, [data?.ventas_tiempo, negocioId, range]);

  const metricCards = [
    { label: 'Ticket promedio', value: money(kpis.ticket_promedio), note: 'Por venta del mes actual', icon: CircleDollarSign, tone: 'emerald' },
    { label: 'Ganancia bruta estimada', value: money(kpis.ganancia_bruta_mes), note: 'Ventas del mes menos costo de productos', icon: ArrowUpRight, tone: 'violet' },
    { label: 'Cuentas por cobrar', value: money(kpis.cuentas_por_cobrar), note: 'Saldo pendiente no anulado', icon: Wallet, tone: 'amber' },
    {
      label: 'Valor del inventario',
      value: <span className="block text-base leading-6 sm:text-lg">{money(kpis.inventario_a_costo)} <span className="text-[10px] font-medium text-slate-400">a costo</span><br />{money(kpis.inventario_a_precio_venta)} <span className="text-[10px] font-medium text-slate-400">a venta</span></span>,
      note: 'Costo / precio al público',
      icon: Boxes,
      tone: 'blue',
    },
    { label: 'Ventas del mes', value: money(kpis.ventas_mes), note: `${number(kpis.cantidad_ventas_mes)} transacciones`, icon: ShoppingCart, tone: 'slate' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Centro de control</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Resumen gerencial</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Indicadores, ventas e inventario del negocio.</p>
        </div>
        <button type="button" onClick={() => onNavigate('pos')} className="flex min-h-10 items-center gap-2 self-start rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:self-auto">
          <ShoppingCart size={16} /> Nueva venta
        </button>
      </div>

      <section aria-label="Indicadores clave" className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {metricCards.map((card) => <MetricCard key={card.label} {...card} />)}
      </section>

      <section aria-label="Gráficos de ventas" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Ventas en el tiempo" subtitle="Importe facturado en el período" className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{chartLoading ? 'Actualizando gráfico…' : 'Incluye ventas no anuladas'}</span>
            <select aria-label="Período del gráfico de ventas" value={range} onChange={(event) => setRange(event.target.value)} className="min-h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <option value="7dias">Últimos 7 días</option>
              <option value="mes">Este mes</option>
              <option value="año">Este año</option>
            </select>
          </div>
          {chartError ? <div role="alert" className="grid h-64 place-items-center rounded-lg bg-rose-50 px-4 text-center text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{chartError}</div> : !salesTime.length ? <Empty /> : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTime} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="fecha" tickFormatter={(value) => dateLabel(value, range)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis tickFormatter={(value) => number(value)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={54} />
                  <Tooltip formatter={(value) => money(value)} labelFormatter={(value) => fullDate(value)} contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#059669" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Ventas por vendedor" subtitle="Acumulado del mes actual">
          {!data?.ventas_vendedor?.length ? <Empty /> : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ventas_vendedor} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => number(value)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="vendedor" width={112} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => money(value)} contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="total_ventas" name="Ventas" fill="#0ea5e9" radius={[0, 5, 5, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Métodos de pago" subtitle="Montos cobrados en el mes actual">
          {!chartData.length ? <Empty /> : (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `Bs ${number(value)}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </section>

      <section aria-label="Productos y operaciones" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Top 5 productos más vendidos" subtitle="Unidades vendidas este mes">
          <Table headers={['Producto', 'Unidades', 'Venta total']} rows={data?.top_productos} emptyText="No hay ventas de productos este mes." renderRow={(product) => (
            <tr key={product.producto_id}><td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{product.producto_nombre}</td><td className="px-3 py-3 text-slate-600 dark:text-slate-300">{number(product.cantidad_vendida)}</td><td className="px-3 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{money(product.total_vendido)}</td></tr>
          )} />
        </Panel>
        <Panel title="Top 5 productos por ganancia" subtitle="Ganancia bruta estimada este mes">
          <Table headers={['Producto', 'Ganancia']} rows={data?.top_ganancias} emptyText="No hay ganancias calculables este mes." renderRow={(product) => (
            <tr key={product.producto_id}><td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{product.producto_nombre}</td><td className="px-3 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{money(product.ganancia_bruta)}</td></tr>
          )} />
        </Panel>
        <Panel title="Productos próximos a vencer" subtitle="Lotes con vencimiento dentro de los próximos 30 días">
          <Table headers={['Producto / lote', 'Vencimiento', 'Cantidad']} rows={data?.proximos_vencer} emptyText="No hay lotes próximos a vencer." renderRow={(lot) => (
            <tr key={lot.producto_id + lot.lote + lot.fecha_vencimiento}><td className="px-3 py-3"><span className="block font-semibold text-slate-700 dark:text-slate-200">{lot.producto_nombre}</span><span className="mt-0.5 block text-[10px] text-slate-400">Lote {lot.lote}</span></td><td className="px-3 py-3 text-amber-700 dark:text-amber-300">{fullDate(lot.fecha_vencimiento)}</td><td className="px-3 py-3 text-right font-medium text-slate-700 dark:text-slate-200">{number(lot.cantidad)}</td></tr>
          )} />
        </Panel>
        <Panel title="Últimos movimientos de caja" subtitle="Aperturas y cierres más recientes">
          <Table headers={['Usuario', 'Apertura / cierre', 'Saldo final']} rows={data?.movimientos_caja} emptyText="Todavía no hay turnos de caja." renderRow={(turn) => (
            <tr key={turn.id}><td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{turn.usuario_nombre}</td><td className="px-3 py-3"><span className="block text-slate-600 dark:text-slate-300">{fullDate(turn.fecha_apertura)}</span><span className="mt-0.5 block text-[10px] text-slate-400">{turn.fecha_cierre ? `Cierre: ${fullDate(turn.fecha_cierre)}` : 'Turno abierto'}</span></td><td className="px-3 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{turn.saldo_final == null ? '—' : money(turn.saldo_final)}</td></tr>
          )} />
        </Panel>
      </section>
    </div>
  );
}
