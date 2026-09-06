"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * اجزای مشترک صفحات `/admin/sms`
 *
 * عمداً بدون کتابخانه‌ی UI اضافه — هر وابستگی جدید حجم باندل ادمین را بالا
 * می‌برد و این بخش قرار است سبک بماند.
 */

// ─── قالب‌بندی عدد و تاریخ ──────────────────────────────────────────

export function fa(n: number | string): string {
  return Number(n || 0).toLocaleString("fa-IR");
}

export function faDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── خطای API ───────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
  fixUrl?: string;
}

export function ErrorBox({ err, onRetry }: { err: ApiError | null; onRetry?: () => void }) {
  if (!err) return null;

  return (
    <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
      <p className="text-xs font-bold text-red-600 dark:text-red-400 leading-relaxed">{err.error}</p>
      <div className="flex gap-3 mt-2">
        {err.fixUrl && (
          <Link href={err.fixUrl} className="text-[10px] font-black text-primary-600 hover:underline">
            رفتن به تنظیمات ←
          </Link>
        )}
        {onRetry && (
          <button onClick={onRetry} className="text-[10px] font-black text-primary-600 hover:underline">
            تلاش دوباره
          </button>
        )}
      </div>
    </div>
  );
}

export function Notice({ text, ok }: { text: string; ok: boolean }) {
  return (
    <div
      className={`px-4 py-3 rounded-2xl text-xs font-bold leading-relaxed ${
        ok
          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
          : "bg-red-50 dark:bg-red-900/20 text-red-600"
      }`}
    >
      {text}
    </div>
  );
}

// ─── چیدمان ─────────────────────────────────────────────────────────

export function PageHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">{title}</h1>
        {hint && <p className="text-xs font-bold text-gray-500 mt-1 leading-relaxed">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  hint,
  children,
  action,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>}
            {hint && <p className="text-[11px] font-bold text-gray-400 mt-1 leading-relaxed">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="text-xs font-bold text-gray-400 text-center py-10 leading-relaxed">{text}</p>
  );
}

// ─── ورودی‌ها ───────────────────────────────────────────────────────

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary-500 transition-colors";

export function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  dir,
  type = "text",
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">{label}</span>
      <input
        type={type}
        dir={dir}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1.5 disabled:opacity-50`}
      />
      {hint && <span className="block text-[10px] font-bold text-gray-400 mt-1.5 leading-relaxed">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  rows = 5,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">{label}</span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1.5 leading-relaxed resize-y`}
      />
      {hint && <span className="block text-[10px] font-bold text-gray-400 mt-1.5 leading-relaxed">{hint}</span>}
    </label>
  );
}

export function Select<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`${inputClass} mt-1.5`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="block text-[10px] font-bold text-gray-400 mt-1.5 leading-relaxed">{hint}</span>}
    </label>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    ghost:
      "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700",
    danger: "bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}

// ─── جدول و صفحه‌بندی ───────────────────────────────────────────────

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full min-w-[560px] text-right">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            {head.map((h) => (
              <th key={h} className="pb-2.5 text-[10px] font-black text-gray-400 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({
  page,
  lastPage,
  total,
  onChange,
}: {
  page: number;
  lastPage: number;
  total?: number;
  onChange: (p: number) => void;
}) {
  if (lastPage <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <span className="text-[10px] font-bold text-gray-400">
        صفحه {fa(page)} از {fa(lastPage)}
        {total !== undefined && ` · ${fa(total)} مورد`}
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          قبلی
        </Button>
        <Button variant="ghost" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          بعدی
        </Button>
      </div>
    </div>
  );
}

export function Badge({ text, tone }: { text: string; tone: "ok" | "warn" | "bad" | "muted" }) {
  const styles = {
    ok: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
    warn: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
    bad: "bg-red-50 dark:bg-red-900/20 text-red-600",
    muted: "bg-gray-100 dark:bg-gray-800 text-gray-500",
  }[tone];

  return (
    <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap ${styles}`}>
      {text}
    </span>
  );
}

// ─── دریافت داده ────────────────────────────────────────────────────

/**
 * فراخوانی API با مدیریت خطای یکدست
 *
 * ⚠️ درخواست قبلی با AbortController لغو می‌شود — بدون این، تغییر سریع صفحه
 *    باعث می‌شود پاسخ دیرتر رسیده‌ی قدیمی روی داده‌ی جدید بنشیند.
 */
export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(url, { signal: controller.signal });
      const body = await res.json();

      if (!res.ok) {
        setErr({ error: body.error ?? "خطای نامشخص", code: body.code, fixUrl: body.fixUrl });
        setData(null);
      } else {
        setData(body as T);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErr({ error: "ارتباط با سرور برقرار نشد" });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { data, err, loading, reload: load };
}

/** ارسال درخواست نوشتنی با پیام خطای یکدست */
export async function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; err: ApiError }> {
  try {
    const res = await fetch(url, {
      method,
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    const d = await res.json();

    if (!res.ok) {
      return { ok: false, err: { error: d.error ?? "خطای نامشخص", code: d.code, fixUrl: d.fixUrl } };
    }
    return { ok: true, data: d as T };
  } catch {
    return { ok: false, err: { error: "ارتباط با سرور برقرار نشد" } };
  }
}
