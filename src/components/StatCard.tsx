import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  color?: 'brand' | 'green' | 'blue' | 'red' | 'purple';
  subtitle?: string;
}

const colorMap = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  blue: { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'ring-sky-100' },
  red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' },
  purple: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
};

export function StatCard({ label, value, icon, trend, color = 'brand', subtitle }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="card p-5 animate-slide-up hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <p className="text-2xl font-bold text-ink-800 mt-1 font-display">{value}</p>
          {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`shrink-0 w-11 h-11 rounded-xl ${c.bg} ${c.text} flex items-center justify-center ring-1 ${c.ring}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 mt-3">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              trend.positive ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {trend.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend.value}
          </span>
          <span className="text-xs text-ink-400">vs. período anterior</span>
        </div>
      )}
    </div>
  );
}
