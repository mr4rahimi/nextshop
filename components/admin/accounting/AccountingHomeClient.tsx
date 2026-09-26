"use client";

/**
 * خانه‌ی حسابداری — انتخاب حالت و نمای کلی (docs/plans/accounting.md بخش ۴.۴).
 *
 * حسابداری داخلی هنوز قابل انتخاب نیست: با راه‌اندازی سال مالی و سرفصل حساب‌ها
 * در فاز ۲ باز می‌شود. کارتش عمداً نشان داده می‌شود تا مسیر روشن باشد.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import HelpButton from "@/components/admin/worklist/HelpButton";
import { PageHeader } from "./ui";
import InternalDashboard from "./InternalDashboard";
import { useAccountingShell } from "./AccountingShell";
import { AppGrid } from "../AppGrid";

type Mode = "NONE" | "HESABAN" | "INTERNAL";

interface Data {
  mode: Mode;
  modeChangedAt: string | null;
  modeChangedBy: string | null;
  selectable: Mode[];
  hesaban: { status: string; autoInvoice: boolean; invoiceMode: "AUTO" | "MANUAL"; lastError: string | null } | null;
  counts: Record<string, number>;
  canLeaveInternal: boolean;
  can: { settings: boolean };
}

const MODES: { key: Mode; title: string; body: string; soon?: string }[] = [
  {
    key: "INTERNAL",
    title: "حسابداری داخلی",
    body: "اشخاص، صندوق و بانک، اسناد و مانده‌ها داخل همین پنل؛ فاکتور، چک، انبار و گزارش‌ها در نسخه‌های بعد به همین اضافه می‌شوند.",
  },
  {
    key: "HESABAN",
    title: "حسابان وب",
    body: "فروش‌ها مثل قبل به حسابان وب فرستاده می‌شوند و گزارش‌گیری در خود حسابان است.",
  },
  {
    key: "NONE",
    title: "بدون حسابداری",
    body: "هنوز حسابداری انتخاب نشده. فروشگاه کار می‌کند ولی دفتر مالی جایی نگه داشته نمی‌شود.",
  },
];

const CONN_STATUS: Record<string, { label: string; cls: string }> = {
  CONNECTED: { label: "متصل", cls: "bg-emerald-500/10 text-emerald-600" },
  SYNCING: { label: "در حال همگام‌سازی", cls: "bg-blue-500/10 text-blue-600" },
  ERROR: { label: "خطا", cls: "bg-red-500/10 text-red-600" },
  DISCONNECTED: { label: "قطع", cls: "bg-gray-500/10 text-gray-500" },
};

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function AccountingHomeClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Mode | null>(null);
  const router = useRouter();
  const shell = useAccountingShell();

  const load = useCallback(() => {
    fetch("/api/admin/accounting/settings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری نشد");
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری نشد"));
  }, []);

  useEffect(load, [load]);

  async function choose(mode: Mode) {
    if (!data || mode === data.mode) return;
    if (mode === "INTERNAL") {
      router.push("/admin/accounting/setup");
      return;
    }
    const msg =
      mode === "HESABAN"
        ? "حسابان وب به‌عنوان حسابداری کسب‌وکار انتخاب شود؟"
        : "حسابداری کنار گذاشته شود؟ فروش‌ها دیگر در هیچ دفتر مالی ثبت نمی‌شوند.";
    if (!window.confirm(msg)) return;
    setSaving(mode);
    const r = await fetch("/api/admin/accounting/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setSaving(null);
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? "ذخیره نشد");
      return;
    }
    load();
  }

  if (!data) {
    return error ? (
      <p className="text-xs font-bold text-red-600">{error}</p>
    ) : (
      <p className="text-xs text-gray-400">در حال بارگذاری…</p>
    );
  }

  if (data.mode === "INTERNAL") return <InternalDashboard canLeave={data.canLeaveInternal && data.can.settings} onLeft={load} />;

  const blocked = (data.counts.BLOCKED ?? 0) + (data.counts.FAILED ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="حسابداری"
        help="accounting"
        desc="انتخاب کنید حساب‌وکتاب کسب‌وکار کجا نگه داشته شود."
      />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <section>
        <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">حسابداری کسب‌وکار</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map((m) => {
            const active = data.mode === m.key;
            const selectable = data.can.settings && (data.selectable.includes(m.key) || m.key === "INTERNAL") && !active;
            return (
              <button
                key={m.key}
                type="button"
                disabled={!selectable || saving !== null}
                onClick={() => choose(m.key)}
                className={`text-right rounded-2xl border p-4 transition ${
                  active
                    ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500"
                    : "border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900"
                } ${selectable ? "hover:border-blue-400 cursor-pointer" : "cursor-default"} ${
                  m.soon && !active ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-gray-900 dark:text-white">{m.title}</p>
                  {active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-blue-500 text-white">فعال</span>
                  )}
                  {saving === m.key && <span className="text-[10px] text-gray-400">در حال ذخیره…</span>}
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-6">{m.body}</p>
                {m.key === "INTERNAL" && selectable && (
                  <p className="text-[11px] font-bold text-blue-600 mt-2">راه‌اندازی ←</p>
                )}
              </button>
            );
          })}
        </div>
        {data.modeChangedAt && (
          <p className="text-[11px] text-gray-400 mt-2">
            آخرین تغییر: {formatJalali(new Date(data.modeChangedAt))}
            {data.modeChangedBy && ` · ${data.modeChangedBy}`}
          </p>
        )}
      </section>

      {data.mode === "HESABAN" && (
        <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">اتصال حسابان وب</h2>
            {data.hesaban && (
              <span className={`text-[11px] px-2 py-1 rounded-lg font-bold ${CONN_STATUS[data.hesaban.status]?.cls ?? ""}`}>
                {CONN_STATUS[data.hesaban.status]?.label ?? data.hesaban.status}
              </span>
            )}
          </div>
          {data.hesaban ? (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-6">
                ثبت فاکتور فروش: {data.hesaban.autoInvoice ? (
                  <b className="text-emerald-600">روشن</b>
                ) : (
                  <b className="text-amber-600">خاموش</b>
                )}
                {data.hesaban.autoInvoice &&
                  (data.hesaban.invoiceMode === "MANUAL" ? " · فقط با انتخاب شما" : " · خودکار")}
              </p>
              {data.hesaban.lastError && (
                <p className="text-[11px] text-red-600">آخرین خطا: {data.hesaban.lastError}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-amber-600">هنوز اتصالی به حسابان ساخته نشده است.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/integration/connections/hesaban"
              className="px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold"
            >
              تنظیمات اتصال
            </Link>
            <Link
              href="/admin/integration/orders"
              className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-bold"
            >
              فاکتورهای فروش ارسالی
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">رویدادهای مالی</h2>
            <HelpButton topic="accountingEvents" size="sm" />
          </div>
          <Link href="/admin/accounting/events" className="text-xs font-bold text-blue-600">
            همه ←
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile label="در صف" value={data.counts.PENDING ?? 0} href="/admin/accounting/events?status=PENDING" />
          <Tile label="ثبت شد" value={data.counts.DONE ?? 0} href="/admin/accounting/events?status=DONE" />
          <Tile
            label="نیازمند رسیدگی"
            value={blocked}
            href="/admin/accounting/events?status=BLOCKED"
            tone={blocked > 0 ? "red" : undefined}
          />
          <Tile label="رد شده" value={data.counts.SKIPPED ?? 0} href="/admin/accounting/events?status=SKIPPED" />
        </div>
        <p className="text-[11px] text-gray-400 mt-2 leading-5">
          هر فروش، دریافت یا خریدی که حسابداری باید بداند اینجا یک رویداد می‌سازد. تا حسابداری داخلی روشن نشده،
          رویدادها «رد شده» می‌مانند.
        </p>
      </section>

      {shell && (
        <section>
          <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">بخش‌های حسابداری</h2>
          <div className="rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 py-2 shadow-[var(--adm-shadow)] sm:px-3">
            <AppGrid apps={shell.apps.filter((a) => a.href !== "/admin/accounting")} />
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "red" }) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3.5 hover:border-blue-400 transition"
    >
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-lg font-black mt-1 ${tone === "red" ? "text-red-600" : "text-gray-900 dark:text-white"}`}>
        {fa(value)}
      </p>
    </Link>
  );
}
