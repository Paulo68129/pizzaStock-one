import { useEffect, useState } from 'react';
import { DollarSign, ShoppingCart, TrendingUp, Package, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/StatCard';
import { BarChart, LineChart, DonutChart } from '@/components/Charts';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format';
import type { Sale, Ingredient } from '@/lib/types';

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [prevWeekRevenue, setPrevWeekRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [dailyData, setDailyData] = useState<{ label: string; value: number }[]>([]);
  const [pizzaSales, setPizzaSales] = useState<{ label: string; value: number; color: string }[]>([]);

  useEffect(() => {
    async function load() {
      const [salesRes, ingRes] = await Promise.all([
        supabase.from('sales').select('*, pizza:pizzas(*)').order('criada_em', { ascending: false }).limit(500),
        supabase.from('ingredients').select('*').order('nome'),
      ]);

      const allSales = (salesRes.data ?? []) as Sale[];
      const allIngs = (ingRes.data ?? []) as Ingredient[];
      setSales(allSales);
      setIngredients(allIngs);

      // Today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todaySales = allSales.filter((s) => new Date(s.criada_em) >= todayStart);
      setTodayRevenue(todaySales.reduce((s, x) => s + Number(x.valor_total), 0));
      setTodayCount(todaySales.reduce((s, x) => s + x.quantidade, 0));

      // This week vs last week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const twoWeekStart = new Date();
      twoWeekStart.setDate(twoWeekStart.getDate() - 14);
      const thisWeek = allSales.filter((s) => new Date(s.criada_em) >= weekStart);
      const lastWeek = allSales.filter((s) => {
        const d = new Date(s.criada_em);
        return d >= twoWeekStart && d < weekStart;
      });
      setWeekRevenue(thisWeek.reduce((s, x) => s + Number(x.valor_total), 0));
      setPrevWeekRevenue(lastWeek.reduce((s, x) => s + Number(x.valor_total), 0));

      // Low stock
      setLowStockCount(allIngs.filter((i) => Number(i.estoque) <= Number(i.estoque_minimo)).length);

      // Recent sales
      setRecentSales(allSales.slice(0, 5));

      // Daily revenue (last 7 days)
      const daily: { label: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        const rev = allSales
          .filter((s) => {
            const sd = new Date(s.criada_em);
            return sd >= d && sd < next;
          })
          .reduce((s, x) => s + Number(x.valor_total), 0);
        daily.push({ label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), value: rev });
      }
      setDailyData(daily);

      // Pizza sales distribution
      const colors = ['#f97316', '#0ea5e9', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'];
      const pizzaMap = new Map<string, number>();
      allSales.forEach((s) => {
        const name = s.pizza?.nome ?? 'Desconhecida';
        pizzaMap.set(name, (pizzaMap.get(name) ?? 0) + s.quantidade);
      });
      setPizzaSales(
        Array.from(pizzaMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
      );

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const weekChange = prevWeekRevenue > 0 ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 : 0;
  const totalProfit = sales.reduce((s, x) => s + (Number(x.valor_total) - Number(x.custo_total)), 0);
  const totalRevenue = sales.reduce((s, x) => s + Number(x.valor_total), 0);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-800 font-display">Dashboard</h1>
        <p className="text-ink-500 text-sm mt-0.5">Visão geral da sua pizzaria em tempo real</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Faturamento Hoje"
          value={formatCurrency(todayRevenue)}
          icon={<DollarSign size={20} />}
          color="green"
          subtitle={`${todayCount} pizzas vendidas`}
        />
        <StatCard
          label="Faturamento 7 Dias"
          value={formatCurrency(weekRevenue)}
          icon={<TrendingUp size={20} />}
          color="brand"
          trend={{ value: `${weekChange >= 0 ? '+' : ''}${weekChange.toFixed(1)}%`, positive: weekChange >= 0 }}
        />
        <StatCard
          label="Margem de Lucro"
          value={`${margin.toFixed(1)}%`}
          icon={<ShoppingCart size={20} />}
          color="blue"
          subtitle={`${formatCurrency(totalProfit)} de lucro`}
        />
        <StatCard
          label="Itens em Estoque Baixo"
          value={String(lowStockCount)}
          icon={<AlertTriangle size={20} />}
          color={lowStockCount > 0 ? 'red' : 'green'}
          subtitle={`${ingredients.length} ingredientes no total`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-bold text-ink-800 mb-1">Faturamento dos Últimos 7 Dias</h3>
          <p className="text-xs text-ink-400 mb-5">Receita diária em reais</p>
          <LineChart data={dailyData} formatValue={formatCurrency} height={220} color="#f97316" />
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-ink-800 mb-1">Pizzas Mais Vendidas</h3>
          <p className="text-xs text-ink-400 mb-5">Distribuição por quantidade</p>
          {pizzaSales.length > 0 ? (
            <DonutChart data={pizzaSales} size={150} />
          ) : (
            <p className="text-sm text-ink-400 text-center py-8">Sem vendas registradas</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-bold text-ink-800 mb-1">Vendas Recentes</h3>
          <p className="text-xs text-ink-400 mb-4">Últimas 5 transações</p>
          {recentSales.length > 0 ? (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 text-sm font-bold">
                    {sale.pizza?.nome?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-700 truncate">{sale.pizza?.nome ?? 'N/A'}</p>
                    <p className="text-xs text-ink-400 flex items-center gap-1">
                      <Clock size={11} />
                      {formatDateTime(sale.criada_em)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-800">{formatCurrency(Number(sale.valor_total))}</p>
                    <p className="text-xs text-ink-400">{sale.quantidade}x</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-400 text-center py-8">Nenhuma venda registrada ainda</p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-ink-800 mb-1">Estoque Crítico</h3>
          <p className="text-xs text-ink-400 mb-4">Ingredientes abaixo do mínimo</p>
          {ingredients.filter((i) => Number(i.estoque) <= Number(i.estoque_minimo)).length > 0 ? (
            <div className="space-y-3">
              {ingredients
                .filter((i) => Number(i.estoque) <= Number(i.estoque_minimo))
                .map((ing) => (
                  <div key={ing.id} className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-0">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                      <Package size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink-700">{ing.nome}</p>
                      <p className="text-xs text-ink-400">Mínimo: {formatNumber(Number(ing.estoque_minimo))} {ing.unidade}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">{formatNumber(Number(ing.estoque))} {ing.unidade}</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-2">
                <Package size={22} />
              </div>
              <p className="text-sm text-ink-500 font-medium">Todos os ingredientes estão em nível adequado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
