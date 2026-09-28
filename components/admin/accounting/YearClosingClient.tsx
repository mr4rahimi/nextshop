"use client";

/**
 * ویزارد بستن سال مالی — docs/plans/accounting.md بخش ۱۷.
 * سه قدم روی یک صفحه: بررسی‌ها ← خلاصه‌ی آنچه ساخته می‌شود ← تأیید.
 * سال بسته: سندهای بستن + بازگشایی (با دلیل).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleX, Lock, LockOpen } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { api, Badge, btn, Card, ErrorText, inputCls, Money, PageHeader, SectionTitle, Sheet } from "./ui";

interface Check {
  key: string;
  ok: boolean;
  level: "error" | "warning";
  title: string;
  detail?: string;
  href?: string;
}
interface Data {
  year: { id: string; title: string; startDate: string; endDate: string; status: "OPEN" | "CLOSED"; closedAt: string | null; closedByName: string | null };
  profit: string;
  nextYear: { id: string; title: string; status: string } | null;
  nextTitle: string;
  checks: Check[];
  canClose: boolean;
  canReopen: boolean;
  vouchers: { id: string; number: number; date: string; description: string; totalDebit: string }[];
  can: { manage: boolean };
}

export default function YearClosingClient({ yearId }: { yearId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [reopen, setReopen] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/years/${yearId}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [yearId]);
  useEffect(load, [load]);

  async function act(body: Record<string, unknown>, done: () => void) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/years/${yearId}`, { method: "POST", json: body });
      done();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!d) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const closed = d.year.status === "CLOSED";
  const profit = BigInt(d.profit);
  const errors = d.checks.filter((c) => !c.ok && c.level === "error").length;

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader
        title={`${closed ? "سال مالی" : "بستن سال مالی"} ${faNum(d.year.title)}`}
        help="accountingClosing"
        back={{ href: "/admin/accounting/settings?tab=years", label: "سال‌های مالی" }}
        desc={`${formatJalali(new Date(d.year.startDate))} تا ${formatJalali(new Date(d.year.endDate))}`}
      />
      <ErrorText>{error}</ErrorText>

      {/* وضعیت */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${closed ? "bg-gray-500/10 text-gray-500" : "bg-emerald-500/10 text-emerald-600"}`}>
            {closed ? <Lock className="h-6 w-6" aria-hidden /> : <LockOpen className="h-6 w-6" aria-hidden />}
          </div>
          <div className="flex-1 min-w-[12rem]">
            <p className="text-sm font-black text-gray-900 dark:text-white">{closed ? "این سال بسته است" : "این سال باز است"}</p>
            <p className="text-xs text-gray-500 mt-1 leading-6">
              {closed
                ? `بسته‌شده ${d.year.closedAt ? `در ${formatJalali(new Date(d.year.closedAt))}` : ""}${d.year.closedByName ? ` به دست ${d.year.closedByName}` : ""}. هیچ ثبت یا تغییری با تاریخ این سال ممکن نیست.`
                : "با بستن، سود یا زیان سال به «سود انباشته» می‌رود، مانده‌ی صندوق‌ها، بانک‌ها، اشخاص و کالا به سال بعد منتقل می‌شود و دفاتر این سال قفل می‌شوند."}
            </p>
          </div>
          <div className="text-left">
            <p className="text-[11px] font-bold text-gray-400">{profit >= 0n ? "سود سال" : "زیان سال"}</p>
            <Money value={profit < 0n ? -profit : profit} tone={profit >= 0n ? "green" : "red"} className="text-lg" />
          </div>
        </div>
      </Card>

      {!closed && (
        <>
          <Card className="p-4 sm:p-5">
            <SectionTitle title="۱. بررسی‌ها" />
            <ul className="space-y-2">
              {d.checks.map((c) => {
                const Icon = c.ok ? CheckCircle2 : c.level === "error" ? CircleX : AlertTriangle;
                const tone = c.ok ? "text-emerald-600" : c.level === "error" ? "text-red-600" : "text-amber-600";
                return (
                  <li key={c.key} className="flex gap-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] px-3 py-2.5">
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${tone}`} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${c.ok ? "text-gray-800 dark:text-gray-100" : tone}`}>{c.title}</p>
                      {c.detail && <p className="text-xs text-gray-500 mt-0.5 leading-6">{c.detail}</p>}
                    </div>
                    {c.href && !c.ok && (
                      <Link href={c.href} className={`${btn.small} self-center`}>
                        رسیدگی
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="۲. چه اتفاقی می‌افتد" />
            <ol className="space-y-2.5 text-sm text-gray-700 dark:text-gray-200 leading-7 list-decimal pr-5">
              <li>
                درآمدها و هزینه‌های سال صفر می‌شوند و {profit >= 0n ? "سود" : "زیان"} <Money value={profit < 0n ? -profit : profit} /> به «سود انباشته» می‌رود.
              </li>
              <li>
                مانده‌ی همه‌ی صندوق‌ها، بانک‌ها، طلب‌ها و بدهی‌های اشخاص، چک‌ها و ارزش کالا با یک سند افتتاحیه به سال {faNum(d.nextTitle)} منتقل می‌شود
                {d.nextYear ? "" : ` (سال ${faNum(d.nextTitle)} خودکار ساخته می‌شود)`}.
              </li>
              <li>تاریخ قفل دفاتر روی {formatJalali(new Date(d.year.endDate))} می‌رود و سال جاری {faNum(d.nextTitle)} می‌شود.</li>
            </ol>
            <p className="text-xs text-gray-400 mt-3 leading-6">
              موجودی کالا، چک‌ها و فاکتورهای باز دست نمی‌خورند و در سال بعد همان‌طور ادامه دارند. گزارش‌های سال {faNum(d.year.title)} بعد از بستن همان عددهای قبل را نشان
              می‌دهند.
            </p>
          </Card>

          {d.can.manage && (
            <div className="sticky bottom-20 md:bottom-4 z-10">
              <Card className="p-3 flex flex-wrap items-center gap-3">
                <p className="flex-1 text-xs text-gray-500 min-w-[10rem]">
                  {d.canClose ? "همه‌چیز آماده است." : `${faNum(errors)} مورد باید اول رسیدگی شود.`}
                </p>
                <button disabled={!d.canClose || busy} onClick={() => setConfirm(true)} className={btn.dark}>
                  <Lock className="h-4 w-4" aria-hidden />
                  بستن سال {faNum(d.year.title)}
                </button>
              </Card>
            </div>
          )}
        </>
      )}

      {closed && (
        <Card className="overflow-hidden">
          <div className="px-4 pt-4">
            <SectionTitle
              title="سندهای بستن"
              actions={
                d.can.manage &&
                d.canReopen && (
                  <button onClick={() => setReopen(true)} className={btn.small}>
                    <LockOpen className="h-3.5 w-3.5" aria-hidden />
                    بازگشایی
                  </button>
                )
              }
            />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {d.vouchers.map((v) => (
              <Link key={v.id} href={`/admin/accounting/vouchers/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                <Badge tone="blue">سند {faNum(v.number)}</Badge>
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">{v.description}</span>
                <span className="text-xs text-gray-400">{formatJalali(new Date(v.date))}</span>
              </Link>
            ))}
            {!d.vouchers.length && <p className="px-4 py-6 text-xs text-gray-400 text-center">این سال گردشی نداشت؛ سندی ساخته نشد.</p>}
          </div>
        </Card>
      )}

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`بستن سال ${faNum(d.year.title)}`}
        footer={
          <button
            disabled={busy || typed.trim() !== faNum(d.year.title)}
            onClick={() => act({ action: "close" }, () => setConfirm(false))}
            className={`${btn.dark} w-full`}
          >
            {busy ? "در حال بستن…" : "بستن سال"}
          </button>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-200 leading-7">
          بعد از بستن، هیچ فاکتور، دریافت، هزینه یا سندی با تاریخ سال {faNum(d.year.title)} ثبت یا اصلاح نمی‌شود. اگر لازم شد، مدیر می‌تواند سال را دوباره باز کند.
        </p>
        <label className="block mt-4">
          <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">برای تأیید، سال را بنویسید: {faNum(d.year.title)}</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value.replace(/[0-9]/g, (x) => faNum(x)))} className={inputCls} inputMode="numeric" autoFocus />
        </label>
      </Sheet>

      <Sheet
        open={reopen}
        onClose={() => setReopen(false)}
        title={`بازگشایی سال ${faNum(d.year.title)}`}
        footer={
          <button disabled={busy || !reason.trim()} onClick={() => act({ action: "reopen", reason }, () => setReopen(false))} className={`${btn.danger} w-full`}>
            {busy ? "…" : "بازگشایی سال"}
          </button>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-200 leading-7">
          سندهای بستن و افتتاحیه‌ی سال بعد باطل می‌شوند و قفل دفاتر به پیش از این سال برمی‌گردد. بعد از اصلاح، سال را دوباره ببندید.
        </p>
        <label className="block mt-4">
          <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">دلیل بازگشایی</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="مثلاً: فاکتور خرید اسفند جا مانده بود" />
        </label>
      </Sheet>
    </div>
  );
}
