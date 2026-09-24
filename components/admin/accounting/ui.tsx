"use client";

/**
 * اجزای مشترک رابط حسابداری — docs/plans/accounting.md بخش ۱۳.
 *
 * همه‌ی صفحه‌های حسابداری از همین‌ها ساخته می‌شوند تا ظاهر و رفتار یکدست
 * بماند: یک کارت، یک دکمه، یک Sheet (پایین‌کش در موبایل، پنجره در دسکتاپ).
 */

import { useEffect, type ReactNode } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import type { HelpKey } from "@/components/admin/worklist/help-content";
import { formatAmount } from "@/lib/accounting/money";

export const inputCls =
  "w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-white/10 transition placeholder:text-gray-400";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition disabled:opacity-50",
  dark: "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold transition disabled:opacity-50",
  soft: "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 text-sm font-bold transition disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-600 text-sm font-bold transition disabled:opacity-50",
  small:
    "inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 text-xs font-bold transition disabled:opacity-50",
};

export function PageHeader({
  title,
  help,
  desc,
  actions,
  back,
}: {
  title: ReactNode;
  help?: HelpKey;
  desc?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5">
      {back && (
        <a href={back.href} className="inline-block text-xs font-bold text-blue-600 mb-2">
          → {back.label}
        </a>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-gray-900 dark:text-white">{title}</h1>
            {help && <HelpButton topic={help} />}
          </div>
          {desc && <p className="text-xs text-gray-500 mt-1 leading-6">{desc}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ title, help, actions }: { title: ReactNode; help?: HelpKey; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>
        {help && <HelpButton topic={help} size="sm" />}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 ${className}`}>
      {children}
    </div>
  );
}

type Tone = "green" | "red" | "amber" | "blue" | "gray";
const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-600",
  red: "text-red-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
  gray: "text-gray-900 dark:text-white",
};
const TONE_BADGE: Record<Tone, string> = {
  green: "bg-emerald-500/10 text-emerald-600",
  red: "bg-red-500/10 text-red-600",
  amber: "bg-amber-500/10 text-amber-600",
  blue: "bg-blue-500/10 text-blue-600",
  gray: "bg-gray-500/10 text-gray-500",
};

export function Stat({ label, value, sub, tone = "gray", href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; href?: string }) {
  const body = (
    <>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-base sm:text-lg font-black mt-1 ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </>
  );
  const cls = "block rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3.5";
  return href ? (
    <a href={href} className={`${cls} hover:border-blue-400 transition`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-block text-[10px] px-2 py-0.5 rounded-lg font-bold ${TONE_BADGE[tone]}`}>{children}</span>;
}

/** مبلغ با «تومان» کوچک */
export function Money({ value, tone, className = "" }: { value: string | bigint | number | null | undefined; tone?: Tone; className?: string }) {
  return (
    <span className={`font-black tabular-nums ${TONE_TEXT[tone ?? "gray"]} ${className}`}>
      {formatAmount(value)}
      <span className="text-[10px] font-bold text-gray-400 mr-1">تومان</span>
    </span>
  );
}

/**
 * مانده به زبان ساده: شخص — «طلب ما» / «بدهی ما»؛ خزانه — موجودی.
 * `balance` = بدهکار − بستانکار (رشته از JSON).
 */
export function BalanceLabel({ balance, kind = "party" }: { balance: string | bigint; kind?: "party" | "treasury" | "account" }) {
  const b = BigInt(balance);
  if (b === 0n) return <span className="text-xs font-bold text-gray-400">تسویه</span>;
  const abs = b < 0n ? -b : b;
  if (kind === "treasury") return <Money value={b} tone={b < 0n ? "red" : "gray"} />;
  if (kind === "account")
    return (
      <span className="text-left">
        <Money value={abs} />
        <span className="block text-[10px] text-gray-400">{b > 0n ? "بدهکار" : "بستانکار"}</span>
      </span>
    );
  return (
    <span className="text-left">
      <Money value={abs} tone={b > 0n ? "green" : "red"} />
      <span className={`block text-[10px] font-bold ${b > 0n ? "text-emerald-600" : "text-red-600"}`}>
        {b > 0n ? "طلب ما از او" : "بدهی ما به او"}
      </span>
    </span>
  );
}

export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1 leading-5">{hint}</span>}
    </label>
  );
}

export function Empty({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{title}</p>
      {desc && <p className="text-xs text-gray-400 mt-1.5 leading-6 max-w-sm mx-auto">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{children}</p>;
}

/**
 * پنجره‌ی فرم — در موبایل از پایین بالا می‌آید و تمام‌عرض است، در دسکتاپ
 * وسط صفحه. فوتر چسبان است تا دکمه‌ی ذخیره همیشه دیده شود.
 */
export function Sheet({
  open,
  onClose,
  title,
  help,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  help?: HelpKey;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-black text-gray-900 dark:text-white">{title}</h3>
            {help && <HelpButton topic={help} size="sm" />}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 text-lg leading-none" aria-label="بستن">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-white/5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** fetch با پیام خطای فارسی API */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const r = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? "انجام نشد");
  return d as T;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex p-1 rounded-xl bg-gray-100 dark:bg-white/5 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition ${
            value === o.value ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            value === o.value ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="mr-1 opacity-60">{o.count.toLocaleString("fa-IR")}</span>}
        </button>
      ))}
    </div>
  );
}
