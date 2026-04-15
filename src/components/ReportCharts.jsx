import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// ─── Formatters ──────────────────────────────────────────────────────────────
export const fmt  = (n) => n != null ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0';
export const fmtK = (n, dec = 2) => {
  if (n == null) return '0';
  return Number(n).toLocaleString('tr-TR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

export const MONTH_NAMES = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const monthKey   = (d) => d?.substring(0, 7);
export const lastNMonths = (n) => {
  const res = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return res;
};
export const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`;
};

// ─── Interactive Bar Chart ────────────────────────────────────────────────────
export function BarChart({ data = [], color = '#10b981', color2, label1 = 'Deger 1', label2 = 'Deger 2', height = 160, unit = '' }) {
  const [tooltip, setTooltip] = useState(null);
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  if (!data.length) return <p className="text-xs text-center py-8" style={{ color: '#64748b' }}>Veri yok</p>;

  const max = Math.max(...data.map(d => Math.max(d.v1 || 0, d.v2 || 0)), 1);
  const BAR_W = color2 ? 14 : 28;
  const GAP   = color2 ? 4  : 0;
  const SLOT  = BAR_W * (color2 ? 2 : 1) + GAP + 8;
  const svgW  = Math.max(data.length * SLOT + 20, 300);
  const svgH  = height + 30;

  return (
    <div className="w-full">
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', minWidth: svgW }}>
          {/* Grid */}
          {[0.25, 0.5, 0.75, 1].map(p => (
            <line key={p} x1={0} y1={height - p * height} x2={svgW} y2={height - p * height}
              stroke="rgba(148,163,184,0.08)" strokeDasharray="3,3" />
          ))}
          {data.map((d, i) => {
            const x = i * SLOT + 4;
            const h1 = Math.max(((d.v1 || 0) / max) * (height - 8), d.v1 ? 3 : 0);
            const h2 = Math.max(((d.v2 || 0) / max) * (height - 8), d.v2 ? 3 : 0);
            return (
              <g key={i}>
                {/* Bar 1 */}
                <rect x={x} y={height - h1} width={BAR_W} height={h1} rx={3} fill={color} opacity={0.85}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, label: d.label, v1: d.v1, v2: d.v2 })}
                  onMouseLeave={() => setTooltip(null)} />
                {/* Bar 2 */}
                {color2 && (
                  <rect x={x + BAR_W + GAP} y={height - h2} width={BAR_W} height={h2} rx={3} fill={color2} opacity={0.75}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, label: d.label, v1: d.v1, v2: d.v2 })}
                    onMouseLeave={() => setTooltip(null)} />
                )}
                {/* X Label */}
                <text x={x + (color2 ? BAR_W + GAP / 2 : BAR_W / 2)} y={height + 14}
                  fontSize={9} fill={isDark ? '#64748b' : '#94a3b8'} textAnchor="middle">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Lejant */}
      {color2 && (
        <div className="flex gap-4 justify-center mt-2">
          <span className="flex items-center gap-1 text-[11px]" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />{label1}
          </span>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color2 }} />{label2}
          </span>
        </div>
      )}

      {/* Tooltip portal */}
      {tooltip && (
        <div className="fixed z-[999] pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
            style={{
              background: isDark ? '#0c1526' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : '#e2e8f0'}`,
              minWidth: 110,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}>
            <p className="font-bold mb-1" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{tooltip.label}</p>
            <p style={{ color }}>{label1}: {unit}{fmtK(tooltip.v1)}</p>
            {color2 && <p style={{ color: color2 }}>{label2}: {unit}{fmtK(tooltip.v2)}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
export function DonutChart({ slices = [], size = 110 }) {
  const [hovered, setHovered] = useState(null);
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const total = slices.reduce((s, sl) => s + (sl.value || 0), 0) || 1;
  let cum = -90;
  const polar = (angle, r) => ({
    x: 60 + r * Math.cos((angle * Math.PI) / 180),
    y: 60 + r * Math.sin((angle * Math.PI) / 180),
  });
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} viewBox="0 0 120 120" className="flex-shrink-0">
        {slices.map((sl, i) => {
          const angle = (sl.value / total) * 360;
          const s = polar(cum, 45); const e = polar(cum + angle, 45);
          const lg = angle > 180 ? 1 : 0;
          const d = `M60 60 L${s.x} ${s.y} A45 45 0 ${lg} 1 ${e.x} ${e.y} Z`;
          cum += angle;
          return (
            <path key={i} d={d} fill={sl.color}
              opacity={hovered === null || hovered === i ? 0.9 : 0.4}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)} />
          );
        })}
        <circle cx="60" cy="60" r="29" fill={isDark ? '#0c1526' : '#f8fafc'} />
        <text x="60" y="56" textAnchor="middle" fontSize="8" fill={isDark ? '#f1f5f9' : '#1e293b'} fontWeight="bold">
          {hovered !== null ? fmtK(slices[hovered]?.value) : slices.length}
        </text>
        <text x="60" y="67" textAnchor="middle" fontSize="6.5" fill="#64748b">
          {hovered !== null ? slices[hovered]?.label?.slice(0, 10) : 'kategori'}
        </text>
      </svg>
      <div className="flex-1 space-y-1.5">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center justify-between gap-2 cursor-pointer"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            style={{ opacity: hovered === null || hovered === i ? 1 : 0.5, transition: 'opacity 0.15s' }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sl.color }} />
              <span className="text-[11px] truncate" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{sl.label}</span>
            </div>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
              {fmt(sl.value)} <span style={{ color: '#64748b', fontWeight: 'normal' }}>({((sl.value / total) * 100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, icon: Icon, color, trend, delay = 0 }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="p-2.5 rounded-2xl flex-shrink-0" style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className="text-[11px] font-bold" style={{ color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-lg font-bold mt-3 leading-tight" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#64748b' }}>{label}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{sub}</p>}
    </div>
  );
}

// ─── Section Title ───────────────────────────────────────────────────────────
export function SectionTitle({ icon: Icon, title, sub, color }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <h2 className="text-sm font-bold" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{title}</h2>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Top 5 List ──────────────────────────────────────────────────────────────
export function TopList({ items = [], color, unit = '' }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  if (!items.length) return <p className="text-xs text-center py-6" style={{ color: '#64748b' }}>Veri yok</p>;
  const max = items[0]?.value || 1;
  return (
    <div className="space-y-2">
      {items.map(({ label, value }, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] truncate flex-1 mr-2" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{label}</span>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color }}>{unit}{fmtK(value)}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
