"use client";

/**
 * اجزای کوچک مشترک بخش لینک‌سازی — دیالوگ، سوئیچ، تأیید، پیام کوتاه، و
 * خوراک داده.
 *
 * برتر این‌ها را از `shared/components/ui` داشت؛ فروشگاه کتابخانه‌ی UI
 * ندارد و هر صفحه کلاس Tailwind خودش را می‌نویسد. اینجا فقط همان چند تکه‌ای
 * است که رابط لینک‌سازیِ برتر لازم دارد، با رنگ و گوشه‌ی پنل فروشگاه.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const inputCls =
  "w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400 disabled:opacity-50";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40",
  outline:
    "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-xs font-bold disabled:opacity-40",
  danger:
    "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold disabled:opacity-40",
  small:
    "inline-flex items-center justify-center gap-1 h-8 px-3 rounded-xl text-[11.5px] font-bold disabled:opacity-40",
};

export const card = "rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900";

export const fa = (n: number) => n.toLocaleString("fa-IR");

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────
// خوراک داده
// ─────────────────────────────────────────────────────────────────

/**
 * `fetch` ساده با بارگذاری دوباره. `url` خالی یعنی فعلاً نگیر.
 *
 * ⚠️ `reload` داده‌ی قبلی را نگه می‌دارد تا صفحه با هر تغییر کوچک به حالت
 * «در حال بارگذاری» نپرد.
 */
export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        if (alive) {
          setData(d as T);
          setError(null);
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- وابستگی‌های بیرونی صریح داده می‌شوند
  }, [url, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** درخواست نوشتنی با پیام خطای فارسی سرور */
export async function send<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "انجام نشد");
  return d as T;
}

// ─────────────────────────────────────────────────────────────────
// پیام کوتاه
// ─────────────────────────────────────────────────────────────────

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastContext = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = ++seq.current;
    setItems((cur) => [...cur, { id, text, tone }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), tone === "error" ? 6000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-2 pointer-events-none px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg max-w-md",
              t.tone === "error" ? "bg-red-600 text-white" : "bg-gray-900 dark:bg-white text-white dark:text-gray-900",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ─────────────────────────────────────────────────────────────────
// دیالوگ
// ─────────────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-5",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 text-lg leading-none"
            aria-label="بستن"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-xs leading-6 text-gray-600 dark:text-gray-300">{message}</p>
      <div className="flex gap-2 pt-4">
        <button type="button" className={cn(btn.danger, "flex-1")} disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className={btn.outline} onClick={onClose}>
          انصراف
        </button>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────
// ورودی‌ها
// ─────────────────────────────────────────────────────────────────

export function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11.5px] font-bold text-gray-600 dark:text-gray-300 mb-1">
      {children}
    </label>
  );
}

export function Hint({ children, tone }: { children: React.ReactNode; tone?: "warn" | "error" }) {
  return (
    <p
      className={cn(
        "mt-1 text-[11px] leading-5",
        tone === "error"
          ? "rounded-lg bg-red-50 dark:bg-red-500/10 px-2.5 py-1.5 text-red-600 dark:text-red-400"
          : tone === "warn"
            ? "text-amber-600 dark:text-amber-400"
            : "text-gray-400",
      )}
    >
      {children}
    </p>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-[12.5px] font-bold text-gray-700 dark:text-gray-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-blue-500" : "bg-gray-300 dark:bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-0.5" : "left-[22px]",
          )}
        />
      </button>
    </label>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 dark:border-white/10 p-3">
      <p className="text-[11.5px] font-black text-gray-500">{title}</p>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5", className)} />;
}
