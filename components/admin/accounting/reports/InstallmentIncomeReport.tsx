"use client";

/**
 * «کارمزد اقساط» — شناسایی کارمزد به تناسب زمان (webhesab-parity.md بخش ۳۴.۳).
 * مانده‌ی کارمزد به‌دست‌نیامده در برابر حساب، سند ماهانه، پیش‌بینی ۱۲ ماه، برنامه‌ها،
 * و تبدیل یک‌باره‌ی برنامه‌های پیش از ۲.۱۶۲.۰.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { api, Badge, btn, Card, ErrorText, PageHeader, Segmented, SectionTitle, Stat } from "../ui";
import { Amt, Table, td, tdNum, th, thNum } from "./kit";

type Side = "sales" | "purchase";
interface Row {
  planId: string;
  invoiceId: string;
  side: Side;
  label: string;
  partyName: string;
  number: number | null;
  feeDate: string | null;
  lastDue: string | null;
  fee: string;
  deferred: boolean;
  recognized: string;
  remaining: string;
  settled: boolean;
}
interface Acc {
  id: string;
  code: string;
  name: string;
}
interface Status {
  mode: string;
  accruedThrough: string | null;
  lastClosed: string;
  behind: boolean;
  accounts: Record<string, Acc>;
  sales: { open: string; book: string; diff: string };
  purchase: { open: string; book: string; diff: string };
  legacy: { count: number; fee: string };
  forecast: { month: string; end: string; sales: string; purchase: string }[];
  rows: Row[];
  can: { settings: boolean };
}
interface Preview {
  asOf: string;
  rows: { planId: string; invoiceId: string; side: Side; label: string; fee: string; earned: string; unearned: string; priorYear: boolean }[];
  sales: string;
  purchase: string;
  voucherId: string | null;
}

const big = (v: string) => BigInt(v);

export default function InstallmentIncomeReport() {
  const [s, setS] = useState<Status | null>(null);
  const [side, setSide] = useState<Side>("sales");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Status>("/api/admin/accounting/installment-income")
      .then(setS)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function act(action: "post" | "preview" | "convert") {
    if (action === "convert" && !confirm("سهم ماه‌های آینده‌ی کارمزد برنامه‌های قدیمی با یک سند به «کارمزد به‌دست‌نیامده» برگردد و از این به بعد ماه‌به‌ماه شناسایی شود؟")) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await api<{ result: Preview & { message?: string } }>("/api/admin/accounting/installment-income", { method: "POST", json: { action } });
      if (action === "preview") setPreview(r.result);
      else {
        setPreview(null);
        setNote(action === "post" ? r.result.message ?? "انجام شد." : `${faNum(r.result.rows.length)} برنامه تبدیل شد.`);
        load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const sales = side === "sales";
  const cur = s ? (sales ? s.sales : s.purchase) : null;
  const acc = s?.accounts[sales ? "INSTALLMENT_DEFERRED" : "INSTALLMENT_PREPAID"];
  const rows = (s?.rows ?? []).filter((r) => r.side === side);
  const thisMonth = s?.forecast[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="کارمزد اقساط"
        help="accountingInstallmentIncome"
        back={{ href: "/admin/accounting/reports", label: "گزارش‌ها" }}
        desc="کارمزد قسط‌بندی بهای زمان است: روز قسط‌بندی کنار گذاشته می‌شود و هر ماه سهم همان ماه درآمد می‌شود — ماه‌های اول که مشتری بدهی بیشتری دارد، سهم بیشتر."
        actions={
          <Link href={`/admin/accounting/installments?side=${side}`} className={btn.soft}>
            قسط‌ها
          </Link>
        }
      />
      <ErrorText>{error}</ErrorText>
      {note && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10">{note}</p>}
      <Segmented
        value={side}
        onChange={(v) => setSide(v)}
        options={[
          { value: "sales", label: "فروش — درآمد" },
          { value: "purchase", label: "خرید — هزینه" },
        ]}
      />
      {!s || !cur ? (
        !error && <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={sales ? "کارمزدی که هنوز به دست نیامده" : "کارمزدی که هنوز هزینه نشده"}
              value={<Amt v={cur.open} strong />}
              sub={`${faNum(rows.filter((r) => r.deferred && big(r.remaining) > 0n).length)} برنامه`}
              href={acc ? `/admin/accounting/accounts/${acc.id}` : undefined}
            />
            <Stat
              label={sales ? "درآمد این ماه (پیش‌بینی)" : "هزینه‌ی این ماه (پیش‌بینی)"}
              value={<Amt v={thisMonth ? (sales ? thisMonth.sales : thisMonth.purchase) : "0"} strong />}
              sub={thisMonth?.month}
              tone="green"
            />
            <Stat
              label="آخرین سند ماهانه"
              value={<span className="text-base">{s.accruedThrough ? formatJalali(new Date(s.accruedThrough)) : "هنوز نه"}</span>}
              sub="آخر هر ماه خودکار"
            />
            <Stat
              label="تطبیق با دفتر"
              value={big(cur.diff) === 0n ? <span className="text-base text-emerald-600">یکی است</span> : <Amt v={cur.diff} strong />}
              sub={acc ? `حساب ${faNum(Number(acc.code))} ${acc.name}` : "حساب هنوز ساخته نشده"}
              tone={big(cur.diff) === 0n ? "green" : "amber"}
              href={acc ? `/admin/accounting/accounts/${acc.id}` : undefined}
            />
          </div>

          {s.behind && (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm">
                سند {formatJalali(new Date(s.lastClosed))} (آخر ماه گذشته) هنوز زده نشده. worker هر چند ساعت خودش می‌زند.
              </p>
              {s.can.settings && (
                <button onClick={() => act("post")} disabled={busy} className={btn.small}>
                  همین حالا ثبت کن
                </button>
              )}
            </Card>
          )}

          {s.legacy.count > 0 && s.mode === "INTERNAL" && (
            <Card className="space-y-3 p-4">
              <SectionTitle title="برنامه‌های قدیمی — یک بار تبدیل کنید" />
              <p className="text-sm leading-7 text-gray-600 dark:text-gray-300">
                کارمزد {faNum(s.legacy.count)} برنامه‌ی اقساط (<Amt v={s.legacy.fee} /> تومان) روز قسط‌بندی یک‌جا درآمد یا هزینه شده است. با تبدیل، سهم ماه‌هایی که هنوز نیامده با یک سند برمی‌گردد و از این به بعد ماه‌به‌ماه شناسایی می‌شود. پول و قسط‌ها دست نمی‌خورند.
              </p>
              {s.can.settings ? (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => act("preview")} disabled={busy} className={btn.soft}>
                    پیش‌نمایش سند
                  </button>
                  {preview && (
                    <button onClick={() => act("convert")} disabled={busy} className={btn.primary}>
                      {busy ? "…" : "تبدیل و ثبت سند"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">تبدیل مجوز «تنظیمات حسابداری» می‌خواهد.</p>
              )}
              {preview && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    شناسایی‌شده تا {formatJalali(new Date(preview.asOf))}. برگشت به حساب انتظار: فروش <Amt v={preview.sales} strong />، خرید <Amt v={preview.purchase} strong />.
                  </p>
                  <Table
                    head={
                      <tr>
                        <th className={th}>فاکتور</th>
                        <th className={thNum}>کارمزد</th>
                        <th className={thNum}>به دست آمده</th>
                        <th className={thNum}>ماه‌های آینده</th>
                      </tr>
                    }
                  >
                    {preview.rows.map((r) => (
                      <tr key={r.planId}>
                        <td className={td}>
                          <Link href={`/admin/accounting/invoices/${r.invoiceId}#installments`} className="font-bold text-blue-600">
                            {r.label}
                          </Link>
                          {r.priorYear && <span className="mr-2"><Badge tone="amber">سال قبل ← سود انباشته</Badge></span>}
                        </td>
                        <td className={tdNum}><Amt v={r.fee} /></td>
                        <td className={tdNum}><Amt v={r.earned} /></td>
                        <td className={tdNum}><Amt v={r.unearned} strong /></td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
            </Card>
          )}

          <Card className="space-y-3 p-4">
            <SectionTitle title={sales ? "درآمد کارمزد ۱۲ ماه آینده" : "هزینه‌ی کارمزد ۱۲ ماه آینده"} />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {s.forecast.map((f) => {
                const v = sales ? f.sales : f.purchase;
                return (
                  <div key={f.end} className={`rounded-xl px-3 py-2 ${big(v) ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-gray-50 dark:bg-white/5"}`}>
                    <p className="text-[11px] text-gray-500">{f.month}</p>
                    <p className="text-sm"><Amt v={v} strong={big(v) > 0n} muted={!big(v)} /></p>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] leading-5 text-gray-400">با همین برنامه‌ها؛ تسویه‌ی زودتر یا تغییر زمان‌بندی در سند ماه بعد خودش جبران می‌شود.</p>
          </Card>

          <Table
            head={
              <tr>
                <th className={th}>فاکتور</th>
                <th className={th}>شروع</th>
                <th className={th}>آخرین قسط</th>
                <th className={thNum}>کارمزد</th>
                <th className={thNum}>{sales ? "درآمد شده" : "هزینه شده"}</th>
                <th className={thNum}>مانده</th>
              </tr>
            }
          >
            {rows.map((r) => (
              <tr key={r.planId}>
                <td className={td}>
                  <Link href={`/admin/accounting/invoices/${r.invoiceId}#installments`} className="font-bold text-blue-600">
                    {faNum(r.number ?? 0)} — {r.partyName}
                  </Link>
                  {!r.deferred && <span className="mr-2"><Badge tone="amber">قدیمی — یک‌جا</Badge></span>}
                  {r.deferred && r.settled && big(r.remaining) > 0n && <span className="mr-2"><Badge tone="green">تسویه شد — آخر ماه کامل</Badge></span>}
                </td>
                <td className={td}>{r.feeDate ? formatJalali(new Date(r.feeDate)) : "—"}</td>
                <td className={td}>{r.lastDue ? formatJalali(new Date(r.lastDue)) : "—"}</td>
                <td className={tdNum}><Amt v={r.fee} /></td>
                <td className={tdNum}><Amt v={r.recognized} /></td>
                <td className={tdNum}><Amt v={r.remaining} strong={big(r.remaining) > 0n} muted={!big(r.remaining)} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">
                  برنامه‌ی اقساط کارمزددار {sales ? "فروش" : "خرید"} نیست.
                </td>
              </tr>
            )}
          </Table>

          <p className="text-[11px] leading-5 text-gray-400">
            نمای حسابدار: کارمزد فروش روز قسط‌بندی بد «حساب‌های دریافتنی» / بس «درآمد تحقق‌نیافته‌ی اقساط» (بدهی جاری) و آخر هر ماه بد همان / بس «درآمد فروش اقساطی»؛
            خرید بد «پیش‌پرداخت کارمزد خرید اقساطی» / بس «حساب‌های پرداختنی» و ماهانه بد «کارمزد خرید اقساطی». سهم هر دوره به نسبت مانده‌ی بدهی (استاندارد ۳، پیوست بند ۷).
          </p>
        </>
      )}
    </div>
  );
}
