import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  UserX,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import {
  getAppointmentStats,
  getRevenueStats,
  getTopServices,
  getTopProfessionals,
} from '../services/reports';
import { getSales } from '../services/sales';

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getPresetRange(preset: DatePreset, customRange: { start: string; end: string }): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: now, end: now };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom': {
      const s = customRange.start ? new Date(customRange.start) : now;
      const e = customRange.end ? new Date(customRange.end) : now;
      return { start: s, end: e };
    }
  }
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'custom', label: 'Personalizado' },
];

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function ReportsPage() {
  const { business, profile } = useAuth();
  const businessId = business?.id;

  const [preset, setPreset] = useState<DatePreset>('month');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const dateRange = useMemo(() => getPresetRange(preset, customRange), [preset, customRange]);

  const dateRangeApi = useMemo(
    () => ({
      startDate: format(dateRange.start, "yyyy-MM-dd'T'00:00:00"),
      endDate: format(dateRange.end, "yyyy-MM-dd'T'23:59:59"),
    }),
    [dateRange]
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['report-appointment-stats', businessId, dateRangeApi],
    queryFn: () => getAppointmentStats(businessId!, dateRangeApi),
    enabled: !!businessId,
    select: (res) => res.data,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['report-revenue-stats', businessId, dateRangeApi],
    queryFn: () => getRevenueStats(businessId!, dateRangeApi),
    enabled: !!businessId,
    select: (res) => res.data,
  });

  const { data: topServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['report-top-services', businessId],
    queryFn: () => getTopServices(businessId!),
    enabled: !!businessId,
    select: (res) => res.data ?? [],
  });

  const { data: topProfessionals = [], isLoading: profsLoading } = useQuery({
    queryKey: ['report-top-professionals', businessId],
    queryFn: () => getTopProfessionals(businessId!),
    enabled: !!businessId,
    select: (res) => res.data ?? [],
  });

  // Rango local → ISO (para comparar contra timestamptz correctamente)
  const salesRange = useMemo(() => {
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [dateRange]);

  const { data: salesRows = [], isLoading: salesLoading } = useQuery({
    queryKey: ['report-product-sales', businessId, salesRange],
    queryFn: () => getSales(businessId!, { from: salesRange.from, to: salesRange.to }),
    enabled: !!businessId,
    select: (res) => (res.data ?? []).map((s) => ({ ...s, items: s.items ?? [] })),
  });

  const isLoading = statsLoading || revenueLoading || servicesLoading || profsLoading || salesLoading;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario';

  const maxServiceCount = useMemo(
    () => Math.max(...(topServices?.map((s) => s.appointment_count) ?? [1]), 1),
    [topServices]
  );

  const maxProfCount = useMemo(
    () => Math.max(...(topProfessionals?.map((p) => p.appointment_count) ?? [1]), 1),
    [topProfessionals]
  );

  // Ventas agrupadas por producto en el rango elegido
  interface ProductRow {
    key: string;
    name: string;
    qty: number;
    cost: number;
    revenue: number;
    profit: number;
  }

  const productSales = useMemo<ProductRow[]>(() => {
    const map = new Map<string, ProductRow>();
    for (const sale of salesRows) {
      for (const item of sale.items) {
        const key = item.product_id ?? item.product_name;
        const row =
          map.get(key) ??
          ({ key, name: item.product_name, qty: 0, cost: 0, revenue: 0, profit: 0 } as ProductRow);
        row.qty += item.quantity;
        row.cost += item.quantity * item.unit_cost;
        row.revenue += item.quantity * item.unit_price;
        row.profit = row.revenue - row.cost;
        map.set(key, row);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [salesRows]);

  const productTotals = useMemo(
    () =>
      productSales.reduce(
        (acc, r) => ({
          qty: acc.qty + r.qty,
          cost: acc.cost + r.cost,
          revenue: acc.revenue + r.revenue,
          profit: acc.profit + r.profit,
        }),
        { qty: 0, cost: 0, revenue: 0, profit: 0 }
      ),
    [productSales]
  );

  // Simulated reservation-per-day and per-hour data
  const reservationsByDay = useMemo(() => {
    if (!stats) return WEEKDAYS.map((d) => ({ label: d, value: 0 }));
    const base = Math.floor(stats.total / 7);
    return WEEKDAYS.map((d, i) => ({
      label: d,
      value: base + (i < 5 ? Math.floor(stats.total * 0.03) : 0),
    }));
  }, [stats]);

  const reservationsByHour = useMemo(() => {
    if (!stats) return [];
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    return hours.map((h, i) => ({
      label: h,
      value: i >= 1 && i <= 6 ? Math.floor(stats.total * (0.12 + Math.random() * 0.08)) : Math.floor(stats.total * 0.04),
    }));
  }, [stats]);

  const maxDayRes = Math.max(...reservationsByDay.map((d) => d.value), 1);
  const maxHourRes = Math.max(...reservationsByHour.map((d) => d.value), 1);

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {getTimeGreeting()}, {firstName}
        </h1>
        <p className="text-[#9CA3AF] mt-1">Reportes y estadísticas</p>
      </div>

      {/* Date Range Selector */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  preset === p.value
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#333] text-[#9CA3AF] hover:text-white hover:bg-[#444]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex gap-2">
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                className="bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#DC2626]"
              />
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                className="bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#DC2626]"
              />
            </div>
          )}
        </div>
      </Card>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
            <StatCard
              icon={Calendar}
              value={stats?.total ?? 0}
              label="Total reservas"
              iconColor="#DC2626"
            />
            <StatCard
              icon={CheckCircle2}
              value={(stats?.confirmed ?? 0) + (stats?.completed ?? 0)}
              label="Confirmadas"
              iconColor="#16A34A"
            />
            <StatCard
              icon={XCircle}
              value={stats?.cancelled ?? 0}
              label="Canceladas"
              iconColor="#EF4444"
            />
            <StatCard
              icon={UserX}
              value={stats?.no_show ?? 0}
              label="No asistieron"
              iconColor="#F59E0B"
            />
            <StatCard
              icon={DollarSign}
              value={`$${(revenue?.total_revenue ?? 0).toLocaleString('es-AR')}`}
              label="Ingresos"
              iconColor="#16A34A"
            />
          </div>

          {/* Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Reservas por día */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-[#DC2626]" />
                Reservas por día de la semana
              </h3>
              <div className="flex items-end gap-2 h-40">
                {reservationsByDay.map((day) => (
                  <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex justify-center">
                      <div
                        className="w-full max-w-[40px] bg-[#DC2626] rounded-t-md transition-all duration-300"
                        style={{ height: `${(day.value / maxDayRes) * 120}px`, minHeight: day.value > 0 ? '8px' : '2px' }}
                      />
                    </div>
                    <span className="text-[10px] text-[#9CA3AF]">{day.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Reservas por hora */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-[#DC2626]" />
                Reservas por hora del día
              </h3>
              <div className="flex items-end gap-1 h-40">
                {reservationsByHour.map((hour) => (
                  <div key={hour.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex justify-center">
                      <div
                        className="w-full max-w-[30px] bg-blue-600 rounded-t-md transition-all duration-300"
                        style={{ height: `${(hour.value / maxHourRes) * 120}px`, minHeight: hour.value > 0 ? '8px' : '2px' }}
                      />
                    </div>
                    <span className="text-[9px] text-[#9CA3AF] rotate-45 origin-left mt-1">{hour.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Top Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Top Services */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-4">Servicios más solicitados</h3>
              {topServices.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">Sin datos para el período seleccionado</p>
              ) : (
                <div className="space-y-3">
                  {topServices.map((service, i) => (
                    <div key={service.service_id} className="flex items-center gap-3">
                      <span className="text-xs text-[#9CA3AF] w-5">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{service.service_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#DC2626] rounded-full"
                              style={{ width: `${(service.appointment_count / maxServiceCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#9CA3AF] whitespace-nowrap">
                            {service.appointment_count} reservas
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-white whitespace-nowrap">
                        ${service.total_revenue.toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Top Professionals */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-4">Profesionales destacados</h3>
              {topProfessionals.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">Sin datos para el período seleccionado</p>
              ) : (
                <div className="space-y-3">
                  {topProfessionals.map((prof, i) => (
                    <div key={prof.professional_id} className="flex items-center gap-3">
                      <span className="text-xs text-[#9CA3AF] w-5">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{prof.professional_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${(prof.appointment_count / maxProfCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#9CA3AF] whitespace-nowrap">
                            {prof.appointment_count} reservas
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-[#9CA3AF] whitespace-nowrap">
                        {prof.completion_rate}% asistencia
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Ventas por producto */}
          <Card className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <ShoppingBag size={16} className="text-[#DC2626]" />
              Ventas por producto
            </h3>
            {productSales.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">
                Sin ventas de productos para el período seleccionado
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#333]">
                      <th className="text-left px-3 py-2.5 font-medium text-[#9CA3AF]">Producto</th>
                      <th className="text-right px-3 py-2.5 font-medium text-[#9CA3AF]">Cant.</th>
                      <th className="text-right px-3 py-2.5 font-medium text-[#9CA3AF]">Costo</th>
                      <th className="text-right px-3 py-2.5 font-medium text-[#9CA3AF]">Precio</th>
                      <th className="text-right px-3 py-2.5 font-medium text-[#9CA3AF]">Beneficio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSales.map((row) => (
                      <tr key={row.key} className="border-b border-[#333]/50 last:border-0">
                        <td className="px-3 py-2.5 text-white">{row.name}</td>
                        <td className="px-3 py-2.5 text-right text-[#9CA3AF]">{row.qty}</td>
                        <td className="px-3 py-2.5 text-right text-[#9CA3AF]">
                          ${row.cost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-white font-medium">
                          ${row.revenue.toFixed(2)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-semibold ${
                            row.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {row.profit >= 0 ? '+' : ''}${row.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#333] bg-[#111]">
                      <td className="px-3 py-2.5 text-white font-semibold">Totales</td>
                      <td className="px-3 py-2.5 text-right text-white font-semibold">
                        {productTotals.qty}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#9CA3AF]">
                        ${productTotals.cost.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white font-semibold">
                        ${productTotals.revenue.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-bold ${
                          productTotals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {productTotals.profit >= 0 ? '+' : ''}${productTotals.profit.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
