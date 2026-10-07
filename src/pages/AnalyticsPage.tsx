import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Percent, Award, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/StatCard';
import { BarChart, LineChart } from '@/components/Charts';
import { formatCurrency } from '@/lib/format';
import type { Sale, Pizza, Ingredient, RecipeItem } from '@/lib/types';

type Period = '7' | '14' | '30';

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('14');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeItem[]>>({});

  useEffect(() => {
    async function load() {
      const [sRes, pRes, iRes, rRes] = await Promise.all([
        supabase.from('sales').select('*, pizza:pizzas(*)').order('criada_em', { ascending: false }),
        supabase.from('pizzas').select('*'),
        supabase.from('ingredients').select('*'),
        supabase.from('recipe_items').select('*, ingredient:ingredients(*)'),
      ]);
      setSales((sRes.data ?? []) as Sale[]);
      setPizzas((pRes.data ?? []) as Pizza[]);
      setIngredients((iRes.data ?? []) as Ingredient[]);
      const rMap: Record<string, RecipeItem[]> = {};
      (rRes.data ?? []).forEach((r: RecipeItem) => {
        if (!rMap[r.pizza_id]) rMap[r.pizza_id] = [];
        rMap[r.pizza_id].push(r);
      });
      setRecipes(rMap);
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

  const days = parseInt(period);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const periodSales = sales.filter((s) => new Date(s.criada_em) >= cutoff);

  const revenue = periodSales.reduce((s, x) => s + Number(x.valor_total), 0);
  const cost = periodSales.reduce((s, x) => s + Number(x.custo_total), 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const totalPizzas = periodSales.reduce((s, x) => s + x.quantidade, 0);
  const avgTicket = totalPizzas > 0 ? revenue / totalPizzas : 0;

  // Daily revenue
  const dailyData: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const rev = periodSales
      .filter((s) => { const sd = new Date(s.criada_em); return sd >= d && sd < next; })
      .reduce((s, x) => s + Number(x.valor_total), 0);
    dailyData.push({ label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: rev });
  }

  // Per-pizza analysis
  const pizzaStats = pizzas.map((p) => {
    const pSales = periodSales.filter((s) => s.pizza_id === p.id);
    const pRev = pSales.reduce((s, x) => s + Number(x.valor_total), 0);
    const pCost = pSales.reduce((s, x) => s + Number(x.custo_total), 0);
    const pQty = pSales.reduce((s, x) => s + x.quantidade, 0);
    const recipeCost = (recipes[p.id] ?? []).reduce((s, r) => s + r.quantidade * Number(r.ingredient?.custo_unitario ?? 0), 0);
    return {
      id: p.id,
      nome: p.nome,
      preco: p.preco,
      vendas: pQty,
      faturamento: pRev,
      custo: pCost,
      lucro: pRev - pCost,
      margem: pRev > 0 ? ((pRev - pCost) / pRev) * 100 : 0,
      custoProducao: recipeCost,
    };
  }).sort((a, b) => b.faturamento - a.faturamento);

  // Top ingredient usage
  const ingUsage = new Map<string, { nome: string; quantidade: number; custo: number }>();
  periodSales.forEach((s) => {
    const recipe = recipes[s.pizza_id] ?? [];
    recipe.forEach((r) => {
      const ing = r.ingredient;
      if (!ing) return;
      const key = ing.id;
      const existing = ingUsage.get(key) ?? { nome: ing.nome, quantidade: 0, custo: 0 };
      existing.quantidade += r.quantidade * s.quantidade;
      existing.custo += r.quantidade * s.quantidade * Number(ing.custo_unitario);
      ingUsage.set(key, existing);
    });
  });

  const topIngredients = Array.from(ingUsage.values())
    .sort((a, b) => b.custo - a.custo)
    .slice(0, 8);

  const pizzaBarData = pizzaStats.filter((p) => p.vendas > 0).map((p) => ({
    label: p.nome.split(' ')[0],
    value: p.faturamento,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-800 font-display">Análises Financeiras</h1>
          <p className="text-ink-500 text-sm mt-0.5">Relatórios detalhados de desempenho</p>
        </div>
        <div className="flex gap-1 bg-ink-100 rounded-xl p-1">
          {(['7', '14', '30'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                period === p ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Faturamento" value={formatCurrency(revenue)} icon={<DollarSign size={20} />} color="green" subtitle={`${totalPizzas} pizzas vendidas`} />
        <StatCard label="Custo de Produção" value={formatCurrency(cost)} icon={<TrendingUp size={20} />} color="red" subtitle={`${(cost / (revenue || 1) * 100).toFixed(1)}% da receita`} />
        <StatCard label="Lucro Líquido" value={formatCurrency(profit)} icon={<DollarSign size={20} />} color="brand" subtitle={`Ticket médio: ${formatCurrency(avgTicket)}`} />
        <StatCard label="Margem de Lucro" value={`${margin.toFixed(1)}%`} icon={<Percent size={20} />} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-bold text-ink-800 mb-1">Faturamento Diário</h3>
          <p className="text-xs text-ink-400 mb-5">Últimos {days} dias</p>
          <LineChart data={dailyData} formatValue={formatCurrency} height={220} color="#10b981" />
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-ink-800 mb-1">Faturamento por Pizza</h3>
          <p className="text-xs text-ink-400 mb-5">Receita no período selecionado</p>
          {pizzaBarData.length > 0 ? (
            <BarChart data={pizzaBarData} formatValue={formatCurrency} height={220} color="#f97316" />
          ) : (
            <p className="text-sm text-ink-400 text-center py-8">Sem vendas no período</p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Award size={18} className="text-brand-500" />
          <h3 className="font-bold text-ink-800">Desempenho por Pizza</h3>
        </div>
        <p className="text-xs text-ink-400 mb-5">Análise detalhada de cada pizza do cardápio</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
                <th className="px-4 py-3">Pizza</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Vendas</th>
                <th className="px-4 py-3">Faturamento</th>
                <th className="px-4 py-3">Custo</th>
                <th className="px-4 py-3">Lucro</th>
                <th className="px-4 py-3">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {pizzaStats.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-ink-700">{p.nome}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{formatCurrency(p.preco)}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{p.vendas}</td>
                  <td className="px-4 py-3 text-sm font-bold text-ink-800">{formatCurrency(p.faturamento)}</td>
                  <td className="px-4 py-3 text-sm text-ink-500">{formatCurrency(p.custo)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600">{formatCurrency(p.lucro)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.margem >= 50 ? 'bg-emerald-100 text-emerald-700' : p.margem >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {p.margem.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={18} className="text-brand-500" />
          <h3 className="font-bold text-ink-800">Consumo de Ingredientes</h3>
        </div>
        <p className="text-xs text-ink-400 mb-5">Ingredientes mais utilizados no período</p>
        {topIngredients.length > 0 ? (
          <div className="space-y-3">
            {topIngredients.map((ing, i) => {
              const maxCusto = topIngredients[0].custo || 1;
              const pct = (ing.custo / maxCusto) * 100;
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-ink-600 w-32 truncate">{ing.nome}</span>
                  <div className="flex-1 bg-ink-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${pct}%` }}
                    >
                      <span className="text-[10px] text-white font-bold">{formatCurrency(ing.custo)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-ink-400 w-20 text-right">{ing.quantidade.toFixed(2)} un</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-400 text-center py-8">Sem consumo registrado no período</p>
        )}
      </div>
    </div>
  );
}
