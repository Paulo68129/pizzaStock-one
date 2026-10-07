import { useEffect, useState, useMemo } from 'react';
import { Brain, TrendingUp, Package, ShoppingCart, Lightbulb, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LineChart } from '@/components/Charts';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { Sale, Pizza, Ingredient, RecipeItem } from '@/lib/types';

interface ForecastResult {
  pizza: string;
  predictedQty: number;
  confidence: 'high' | 'medium' | 'low';
  trend: 'up' | 'down' | 'stable';
  trendPct: number;
}

interface PurchaseRec {
  ingredient: string;
  current: number;
  unit: string;
  needed: number;
  gap: number;
  unitCost: number;
  totalCost: number;
}

export function ForecastPage() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeItem[]>>({});
  const [forecastDays, setForecastDays] = useState(7);

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

  // Simple linear regression forecast using daily averages
  const forecasts = useMemo<ForecastResult[]>(() => {
    return pizzas.map((p) => {
      const pSales = sales.filter((s) => s.pizza_id === p.id);
      const dailyTotals = new Map<string, number>();

      pSales.forEach((s) => {
        const day = new Date(s.criada_em).toISOString().slice(0, 10);
        dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + s.quantidade);
      });

      const days = Array.from(dailyTotals.keys()).sort();
      const values = days.map((d) => dailyTotals.get(d) ?? 0);

      if (values.length < 3) {
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return {
          pizza: p.nome,
          predictedQty: Math.round(avg * forecastDays),
          confidence: 'low' as const,
          trend: 'stable' as const,
          trendPct: 0,
        };
      }

      // Linear regression: y = a + b*x
      const n = values.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = values.reduce((a, b, i) => a + b * i, 0);
      const sumX2 = values.reduce((a, _, i) => a + i * i, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;

      const lastValue = values[values.length - 1];
      const predictedPerDay = Math.max(0, intercept + slope * (n + forecastDays - 1));
      const avgDaily = values.reduce((a, b) => a + b, 0) / values.length;
      const blended = (predictedPerDay * 0.4 + avgDaily * 0.6);
      const predictedQty = Math.round(blended * forecastDays);

      const firstHalf = values.slice(0, Math.ceil(n / 2));
      const secondHalf = values.slice(Math.ceil(n / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length || 0;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length || 0;
      const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      const trend = trendPct > 10 ? 'up' as const : trendPct < -10 ? 'down' as const : 'stable' as const;
      const confidence = values.length >= 14 ? 'high' as const : values.length >= 7 ? 'medium' as const : 'low' as const;

      return { pizza: p.nome, predictedQty, confidence, trend, trendPct };
    }).sort((a, b) => b.predictedQty - a.predictedQty);
  }, [sales, pizzas, forecastDays]);

  // Purchase recommendations based on forecast + current stock
  const purchaseRecs = useMemo<PurchaseRec[]>(() => {
    const recMap = new Map<string, PurchaseRec>();

    forecasts.forEach((f) => {
      const pizza = pizzas.find((p) => p.nome === f.pizza);
      if (!pizza) return;
      const recipe = recipes[pizza.id] ?? [];
      recipe.forEach((r) => {
        const ing = r.ingredient;
        if (!ing) return;
        const needed = r.quantidade * f.predictedQty;
        const existing = recMap.get(ing.id) ?? {
          ingredient: ing.nome,
          current: Number(ing.estoque),
          unit: ing.unidade,
          needed: 0,
          gap: 0,
          unitCost: Number(ing.custo_unitario),
          totalCost: 0,
        };
        existing.needed += needed;
        recMap.set(ing.id, existing);
      });
    });

    return Array.from(recMap.values())
      .map((r) => {
        r.gap = Math.max(0, r.needed - r.current);
        r.totalCost = r.gap * r.unitCost;
        return r;
      })
      .filter((r) => r.gap > 0)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [forecasts, pizzas, recipes]);

  // Revenue projection
  const projectedRevenue = useMemo(() => {
    return forecasts.reduce((sum, f) => {
      const pizza = pizzas.find((p) => p.nome === f.pizza);
      return sum + (pizza?.preco ?? 0) * f.predictedQty;
    }, 0);
  }, [forecasts, pizzas]);

  // Historical daily revenue for chart
  const dailyData = useMemo(() => {
    const data: { label: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const rev = sales
        .filter((s) => { const sd = new Date(s.criada_em); return sd >= d && sd < next; })
        .reduce((s, x) => s + Number(x.valor_total), 0);
      data.push({ label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: rev });
    }
    return data;
  }, [sales]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const confidenceConfig = {
    high: { label: 'Alta', class: 'bg-emerald-100 text-emerald-700' },
    medium: { label: 'Média', class: 'bg-amber-100 text-amber-700' },
    low: { label: 'Baixa', class: 'bg-ink-100 text-ink-500' },
  };

  const trendConfig = {
    up: { icon: <TrendingUp size={14} />, class: 'text-emerald-600', label: 'Crescendo' },
    down: { icon: <TrendingUp size={14} className="rotate-180" />, class: 'text-red-500', label: 'Declinando' },
    stable: { icon: <TrendingUp size={14} className="rotate-45" />, class: 'text-ink-400', label: 'Estável' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-800 font-display flex items-center gap-2">
            <Brain size={24} className="text-brand-500" />
            Previsão de Demanda IA
          </h1>
          <p className="text-ink-500 text-sm mt-0.5">Análise preditiva e recomendações de compra</p>
        </div>
        <div className="flex gap-1 bg-ink-100 rounded-xl p-1">
          {([3, 7, 14] as const).map((d) => (
            <button
              key={d}
              onClick={() => setForecastDays(d)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                forecastDays === d ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5 bg-gradient-to-br from-brand-50 to-amber-50 border-brand-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white shrink-0">
            <Brain size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-ink-800 mb-1">Como funciona a previsão?</h3>
            <p className="text-sm text-ink-600 leading-relaxed">
              O sistema analisa o histórico de vendas de cada pizza usando regressão linear — identificando a tendência
              (crescimento, estabilidade ou queda) e projetando a demanda para os próximos {forecastDays} dias.
              Com base nisso, calcula automaticamente quais ingredientes precisam ser comprados.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Faturamento Projetado</p>
            <p className="text-xl font-bold text-ink-800 font-display">{formatCurrency(projectedRevenue)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Itens para Comprar</p>
            <p className="text-xl font-bold text-ink-800 font-display">{purchaseRecs.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Custo de Reposição</p>
            <p className="text-xl font-bold text-ink-800 font-display">
              {formatCurrency(purchaseRecs.reduce((s, r) => s + r.totalCost, 0))}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-ink-800 mb-1">Tendência de Faturamento</h3>
        <p className="text-xs text-ink-400 mb-5">Últimos 14 dias de receita</p>
        <LineChart data={dailyData} formatValue={formatCurrency} height={220} color="#8b5cf6" />
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} className="text-brand-500" />
          <h3 className="font-bold text-ink-800">Previsão por Pizza</h3>
        </div>
        <p className="text-xs text-ink-400 mb-5">Demanda projetada para os próximos {forecastDays} dias</p>
        <div className="space-y-3">
          {forecasts.map((f) => {
            const conf = confidenceConfig[f.confidence];
            const trend = trendConfig[f.trend];
            return (
              <div key={f.pizza} className="flex items-center gap-4 bg-ink-50 rounded-xl px-4 py-3.5">
                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 text-sm font-bold">
                  {f.pizza.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-700">{f.pizza}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium ${trend.class} flex items-center gap-0.5`}>
                      {trend.icon}
                      {trend.label}
                      {f.trendPct !== 0 && ` (${f.trendPct > 0 ? '+' : ''}${f.trendPct.toFixed(0)}%)`}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-ink-800 font-display">{f.predictedQty}</p>
                  <p className="text-xs text-ink-400">pizzas</p>
                </div>
                <span className={`badge text-[10px] ${conf.class}`}>{conf.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={18} className="text-brand-500" />
          <h3 className="font-bold text-ink-800">Recomendação de Compras</h3>
        </div>
        <p className="text-xs text-ink-400 mb-5">Ingredientes necessários para cobrir a demanda prevista</p>
        {purchaseRecs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-2">
              <Package size={22} />
            </div>
            <p className="text-sm text-ink-500 font-medium">Estoque suficiente para a demanda prevista</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Ingrediente</th>
                  <th className="px-4 py-3">Estoque Atual</th>
                  <th className="px-4 py-3">Necessário</th>
                  <th className="px-4 py-3">Comprar</th>
                  <th className="px-4 py-3">Custo Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {purchaseRecs.map((r) => (
                  <tr key={r.ingredient} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-ink-700">{r.ingredient}</td>
                    <td className="px-4 py-3 text-sm text-ink-500">{formatNumber(r.current)} {r.unit}</td>
                    <td className="px-4 py-3 text-sm text-ink-600">{formatNumber(r.needed)} {r.unit}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-brand-600">{formatNumber(r.gap)} {r.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-ink-800">{formatCurrency(r.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-brand-50">
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-brand-700 text-right">Custo Total de Reposição</td>
                  <td className="px-4 py-3 text-base font-bold text-brand-700 font-display">
                    {formatCurrency(purchaseRecs.reduce((s, r) => s + r.totalCost, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
