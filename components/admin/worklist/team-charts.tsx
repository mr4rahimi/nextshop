"use client";

/**
 * نمودارهای گزارش عملکرد تیم — کنار `components/admin/reports/charts.tsx`.
 *
 * همه SVG دست‌نویس‌اند، بی کتابخانه، مثل نمودارهای گزارش اصلی. محور افقی
 * همه‌جا `direction: ltr` است تا روز اول سمت چپ باشد، ولی برچسب‌ها فارسی‌اند.
 */

import { useState } from "react";
import { fa, faShort } from "@/components/admin/reports/charts";

function Empty({ h = "h-32" }: { h?: string }) {
  return (
    <div className={`${h} flex items-center justify-center text-xs text-gray-400`}>
      داده‌ای برای نمایش در این بازه نیست
    </div>
  );
}

// ── اسپارک‌لاین ──────────────────────────────────────────────────────────────
export function Sparkline({
  data, color = "#6366f1", width = 96, height = 28, fill = true,
}: { data: number[]; color?: string; width?: number; height?: number; fill?: boolean }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 2 - (v / max) * (height - 4)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const gid = `sp-${color.replace("#", "")}-${width}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ direction: "ltr", display: "block" }}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${gid})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── حلقه‌ی درصد ──────────────────────────────────────────────────────────────
export function RingGauge({
  value, size = 64, stroke = 7, color, label,
}: { value: number | null; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const tone = color ?? (v >= 80 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444");
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
          className="text-gray-100 dark:text-white/10" strokeWidth={stroke} />
        {value !== null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`}
            style={{ transition: "stroke-dasharray .6s ease" }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-black tabular-nums text-gray-900 dark:text-white">
          {value === null ? "—" : `${fa(v)}٪`}
        </span>
        {label && <span className="mt-0.5 text-[9px] font-bold text-gray-400">{label}</span>}
      </div>
    </div>
  );
}

// ── ستونی ترکیبی: ستون انباشته + خط ─────────────────────────────────────────
export interface ComboBar { key: string; label: string; color: string; data: number[] }
export interface ComboLine { key: string; label: string; color: string; data: number[]; dashed?: boolean }

/**
 * ستون‌های انباشته (مثلاً «به‌موقع» و «با تأخیر») و روی آن چند خط (ثبت‌شده،
 * ساعت حضور). خطی که `ownAxis` نیست با ستون‌ها هم‌مقیاس است.
 */
export function ComboChart({
  labels, bars, lines, height = 260, labelOf,
}: {
  labels: string[];
  bars: ComboBar[];
  lines: ComboLine[];
  height?: number;
  labelOf: (k: string) => string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  if (!n) return <Empty />;

  const W = 760, H = height, PL = 40, PR = 14, PT = 16, PB = 28;
  const pw = W - PL - PR, ph = H - PT - PB;
  const sb = bars.filter((b) => !hidden.has(b.key));
  const sl = lines.filter((l) => !hidden.has(l.key));
  const stack = labels.map((_, i) => sb.reduce((s, b) => s + b.data[i], 0));
  const max = Math.max(...stack, ...sl.flatMap((l) => l.data), 1) * 1.12;
  const slot = pw / n;
  const bw = Math.max(2, Math.min(26, slot * 0.62));
  const X = (i: number) => PL + slot * i + slot / 2;
  const Y = (v: number) => PT + ph - (v / max) * ph;

  const step = Math.max(1, Math.round(n / 7));
  const all = [...bars, ...lines];

  return (
    <div>
      <div style={{ direction: "ltr" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
          {[0, 1, 2, 3, 4].map((g) => {
            const v = (max * g) / 4, y = Y(v);
            return (
              <g key={g}>
                <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="#94a3b8" strokeOpacity=".14" strokeDasharray={g ? "3 5" : "0"} />
                <text x={PL - 6} y={y + 3.5} fontSize="10" fill="#94a3b8" textAnchor="end">{faShort(v)}</text>
              </g>
            );
          })}
          {labels.map((k, i) => (i % step === 0 || i === n - 1) && (
            <text key={k} x={X(i)} y={H - 8} fontSize="10" fill="#94a3b8" textAnchor="middle">{labelOf(k)}</text>
          ))}
          {hover !== null && (
            <rect x={PL + slot * hover} y={PT} width={slot} height={ph} fill="#6366f1" fillOpacity=".06" rx="4" />
          )}
          {labels.map((_, i) => {
            let acc = 0;
            return (
              <g key={i}>
                {sb.map((b, j) => {
                  const v = b.data[i];
                  if (!v) return null;
                  const y0 = Y(acc), y1 = Y(acc + v);
                  acc += v;
                  const top = j === sb.length - 1 || sb.slice(j + 1).every((x) => !x.data[i]);
                  return (
                    <rect key={b.key} x={X(i) - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1)}
                      fill={b.color} rx={top ? Math.min(4, bw / 3) : 0} opacity={hover === null || hover === i ? 1 : 0.55} />
                  );
                })}
              </g>
            );
          })}
          {sl.map((l) => {
            const d = l.data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
            return (
              <g key={l.key}>
                <path d={d} fill="none" stroke={l.color} strokeWidth="2.2" strokeLinejoin="round"
                  strokeLinecap="round" strokeDasharray={l.dashed ? "5 4" : undefined} />
                {hover !== null && <circle cx={X(hover)} cy={Y(l.data[hover])} r="4" fill={l.color} stroke="white" strokeWidth="2" />}
              </g>
            );
          })}
          {labels.map((_, i) => (
            <rect key={i} x={PL + slot * i} y={PT} width={slot} height={ph} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {all.map((s) => {
          const off = hidden.has(s.key);
          const isLine = lines.some((l) => l.key === s.key);
          const v = hover !== null ? s.data[hover] : s.data.reduce((a, b) => a + b, 0);
          return (
            <button key={s.key} type="button"
              onClick={() => setHidden((p) => { const x = new Set(p); if (x.has(s.key)) x.delete(s.key); else x.add(s.key); return x; })}
              className={`flex items-center gap-2 text-xs font-bold transition-opacity ${off ? "opacity-35" : ""}`}>
              {isLine
                ? <span className="w-3.5 h-0.5 rounded-full" style={{ background: s.color }} />
                : <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />}
              <span className="text-gray-600 dark:text-gray-300">{s.label}</span>
              <span className="text-gray-400 tabular-nums">{fa(v)}</span>
            </button>
          );
        })}
        {hover !== null && <span className="text-xs text-gray-400 mr-auto">{labelOf(labels[hover])}</span>}
      </div>
    </div>
  );
}

// ── ستونی ساده (هیستوگرام) ──────────────────────────────────────────────────
export function ColumnChart({
  items, height = 190, colors,
}: { items: { label: string; value: number }[]; height?: number; colors?: string[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <Empty />;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {items.map((it, i) => {
        const h = (it.value / max) * (height - 46);
        const c = colors?.[i] ?? "#6366f1";
        return (
          <div key={it.label} className="group flex-1 min-w-0 flex flex-col items-center justify-end h-full">
            <span className="text-[11px] font-black tabular-nums text-gray-700 dark:text-gray-200">{fa(it.value)}</span>
            <span className="text-[9.5px] tabular-nums text-gray-400 mb-1">{fa((it.value / total) * 100)}٪</span>
            <div className="w-full max-w-[52px] rounded-t-lg transition-all duration-500 group-hover:opacity-80"
              style={{ height: Math.max(3, h), background: `linear-gradient(to top, ${c}cc, ${c})` }} />
            <span className="mt-1.5 h-7 text-[9.5px] leading-tight text-center font-bold text-gray-500 line-clamp-2">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── نقشه‌ی حرارتی روز × ساعت ────────────────────────────────────────────────
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export function Heatmap({ grid, color = "99,102,241" }: { grid: number[][]; color?: string }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(...grid.flat(), 0);
  if (!max) return <Empty />;
  // ساعت‌هایی که در کل بازه هیچ کاری ندارند از دو سر حذف می‌شوند
  const used = Array.from({ length: 24 }, (_, h) => grid.some((r) => r[h] > 0));
  let first = used.indexOf(true), last = used.lastIndexOf(true);
  first = Math.max(0, Math.min(first, 8));
  last = Math.min(23, Math.max(last, 18));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const dayTotals = grid.map((r) => r.reduce((a, b) => a + b, 0));
  const hourTotals = hours.map((h) => grid.reduce((s, r) => s + r[h], 0));
  const peakHour = hours[hourTotals.indexOf(Math.max(...hourTotals))];
  const peakDay = dayTotals.indexOf(Math.max(...dayTotals));

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="flex gap-[3px] mb-1 pr-16" style={{ direction: "ltr" }}>
            {hours.map((h) => (
              <span key={h} className="flex-1 text-center text-[9px] tabular-nums text-gray-400">
                {h % 2 === 0 ? fa(h) : ""}
              </span>
            ))}
          </div>
          {grid.map((row, d) => (
            <div key={d} className="flex items-center gap-2 mb-[3px]">
              <span className="w-14 flex-shrink-0 text-[10px] font-bold text-gray-500 text-left">{WEEKDAYS[d]}</span>
              <div className="flex-1 flex gap-[3px]" style={{ direction: "ltr" }}>
                {hours.map((h) => {
                  const v = row[h];
                  const a = v ? 0.12 + (v / max) * 0.88 : 0;
                  const on = hover?.d === d && hover?.h === h;
                  return (
                    <div key={h}
                      onMouseEnter={() => setHover({ d, h })} onMouseLeave={() => setHover(null)}
                      className={`flex-1 h-6 rounded-[5px] transition-transform ${v ? "" : "bg-gray-100 dark:bg-white/[0.04]"} ${on ? "scale-110 ring-2 ring-indigo-400/60" : ""}`}
                      style={v ? { background: `rgba(${color},${a})` } : undefined}
                      title={`${WEEKDAYS[d]} ساعت ${fa(h)} — ${fa(v)} کار`} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-500">
        {hover ? (
          <span className="font-bold text-gray-700 dark:text-gray-200">
            {WEEKDAYS[hover.d]}، ساعت {fa(hover.h)} تا {fa(hover.h + 1)}: {fa(grid[hover.d][hover.h])} کار
          </span>
        ) : (
          <>
            <span>پرکارترین ساعت: <b className="text-gray-700 dark:text-gray-200">{fa(peakHour)} تا {fa(peakHour + 1)}</b></span>
            <span>پرکارترین روز: <b className="text-gray-700 dark:text-gray-200">{WEEKDAYS[peakDay]}</b></span>
          </>
        )}
        <span className="mr-auto flex items-center gap-1">
          کم
          {[0.15, 0.35, 0.6, 0.85, 1].map((a) => (
            <span key={a} className="w-3 h-3 rounded-[3px]" style={{ background: `rgba(${color},${a})` }} />
          ))}
          زیاد
        </span>
      </div>
    </div>
  );
}

// ── رادار ────────────────────────────────────────────────────────────────────
export interface RadarSeries { key: string; label: string; color: string; values: number[]; dashed?: boolean }

/** مقادیر ۰ تا ۱۰۰ — هر محور جداگانه نسبت به بهترینِ تیم نرمال می‌شود */
export function RadarChart({ axes, series, size = 300 }: { axes: string[]; series: RadarSeries[]; size?: number }) {
  const n = axes.length;
  if (n < 3 || !series.length) return <Empty />;
  const cx = size / 2, cy = size / 2, R = size / 2 - 52;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)] as const;
  };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size + 40 }}>
        {[25, 50, 75, 100].map((lv) => (
          <polygon key={lv} points={axes.map((_, i) => pt(i, lv).join(",")).join(" ")}
            fill={lv === 100 ? "#6366f1" : "none"} fillOpacity={lv === 100 ? 0.03 : 0}
            stroke="#94a3b8" strokeOpacity=".22" strokeDasharray={lv === 100 ? "0" : "3 4"} />
        ))}
        {axes.map((ax, i) => {
          const [x, y] = pt(i, 100);
          const [lx, ly] = pt(i, 122);
          return (
            <g key={ax}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#94a3b8" strokeOpacity=".22" />
              <text x={lx} y={ly + 3} fontSize="10.5" fontWeight="700" fill="#64748b" textAnchor="middle">{ax}</text>
            </g>
          );
        })}
        {series.map((s) => (
          <g key={s.key}>
            <polygon points={s.values.map((v, i) => pt(i, v).join(",")).join(" ")}
              fill={s.color} fillOpacity={s.dashed ? 0.04 : 0.16} stroke={s.color} strokeWidth="2"
              strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
            {!s.dashed && s.values.map((v, i) => {
              const [x, y] = pt(i, v);
              return <circle key={i} cx={x} cy={y} r="3" fill={s.color} stroke="white" strokeWidth="1.5" />;
            })}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
            <span className="w-3 h-0.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── پراکندگی: حجم در برابر کیفیت ─────────────────────────────────────────────
export interface ScatterPoint { id: string; label: string; x: number; y: number; r: number; color: string }

/**
 * هر کارمند یک حباب: افقی حجم کار، عمودی درصد کیفیت، اندازه سومین بعد.
 * خط‌چین‌ها میانه‌ی تیم‌اند و صفحه را به چهار ناحیه تقسیم می‌کنند.
 */
export function ScatterChart({
  points, xLabel, yLabel, onPick, activeId,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  onPick?: (id: string) => void;
  activeId?: string | null;
}) {
  const [hover, setHover] = useState<string | null>(null);
  if (points.length < 2) return <Empty h="h-48" />;
  const W = 560, H = 300, PL = 40, PR = 18, PT = 16, PB = 34;
  const pw = W - PL - PR, ph = H - PT - PB;
  const maxX = Math.max(...points.map((p) => p.x), 1) * 1.1;
  const maxR = Math.max(...points.map((p) => p.r), 1);
  const X = (v: number) => PL + (v / maxX) * pw;
  const Y = (v: number) => PT + ph - (v / 100) * ph;
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const mx = med(points.map((p) => p.x)), my = med(points.map((p) => p.y));
  const hp = points.find((p) => p.id === hover);

  return (
    <div style={{ direction: "ltr" }} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <rect x={X(mx)} y={PT} width={W - PR - X(mx)} height={Y(my) - PT} fill="#10b981" fillOpacity=".05" />
        <rect x={PL} y={Y(my)} width={X(mx) - PL} height={PT + ph - Y(my)} fill="#ef4444" fillOpacity=".04" />
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="#94a3b8" strokeOpacity=".12" />
            <text x={PL - 6} y={Y(v) + 3.5} fontSize="10" fill="#94a3b8" textAnchor="end">{fa(v)}٪</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={X(maxX * f)} y={H - 16} fontSize="10" fill="#94a3b8" textAnchor="middle">{fa(maxX * f)}</text>
        ))}
        <line x1={X(mx)} x2={X(mx)} y1={PT} y2={PT + ph} stroke="#6366f1" strokeOpacity=".35" strokeDasharray="4 4" />
        <line x1={PL} x2={W - PR} y1={Y(my)} y2={Y(my)} stroke="#6366f1" strokeOpacity=".35" strokeDasharray="4 4" />
        <text x={W - PR} y={H - 2} fontSize="10" fontWeight="700" fill="#64748b" textAnchor="end">{xLabel} ←</text>
        <text x={PL + 4} y={PT + 10} fontSize="10" fontWeight="700" fill="#64748b">↑ {yLabel}</text>
        <text x={W - PR - 6} y={PT + 14} fontSize="10" fontWeight="800" fill="#10b981" textAnchor="end">پرکار و دقیق</text>
        <text x={PL + 6} y={PT + ph - 6} fontSize="10" fontWeight="800" fill="#ef4444">نیازمند توجه</text>
        {[...points].sort((a, b) => b.r - a.r).map((p) => {
          const r = 7 + Math.sqrt(p.r / maxR) * 15;
          const on = hover === p.id || activeId === p.id;
          return (
            <g key={p.id} style={{ cursor: onPick ? "pointer" : undefined }}
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onClick={() => onPick?.(p.id)}>
              <circle cx={X(p.x)} cy={Y(p.y)} r={r} fill={p.color} fillOpacity={on ? 0.85 : 0.55}
                stroke={on ? "#1e1b4b" : "white"} strokeWidth={on ? 2 : 1.5} />
              <text x={X(p.x)} y={Y(p.y) + 3.5} fontSize="9.5" fontWeight="800" fill="white" textAnchor="middle" pointerEvents="none">
                {p.label.slice(0, 2)}
              </text>
            </g>
          );
        })}
      </svg>
      {hp && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-xl bg-gray-900/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg" style={{ direction: "rtl" }}>
          {hp.label} · {fa(hp.x)} کار · {fa(hp.y)}٪
        </div>
      )}
    </div>
  );
}

// ── میله‌ی انباشته‌ی افقی برای هر کارمند ───────────────────────────────────────
export function StackedRows({
  rows, keys, onPick, activeId,
}: {
  rows: { id: string; label: string; values: Partial<Record<string, number>> }[];
  keys: { key: string; label: string; color: string }[];
  onPick?: (id: string) => void;
  activeId?: string | null;
}) {
  const totals = rows.map((r) => keys.reduce((s, k) => s + (r.values[k.key] ?? 0), 0));
  const max = Math.max(...totals, 0);
  if (!max) return <Empty />;
  const used = keys.filter((k) => rows.some((r) => r.values[k.key]));
  return (
    <div>
      <div className="space-y-2">
        {rows.map((r, i) => totals[i] > 0 && (
          <button key={r.id} type="button" onClick={() => onPick?.(r.id)}
            className={`w-full flex items-center gap-3 rounded-xl px-2 py-1 text-right transition-colors ${
              activeId === r.id ? "bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
            }`}>
            <span className="w-24 flex-shrink-0 truncate text-xs font-bold text-gray-700 dark:text-gray-200">{r.label}</span>
            <span className="flex-1 flex h-3.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5">
              <span className="flex h-full" style={{ width: `${(totals[i] / max) * 100}%` }}>
                {used.map((k) => {
                  const v = r.values[k.key] ?? 0;
                  return v ? (
                    <span key={k.key} title={`${k.label}: ${fa(v)}`} className="h-full first:rounded-r-full last:rounded-l-full"
                      style={{ width: `${(v / totals[i]) * 100}%`, background: k.color }} />
                  ) : null;
                })}
              </span>
            </span>
            <span className="w-10 flex-shrink-0 text-left text-xs font-black tabular-nums text-gray-500">{fa(totals[i])}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {used.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── نوار سهم یک‌تکه ───────────────────────────────────────────────────────────
export function ShareBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <Empty h="h-16" />;
  return (
    <div>
      <div className="flex h-4 rounded-full overflow-hidden gap-[2px]">
        {items.map((it) => (
          <span key={it.label} title={`${it.label}: ${fa(it.value)}`}
            style={{ width: `${(it.value / total) * 100}%`, background: it.color }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] px-2.5 py-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: it.color }} />
            <span className="flex-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate">{it.label}</span>
            <span className="text-xs font-black tabular-nums text-gray-800 dark:text-gray-100">{fa(it.value)}</span>
            <span className="text-[10px] tabular-nums text-gray-400">{fa((it.value / total) * 100)}٪</span>
          </div>
        ))}
      </div>
    </div>
  );
}
