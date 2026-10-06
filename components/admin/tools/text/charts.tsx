"use client";

/**
 * نمودارهای سبک کاراکترشمار — بدون کتابخانه، SVG و div ساده با رنگ‌های
 * Tailwind تا در حالت تیره هم درست باشند. docs/features/tools.md بخش ۵
 */

import type { ReactNode } from "react";

const fa = (n: number) => n.toLocaleString("fa-IR");

export type ChartTone = "blue" | "emerald" | "amber" | "rose" | "violet" | "teal" | "gray";

const BAR: Record<ChartTone, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  gray: "bg-gray-300 dark:bg-white/20",
};

const STROKE: Record<ChartTone, string> = {
  blue: "text-blue-500",
  emerald: "text-emerald-500",
  amber: "text-amber-400",
  rose: "text-rose-500",
  violet: "text-violet-500",
  teal: "text-teal-500",
  gray: "text-gray-300 dark:text-white/20",
};

export function scoreTone(score: number): ChartTone {
  return score >= 80 ? "emerald" : score >= 50 ? "amber" : "rose";
}

/** حلقه‌ی امتیاز ۰ تا ۱۰۰ */
export function ScoreRing({ score, size = 112, label }: { score: number | null; size?: number; label?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = score == null ? "gray" : scoreTone(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-current text-gray-100 dark:text-white/10" />
        {score != null && (
          <circle
            cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
            className={`stroke-current transition-[stroke-dashoffset] duration-500 ${STROKE[tone]}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{score == null ? "—" : fa(score)}</span>
        {label && <span className="text-[10px] font-bold text-gray-400">{label}</span>}
      </div>
    </div>
  );
}

/** نوار طول با سه ناحیه: کوتاه، مناسب، بلند */
export function LengthMeter({
  value, min, idealMax, max, unit, label,
}: { value: number; min: number; idealMax: number; max: number; unit: string; label: string }) {
  const end = Math.max(max * 1.15, value);
  const pos = (v: number) => `${Math.min(100, (v / end) * 100)}%`;
  const tone = value > max ? "rose" : value > idealMax || value < min ? "amber" : "emerald";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
        <span className="tabular-nums text-gray-500">
          <b className="text-sm text-gray-900 dark:text-white">{fa(value)}</b> {unit}
          {" · "}
          {min ? `${fa(min)}–${fa(idealMax)}` : `تا ${fa(idealMax)}`}
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div className="absolute inset-y-0 bg-emerald-500/15" style={{ right: pos(min), width: `calc(${pos(idealMax)} - ${pos(min)})` }} />
        <div className="absolute inset-y-0 bg-amber-400/15" style={{ right: pos(idealMax), width: `calc(${pos(max)} - ${pos(idealMax)})` }} />
        <div className={`absolute inset-y-0 right-0 rounded-full transition-all duration-300 ${BAR[tone]}`} style={{ width: pos(value) }} />
      </div>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  sub?: string;
  tone?: ChartTone;
}

/** نمودار میله‌ای افقی — برچسب راست، میله وسط، عدد چپ */
export function HBarChart({ items, tone = "blue", empty, onPick }: {
  items: BarItem[];
  tone?: ChartTone;
  empty?: string;
  onPick?: (label: string) => void;
}) {
  if (!items.length) return <p className="py-6 text-center text-xs text-gray-400">{empty ?? "داده‌ای نیست"}</p>;
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={it.label}>
          <button
            type="button"
            onClick={() => onPick?.(it.label)}
            disabled={!onPick}
            className="group grid w-full grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 rounded-lg px-1.5 py-1 text-right text-xs transition enabled:hover:bg-gray-50 dark:enabled:hover:bg-white/5"
          >
            <span className="truncate font-bold text-gray-800 dark:text-gray-100" dir="auto">{it.label}</span>
            <span className="h-5 overflow-hidden rounded-md bg-gray-100 dark:bg-white/5">
              <span
                className={`block h-full rounded-md transition-all duration-500 ${BAR[it.tone ?? tone]}`}
                style={{ width: `${Math.max(4, (it.value / max) * 100)}%`, opacity: 1 - i * 0.045 }}
              />
            </span>
            <span className="flex min-w-[5.5rem] items-baseline justify-end gap-2 tabular-nums">
              <b className="text-gray-900 dark:text-white">{fa(it.value)}</b>
              {it.sub && <span className="w-10 text-left text-[10.5px] text-gray-400">{it.sub}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** ستون‌های عمودی — طول جمله‌ها/پاراگراف‌ها، با خط آستانه */
export function ColumnChart({
  values, threshold, unit, onPick, height = 140,
}: { values: number[]; threshold?: number; unit: string; onPick?: (i: number) => void; height?: number }) {
  if (!values.length) return <p className="py-6 text-center text-xs text-gray-400">متنی نیست</p>;
  const max = Math.max(...values, threshold ?? 0, 1);
  return (
    <div className="relative" style={{ height }}>
      {threshold != null && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-rose-400/70"
          style={{ bottom: `${(threshold / max) * 100}%` }}
        >
          <span className="absolute -top-4 left-0 text-[10px] font-bold text-rose-500">{fa(threshold)} {unit}</span>
        </div>
      )}
      <div className="flex h-full items-end gap-[2px]">
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            title={`#${fa(i + 1)} — ${fa(v)} ${unit}`}
            onClick={() => onPick?.(i)}
            className={`min-w-[3px] flex-1 rounded-t-sm transition hover:opacity-70 ${threshold != null && v > threshold ? "bg-rose-400" : "bg-blue-400 dark:bg-blue-500"}`}
            style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  tone: ChartTone;
}

/** دونات ترکیب نویسه‌ها با راهنما */
export function Donut({ segments, center }: { segments: DonutSegment[]; center?: ReactNode }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="14" className="stroke-current text-gray-100 dark:text-white/10" />
          {total > 0 &&
            segments.filter((s) => s.value > 0).map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label} cx="50" cy="50" r={r} fill="none" strokeWidth="14"
                  strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc}
                  className={`stroke-current ${STROKE[s.tone]}`}
                >
                  <title>{`${s.label}: ${fa(s.value)}`}</title>
                </circle>
              );
              acc += len;
              return el;
            })}
        </svg>
        {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span className={`h-2.5 w-2.5 rounded-full ${BAR[s.tone]}`} />
              {s.label}
            </span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="text-gray-700 dark:text-gray-200">{fa(s.value)}</span>
              <span className="w-8 text-left text-[10.5px] text-gray-400">{total ? `${fa(Math.round((s.value / total) * 100))}٪` : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
