"use client";

import { useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────
export const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");

export function faShort(v: number) {
  if (v >= 1e6) return fa(v / 1e6) + "م";
  if (v >= 1e3) return fa(v / 1e3) + "ه";
  return fa(v);
}

/** برچسب کوتاه فارسی برای یک روز (YYYY-MM-DD) */
export function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}

export interface Series {
  key: string;
  label: string;
  color: string;
  data: number[];
}

// ── نمودار خطی چندسری ────────────────────────────────────────────────────────
/**
 * چند سری روی یک محور، با راهنمای تعاملی.
 *
 * سری‌ها با کلیک روی راهنما خاموش/روشن می‌شوند؛ محور Y فقط بر اساس سری‌های
 * روشن مقیاس می‌گیرد تا یک سری بزرگ بقیه را صاف نکند.
 */
export function MultiLineChart({
  id, days, series, height = 260,
}: {
  id: string; days: string[]; series: Series[]; height?: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<number | null>(null);

  const shown = series.filter((s) => !hidden.has(s.key));
  const n = days.length;
  if (!n) return <Empty />;

  const W = 760, H = height;
  const PL = 44, PR = 16, PT = 18, PB = 30;
  const plotW = W - PL - PR, plotH = H - PT - PB;

  const allValues = shown.flatMap((s) => s.data);
  const max = Math.max(...allValues, 1);
  const top = max * 1.15 || 1;

  const X = (i: number) => PL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const Y = (v: number) => PT + plotH - (v / top) * plotH;

  const smooth = (pts: [number, number][]) => {
    if (pts.length === 0) return "";
    if (pts.length < 3) return "M " + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
      const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };

  const gridLines = [0, 1, 2, 3, 4].map((g) => {
    const val = (top * g) / 4;
    return { val, yy: Y(val) };
  });

  const step = Math.max(1, Math.round((n - 1) / 6));
  const xLabels: number[] = [];
  for (let i = 0; i < n; i += step) xLabels.push(i);
  if (xLabels[xLabels.length - 1] !== n - 1) xLabels.push(n - 1);

  const bw = n <= 1 ? plotW : plotW / (n - 1);

  return (
    <div>
      <div style={{ direction: "ltr" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}
          onMouseLeave={() => setHovered(null)}>
          <defs>
            {shown.map((s) => (
              <linearGradient key={s.key} id={`rg-${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.20" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>

          {gridLines.map(({ val, yy }, g) => (
            <g key={g}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#94a3b8" strokeOpacity="0.13"
                strokeWidth="1" strokeDasharray={g === 0 ? "0" : "3 5"} />
              <text x={PL - 6} y={yy + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
                {faShort(val)}
              </text>
            </g>
          ))}

          {xLabels.map((i) => (
            <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {dayLabel(days[i])}
            </text>
          ))}

          {shown.map((s) => {
            const pts = s.data.map((v, i) => [X(i), Y(v)] as [number, number]);
            const line = smooth(pts);
            const area = `${line} L ${X(n - 1).toFixed(1)} ${(PT + plotH).toFixed(1)} L ${X(0).toFixed(1)} ${(PT + plotH).toFixed(1)} Z`;
            return (
              <g key={s.key}>
                <path d={area} fill={`url(#rg-${id}-${s.key})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.4"
                  strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}

          {days.map((_, i) => (
            <rect key={i} x={X(i) - bw / 2} y={PT} width={bw} height={plotH}
              fill="transparent" style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHovered(i)} />
          ))}

          {hovered !== null && (
            <g>
              <line x1={X(hovered)} y1={PT} x2={X(hovered)} y2={PT + plotH}
                stroke="#6366f1" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
              {shown.map((s) => (
                <circle key={s.key} cx={X(hovered)} cy={Y(s.data[hovered])} r="4.5"
                  fill={s.color} stroke="white" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
      </div>

      {}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {series.map((s) => {
          const off = hidden.has(s.key);
          const val = hovered !== null ? s.data[hovered] : s.data.reduce((a, b) => a + b, 0);
          return (
            <button key={s.key} type="button"
              onClick={() => setHidden((prev) => {
                const next = new Set(prev);
                if (next.has(s.key)) next.delete(s.key); else next.add(s.key);
                return next;
              })}
              className={`flex items-center gap-2 text-xs font-bold transition-opacity ${off ? "opacity-35" : ""}`}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-gray-600 dark:text-gray-300">{s.label}</span>
              <span className="text-gray-400 tabular-nums">{fa(val)}</span>
            </button>
          );
        })}
        {hovered !== null && (
          <span className="text-xs text-gray-400 mr-auto">{dayLabel(days[hovered])}</span>
        )}
      </div>
    </div>
  );
}

// ── نمودار دونات ─────────────────────────────────────────────────────────────
export function DonutChart({
  items, size = 168,
}: {
  items: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <Empty />;

  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {items.map((it, i) => {
            const frac = it.value / total;
            const dash = frac * c;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={it.color}
                strokeWidth={active === i ? 20 : 15}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                style={{ transition: "stroke-width .15s" }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)} />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {fa(active !== null ? items[active].value : total)}
          </span>
          <span className="text-[11px] text-gray-400 font-bold">
            {active !== null ? items[active].label : "کل"}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-[140px] space-y-1.5">
        {items.map((it, i) => (
          <div key={i}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1 transition-colors ${
              active === i ? "bg-gray-100 dark:bg-white/5" : ""
            }`}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: it.color }} />
            <span className="flex-1 font-bold text-gray-600 dark:text-gray-300 truncate">{it.label}</span>
            <span className="tabular-nums text-gray-400">{fa(it.value)}</span>
            <span className="tabular-nums text-gray-300 dark:text-gray-600 w-10 text-left">
              {fa((it.value / total) * 100)}٪
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── نمودار میله‌ای افقی ──────────────────────────────────────────────────────
export function HBarChart({
  items,
}: {
  items: { label: string; value: number; color?: string; sub?: string }[];
}) {
  if (items.length === 0) return <Empty />;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between mb-1.5 gap-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{it.label}</span>
            <span className="text-xs tabular-nums text-gray-400 flex-shrink-0">{fa(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? "#6366f1" }} />
          </div>
          {}
          {it.sub && (
            <p className="mt-1.5 text-[10.5px] leading-5 text-gray-400 dark:text-gray-500">{it.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="h-32 flex items-center justify-center text-xs text-gray-400">
      داده‌ای برای نمایش در این بازه نیست
    </div>
  );
}
