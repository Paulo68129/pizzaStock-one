import { useEffect, useState } from 'react';
import { AlertTriangle, Package, Calendar, Bell, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatNumber, formatDate, daysUntil, getExpiryStatus } from '@/lib/format';
import type { Ingredient } from '@/lib/types';

interface Alert {
  id: string;
  type: 'low_stock' | 'expired' | 'critical' | 'warning';
  title: string;
  message: string;
  ingredient: Ingredient;
  severity: 'danger' | 'warning' | 'info';
}

export function AlertsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('ingredients').select('*').order('nome');
      setIngredients((data ?? []) as Ingredient[]);
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

  const alerts: Alert[] = [];

  ingredients.forEach((ing) => {
    const stock = Number(ing.estoque);
    const min = Number(ing.estoque_minimo);
    const expStatus = getExpiryStatus(ing.data_validade);
    const days = daysUntil(ing.data_validade);

    if (expStatus === 'expired') {
      alerts.push({
        id: `${ing.id}-expired`,
        type: 'expired',
        title: 'Ingrediente Vencido',
        message: `${ing.nome} venceu há ${Math.abs(days!)} dia(s). Descarte ou troque imediatamente.`,
        ingredient: ing,
        severity: 'danger',
      });
    }

    if (expStatus === 'critical') {
      alerts.push({
        id: `${ing.id}-critical`,
        type: 'critical',
        title: 'Validade Crítica',
        message: `${ing.nome} vence em ${days} dia(s). Use prioritariamente.`,
        ingredient: ing,
        severity: 'warning',
      });
    }

    if (stock <= 0) {
      alerts.push({
        id: `${ing.id}-out`,
        type: 'low_stock',
        title: 'Estoque Esgotado',
        message: `${ing.nome} está sem estoque. Reabasteça imediatamente.`,
        ingredient: ing,
        severity: 'danger',
      });
    } else if (stock <= min) {
      alerts.push({
        id: `${ing.id}-low`,
        type: 'low_stock',
        title: 'Estoque Baixo',
        message: `${ing.nome} está com ${formatNumber(stock)} ${ing.unidade} (mínimo: ${formatNumber(min)} ${ing.unidade}).`,
        ingredient: ing,
        severity: stock <= min * 0.5 ? 'danger' : 'warning',
      });
    }
  });

  const dangerCount = alerts.filter((a) => a.severity === 'danger').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const okCount = ingredients.length - new Set(alerts.map((a) => a.ingredient.id)).size;

  const severityConfig = {
    danger: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', label: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', label: 'bg-amber-100 text-amber-700' },
    info: { bg: 'bg-sky-50', border: 'border-sky-200', icon: 'bg-sky-100 text-sky-600', label: 'bg-sky-100 text-sky-700' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-800 font-display">Alertas</h1>
        <p className="text-ink-500 text-sm mt-0.5">Monitore estoque baixo e validades próximas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Alertas Críticos</p>
            <p className="text-xl font-bold text-ink-800 font-display">{dangerCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <Bell size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Atenções</p>
            <p className="text-xl font-bold text-ink-800 font-display">{warningCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Em Dia</p>
            <p className="text-xl font-bold text-ink-800 font-display">{okCount}</p>
          </div>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-ink-700 mb-1">Tudo em ordem!</h3>
          <p className="text-ink-400 text-sm">Nenhum alerta ativo no momento. Seu estoque está saudável.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.sort((a, b) => {
            const order = { danger: 0, warning: 1, info: 2 };
            return order[a.severity] - order[b.severity];
          }).map((alert) => {
            const cfg = severityConfig[alert.severity];
            return (
              <div key={alert.id} className={`card p-4 border ${cfg.border} ${cfg.bg} animate-slide-up`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.icon}`}>
                    {alert.type === 'expired' || alert.type === 'low_stock' ? (
                      <Package size={20} />
                    ) : (
                      <Calendar size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-ink-800">{alert.title}</h3>
                      <span className={`badge text-[10px] ${cfg.label}`}>
                        {alert.severity === 'danger' ? 'Crítico' : 'Atenção'}
                      </span>
                    </div>
                    <p className="text-sm text-ink-600">{alert.message}</p>
                    {alert.ingredient.data_validade && alert.type !== 'low_stock' && (
                      <p className="text-xs text-ink-400 mt-1">
                        Validade: {formatDate(alert.ingredient.data_validade)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
