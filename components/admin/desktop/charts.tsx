"use client";

/**
 * نمودارهای پیشخوان — SVG دست‌ساز، بی‌کتابخانه.
 *
 * رنگ‌ها از متغیرهای `--dk-*` در app/styles/desktop.css می‌آیند (پالت دسته‌ای
 * مرجع با پله‌های جدای شب). خط ۲ پیکسل، میله با سر گرد، شبکه‌ی کم‌رنگ، و
 * لایه‌ی هاور با راهنمای عمودی و برچسب در همه‌ی نمودارها.
 *
 * مستندات: docs/features/admin-desktop.md
 */

import Link from "next/link";
import { useId, useRef, useState, type PointerEvent } from "react";

// ── قالب عدد و تاریخ ─────────────────────────────────────────────────────

export const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");

/** عدد کوتاه برای محور و کارت: ۱٫۲ میلیون، ۳۴۰ هزار */
export function faShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(+(v / 1e9).toFixed(1)).toLocaleString("fa-IR")} میلیارد`;
  if (a >= 1e6) return `${(+(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)).toLocaleString("fa-IR")} میلیون`;
  if (a >= 1e3) return `${fa(v / 1e3)} هزار`;
  return fa(v);
}

/** تاریخ شمسی کوتاه n روز پیش */
export function daysAgoLabel(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** سقف «گرد» محور تا خطوط شبکه روی عددهای خوانا بیفتند */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

// ── برچسب هاور ────────────────────────────────────────────────────────────

function Tip({ x, y, children, flip }: { x: number; y: number; children: React.ReactNode; flip?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[8rem] rounded-xl border border-[var(--dk-edge)] bg-[var(--dk-glass-strong)] px-3 py-2 text-[11px] shadow-lg backdrop-blur-xl"
      style={{
        left: `${x}%`,
        top: y,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
      }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-[var(--dk-ink-2)]">
        <span
          className="inline-block h-0.5 w-3 rounded-full"
          style={dashed ? { backgroundImage: `linear-gradient(90deg, ${color} 50%, transparent 50%)`, backgroundSize: "4px 2px" } : { background: color }}
        />
        {label}
      </span>
      <span className="font-black tabular-nums text-[var(--dk-ink)]">{value}</span>
    </div>
  );
}

// ── خط کوچک کارت شاخص ────────────────────────────────────────────────────

export function Sparkline({ data, color = "var(--dk-s1)" }: { data: number[]; color?: string }) {
  const id = useId();
  const n = data.length;
  if (n < 2) return null;
  const W = 120, H = 36, P = 3;
  const mx = Math.max(...data, 1);
  const xs = (i: number) => P + (i * (W - 2 * P)) / (n - 1);
  const ys = (v: number) => H - P - (v / mx) * (H - 2 * P);
  const d = data.map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${W - P} ${H - P} L${P} ${H - P}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── روند با دوره‌ی قبل ───────────────────────────────────────────────────

/**
 * نمودار مساحتی یک سری با خط‌چین «دوره‌ی قبل» هم‌طول برای مقایسه.
 * زمان از چپ به راست، امروز سمت راست. `values` و `prev` هم‌طول‌اند.
 */
export function TrendChart({
  values, prev, format, label, height = 220,
}: {
  values: number[];
  prev: number[];
  format: (v: number) => string;
  label: string;
  height?: number;
}) {
  const gid = useId();
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  if (n < 2) return null;

  const W = 640, H = height, PL = 8, PR = 56, PT = 12, PB = 26;
  const pw = W - PL - PR, ph = H - PT - PB;
  const top = niceMax(Math.max(...values, ...prev) * 1.08);
  const x = (i: number) => PL + (i * pw) / (n - 1);
  const y = (v: number) => PT + ph - (v / top) * ph;
  const line = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const cur = line(values);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  const xLabels = [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];

  const onMove = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PL) / pw) * (n - 1)))));
  };

  return (
    <div ref={box} className="dk-chart relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height, direction: "ltr" }} preserveAspectRatio="none" role="img" aria-label={label}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dk-s1)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--dk-s1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--dk-grid)" strokeDasharray={t ? "0" : "0"} vectorEffect="non-scaling-stroke" />
            <text x={W - PR + 8} y={y(t) + 4} fontSize="10.5" fill="var(--dk-ink-3)">{faShort(t)}</text>
          </g>
        ))}
        <path d={line(prev)} fill="none" stroke="var(--dk-prev)" strokeWidth="1.6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={`${cur} L${x(n - 1)} ${PT + ph} L${x(0)} ${PT + ph}Z`} fill={`url(#${gid})`} />
        <path d={cur} fill="none" stroke="var(--dk-s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {xLabels.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="10.5" fill="var(--dk-ink-3)" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
            {i === n - 1 ? "امروز" : daysAgoLabel(n - 1 - i)}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PT} y2={PT + ph} stroke="var(--dk-ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(prev[hover])} r="3.5" fill="var(--dk-prev)" stroke="var(--dk-glass-strong)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(values[hover])} r="4.5" fill="var(--dk-s1)" stroke="var(--dk-glass-strong)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tip x={(x(hover) / W) * 100} y={y(values[hover]) * (height / H)} flip={hover > n / 2}>
          <div className="mb-1 font-bold text-[var(--dk-ink)]">{hover === n - 1 ? "امروز" : daysAgoLabel(n - 1 - hover)}</div>
          <TipRow color="var(--dk-s1)" label="این دوره" value={format(values[hover])} />
          <TipRow color="var(--dk-prev)" label="دوره‌ی قبل" value={format(prev[hover])} dashed />
        </Tip>
      )}
    </div>
  );
}

// ── ستون روزانه ──────────────────────────────────────────────────────────

export function DailyBars({ values, unit, label, height = 120 }: { values: number[]; unit: string; label: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  const W = 600, H = height, PB = 4, PT = 6;
  const top = niceMax(Math.max(...values, 1));
  const slot = W / n;
  const bw = Math.max(2, slot - 2); // ۲ پیکسل فاصله‌ی سطح میان ستون‌ها
  const ph = H - PT - PB;

  const onMove = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };

  return (
    <div ref={box} className="dk-chart relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height, direction: "ltr" }} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1="0" x2={W} y1={H - PB} y2={H - PB} stroke="var(--dk-grid)" vectorEffect="non-scaling-stroke" />
        {values.map((v, i) => {
          const h = Math.max(v ? 3 : 0, (v / top) * ph);
          const bx = i * slot + 1;
          const by = H - PB - h;
          const r = Math.min(4, bw / 2, h);
          return (
            <path
              key={i}
              d={`M${bx} ${H - PB} V${by + r} Q${bx} ${by} ${bx + r} ${by} H${bx + bw - r} Q${bx + bw} ${by} ${bx + bw} ${by + r} V${H - PB}Z`}
              fill="var(--dk-s3)"
              opacity={hover === null || hover === i ? 1 : 0.45}
            />
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={((hover + 0.5) / n) * 100} y={height / 2} flip={hover > n / 2}>
          <div className="mb-1 font-bold text-[var(--dk-ink)]">{hover === n - 1 ? "امروز" : daysAgoLabel(n - 1 - hover)}</div>
          <TipRow color="var(--dk-s3)" label={unit} value={fa(values[hover])} />
        </Tip>
      )}
      <div className="mt-1 flex justify-between text-[10.5px] text-[var(--dk-ink-3)]">
        <span>{daysAgoLabel(n - 1)}</span>
        <span>امروز</span>
      </div>
    </div>
  );
}

// ── دونات ────────────────────────────────────────────────────────────────

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  sub?: string;
  href?: string;
}

/** دونات با فاصله‌ی ۲ پیکسلی میان قطعه‌ها، جمع در مرکز و راهنمای کلیک‌پذیر */
export function Donut({ slices, center, centerSub }: { slices: DonutSlice[]; center: string; centerSub: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = sum(slices.map((s) => s.value)) || 1;
  const R = 52, SW = 16, C = 2 * Math.PI * R;
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2.5 : 0;
  const offsets = slices.map((_, i) => sum(slices.slice(0, i).map((s) => (s.value / total) * C)));
  const active = slices.find((s) => s.key === hover);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 140 140" className="h-36 w-36 flex-shrink-0 -rotate-90" role="img" aria-label={centerSub}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--dk-grid)" strokeWidth={SW} />
        {slices.map((s, i) => {
          const len = (s.value / total) * C;
          const dash = Math.max(0, len - gap);
          const el = s.value > 0 && (
            <circle
              key={s.key}
              cx="70" cy="70" r={R} fill="none"
              stroke={s.color}
              strokeWidth={hover === s.key ? SW + 4 : SW}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offsets[i]}
              style={{ transition: "stroke-width .15s ease", cursor: s.href ? "pointer" : undefined }}
              onPointerEnter={() => setHover(s.key)}
              onPointerLeave={() => setHover(null)}
            />
          );
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "70px 70px" }}>
          <text x="70" y="68" textAnchor="middle" fontSize="17" fontWeight="900" fill="var(--dk-ink)">
            {active ? fa(active.value) : center}
          </text>
          <text x="70" y="86" textAnchor="middle" fontSize="9.5" fill="var(--dk-ink-3)">
            {active ? active.label : centerSub}
          </text>
        </g>
      </svg>
      <ul className="w-full min-w-0 space-y-1">
        {slices.map((s) => {
          const body = (
            <>
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="flex-1 truncate text-[var(--dk-ink-2)]">{s.label}</span>
              <span className="font-black tabular-nums text-[var(--dk-ink)]">{fa(s.value)}</span>
              <span className="w-10 text-left tabular-nums text-[var(--dk-ink-3)]">{fa((s.value / total) * 100)}٪</span>
            </>
          );
          const cls = `flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${hover === s.key ? "bg-[var(--adm-hover)]" : ""}`;
          return (
            <li key={s.key} onPointerEnter={() => setHover(s.key)} onPointerLeave={() => setHover(null)}>
              {s.href ? <Link href={s.href} className={`${cls} hover:bg-[var(--adm-hover)]`}>{body}</Link> : <div className={cls}>{body}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── نقشه‌ی حرارتی هفته × ساعت ───────────────────────────────────────────

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** شبکه‌ی ۷×۲۴ با شش پله‌ی یک‌رنگ؛ صفر خانه‌ی خالی است */
export function Heatmap({ grid }: { grid: number[][] }) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const step = (v: number) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)));
  const LW = 52, CW = 22, CH = 22, G = 3;
  const W = LW + 24 * (CW + G), H = 7 * (CH + G) + 18;
  const rowTotal = grid.map(sum);
  const colTotal = Array.from({ length: 24 }, (_, h) => sum(grid.map((r) => r[h])));
  const peakH = colTotal.indexOf(Math.max(...colTotal));
  const peakD = rowTotal.indexOf(Math.max(...rowTotal));

  return (
    <div>
      <div ref={box} className="dk-chart relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" style={{ direction: "ltr" }} role="img" aria-label="سفارش‌ها به تفکیک روز هفته و ساعت">
          {grid.map((row, d) => (
            <g key={d}>
              <text x={LW - 8} y={d * (CH + G) + CH / 2 + 4} textAnchor="end" fontSize="10.5" fill="var(--dk-ink-3)">{WEEKDAYS[d]}</text>
              {row.map((v, h) => (
                <rect
                  key={h}
                  className="dk-heat-cell"
                  x={LW + h * (CW + G)}
                  y={d * (CH + G)}
                  width={CW}
                  height={CH}
                  rx="5"
                  fill={`var(--dk-seq-${step(v)})`}
                  onPointerEnter={() => setHover({ d, h })}
                  onPointerLeave={() => setHover(null)}
                />
              ))}
            </g>
          ))}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <text key={h} x={LW + h * (CW + G) + CW / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="var(--dk-ink-3)">
              {fa(h)}
            </text>
          ))}
        </svg>
        {hover && (
          <Tip x={((LW + hover.h * (CW + G) + CW / 2) / W) * 100} y={hover.d * (CH + G) + 10} flip={hover.h > 11}>
            <div className="mb-1 font-bold text-[var(--dk-ink)]">
              {WEEKDAYS[hover.d]}، ساعت {fa(hover.h)} تا {fa(hover.h + 1)}
            </div>
            <TipRow color="var(--dk-seq-4)" label="سفارش" value={fa(grid[hover.d][hover.h])} />
          </Tip>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--dk-ink-2)]">
        <span>
          پرسفارش‌ترین روز: <b className="text-[var(--dk-ink)]">{WEEKDAYS[peakD]}</b> · ساعت اوج:{" "}
          <b className="text-[var(--dk-ink)]">{fa(peakH)} تا {fa(peakH + 1)}</b>
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          کم
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className="h-3 w-3 rounded-[3px]" style={{ background: `var(--dk-seq-${s})` }} />
          ))}
          زیاد
        </span>
      </div>
    </div>
  );
}

// ── فهرست میله‌ای افقی ───────────────────────────────────────────────────

export function BarList({
  rows, color = "var(--dk-s1)", format = fa,
}: {
  rows: { key: string; label: string; value: number; href?: string; sub?: string }[];
  color?: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-[var(--dk-ink-2)]">{r.label}</span>
              <span className="flex-shrink-0 font-black tabular-nums text-[var(--dk-ink)]">
                {format(r.value)}
                {r.sub && <span className="mr-1 font-normal text-[var(--dk-ink-3)]">{r.sub}</span>}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--dk-grid)]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, background: color }} />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <Link href={r.href} className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--adm-hover)]">{body}</Link>
            ) : (
              <div className="px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
