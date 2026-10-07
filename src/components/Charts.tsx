interface BarChartProps {
  data: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  height?: number;
  color?: string;
}

export function BarChart({ data, formatValue, height = 200, color = '#f97316' }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2 w-full" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
            <div className="relative w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative"
                style={{ height: `${h}%`, backgroundColor: color, minHeight: d.value > 0 ? '4px' : '0' }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink-800 text-white text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none">
                  {formatValue ? formatValue(d.value) : d.value}
                </div>
              </div>
            </div>
            <span className="text-[10px] text-ink-400 font-medium truncate max-w-full">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  height?: number;
  color?: string;
}

export function LineChart({ data, formatValue, height = 200, color = '#f97316' }: LineChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const width = 100;
  const step = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = i * step;
    const y = 100 - ((d.value - min) / range) * 100;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${width} 100 L 0 100 Z`;

  return (
    <div className="w-full" style={{ height }}>
      <div className="relative w-full h-full">
        <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.5"
              fill={color}
              vectorEffect="non-scaling-stroke"
              className="opacity-0 hover:opacity-100 transition-opacity"
            >
              <title>{formatValue ? formatValue(p.value) : p.value}</title>
            </circle>
          ))}
        </svg>
        <div className="flex justify-between mt-2">
          {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0).map((d, i) => (
            <span key={i} className="text-[10px] text-ink-400 font-medium">{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {data.map((d, i) => {
            const pct = d.value / total;
            const dash = pct * circumference;
            const seg = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="text-2xl font-bold text-ink-800 font-display">{total}</span>
          <span className="text-xs text-ink-400">total</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-ink-600 font-medium">{d.label}</span>
            <span className="text-sm text-ink-400 ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
