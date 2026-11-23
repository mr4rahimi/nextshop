"use client";

/**
 * انتقال اقساط وب حساب — پیش‌نمایش (سازمان‌ها، برچسب‌های داخل نام، ایرادها) و ثبت.
 * docs/plans/org-installments.md بخش ۷.
 */

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, RefreshCw } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { Badge, btn, Card, ErrorText, inputCls, PageHeader, Stat } from "../ui";
import { B } from "./shared";

const PERSONAL = "__personal__";
const PERSONAL_ORG = "اقساط شخصی (وب حساب)";

interface Preview {
  fileName: string;
  contracts: number;
  open: number;
  installments: number;
  remaining: string;
  tags: { tag: string | null; known: boolean; org: string; personal: boolean; contracts: number; open: number; remaining: string; customers: number; sample: string }[];
  orgs: { name: string; personal: boolean; exists: boolean; commissionPct: number; contracts: number; open: number; remaining: string; remainingNet: string; customers: number; tags: string[] }[];
  matched: { byCode: number; byMobile: number };
  problems: {
    overpaid: { ref: string; name: string; amount: string }[];
    oldOverdue: { ref: string; name: string; org: string; amount: string; due: string }[];
    locked: number;
    newParties: { code: string; name: string; mobile: string | null }[];
    noCode: number;
    short: { partyId: string; name: string; amount: string; balance: string }[];
    shortCount: number;
    shortSum: string;
  };
  existingOrgs: string[];
}
interface Result {
  created: number;
  updated: number;
  unchanged: number;
  locked: number;
  voided: number;
  missing: number;
  newParties: number;
  activated: number;
  vouchers: { org: string; number: number | null; amount: string }[];
}

export default function LegacyImport() {
  const [file, setFile] = useState<File | null>(null);
  const [p, setP] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [commission, setCommission] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showTags, setShowTags] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const options = () => ({
    mapping,
    commission: Object.fromEntries(
      Object.entries(commission)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => [k, Number(v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))))]),
    ),
  });

  /** فشرده‌سازی در مرورگر — ۱٫۹ مگابایت CSV ← حدود ۳۰۰ کیلوبایت */
  async function packFile(f: File): Promise<Blob> {
    if (typeof CompressionStream === "undefined" || /\.(xlsx|xls|gz)$/i.test(f.name)) return f;
    try {
      return await new Response(f.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    } catch {
      return f;
    }
  }

  async function send(mode: "preview" | "apply", f = file) {
    if (!f) return;
    setBusy(mode);
    setError(null);
    try {
      const body = await packFile(f);
      const post = () => {
        const fd = new FormData();
        fd.set("file", body, body === f ? f.name : `${f.name}.gz`);
        fd.set("mode", mode);
        fd.set("options", JSON.stringify(options()));
        return fetch("/api/admin/accounting/installment-orgs/legacy", { method: "POST", body: fd });
      };
      let r: Response;
      try {
        r = await post();
      } catch (e) {
        // قطع شبکه: پیش‌نمایش را یک بار دیگر می‌فرستیم؛ ثبت را نه (ممکن است روی سرور انجام شده باشد)
        if (mode === "apply")
          throw new Error("ارتباط با سرور وسط ثبت قطع شد. ثبت تکرارپذیر است: «پیش‌نمایش با تغییرها» را بزنید؛ اگر قراردادها «بی‌تغییر» بود ثبت انجام شده، وگرنه دوباره «ثبت انتقال».");
        r = await post().catch(() => {
          throw e;
        });
      }
      const j = await r.json().catch(() => {
        throw new Error(`پاسخ نامعتبر از سرور (${r.status})`);
      });
      if (!r.ok) throw new Error(j.error ?? "انجام نشد");
      if (mode === "apply") {
        setResult(j);
        setP(null);
      } else setP(j);
    } catch (e) {
      setError(e instanceof TypeError ? "ارتباط با سرور برقرار نشد (اینترنت یا سرور). چند لحظه بعد دوباره بزنید." : e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  const orgNames = useMemo(() => [...new Set([...(p?.existingOrgs ?? []), ...(p?.orgs.map((o) => o.name) ?? [])])].filter((n) => n !== PERSONAL_ORG).sort(), [p]);
  const unknown = p?.tags.filter((t) => t.tag && !t.known) ?? [];

  async function apply() {
    if (!p) return;
    const sum = p.orgs.filter((o) => !o.personal).reduce((s, o) => s + B(o.remaining), 0n);
    if (!window.confirm(`${faNum(p.contracts)} قرارداد ثبت/به‌روز و ${formatAmount(sum)} تومان مانده‌ی اقساط باز از حساب مشتری‌ها به حساب ${faNum(p.orgs.filter((o) => !o.personal).length)} سازمان منتقل می‌شود. ادامه؟`)) return;
    await send("apply");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="انتقال اقساط از وب حساب"
        help="accountingOrgInstallments"
        back={{ href: "/admin/accounting/installment-orgs", label: "اقساط سازمانی" }}
        desc="قراردادهای اقساطی وب حساب با جدول قسط‌ها و دریافت‌شده‌ها، به تفکیک سازمان (از نام مشتری) و اقساط شخصی. ورود دوباره فقط به‌روز می‌کند."
      />

      <Card className="p-4">
        <ol className="space-y-1.5 text-sm leading-7 text-gray-600 dark:text-gray-300">
          <li>
            ۱. خروجی «گزارش اقساط مشتریان» وب حساب را با <code className="rounded bg-gray-100 px-1 text-xs dark:bg-white/10">scripts/webhesab/export-installments.py</code> بگیرید (CSV، ریالی).
          </li>
          <li>
            ۲. <b>همان روز</b> مانده‌ی اشخاص را از گزارش ۷۲۴ وب حساب دوباره وارد کنید (معین ۱۰۳۰۰۱ + ۱۰۳۰۰۳)، تا طلب هر مشتری به‌روز باشد؛ این‌جا مانده‌ی اقساط باز از
            مشتری به سازمان منتقل می‌شود.
          </li>
          <li>۳. فایل را بگذارید، سازمان هر برچسب و پورسانت را ببینید، بعد «ثبت انتقال».</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setResult(null);
              if (f) send("preview", f);
              e.target.value = "";
            }}
          />
          <button onClick={() => input.current?.click()} disabled={!!busy} className={btn.primary}>
            <FileUp className="h-4 w-4" aria-hidden /> {file ? "فایل دیگر" : "انتخاب فایل خروجی"}
          </button>
          {file && <span className="text-xs text-gray-500">{file.name}</span>}
          {busy === "preview" && <span className="text-xs text-gray-400">در حال خواندن…</span>}
        </div>
        <ErrorText>{error}</ErrorText>
      </Card>

      {result && (
        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-base font-black text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" aria-hidden /> انتقال انجام شد
          </p>
          <p className="text-sm leading-7">
            {faNum(result.created)} قرارداد تازه، {faNum(result.updated)} به‌روز، {faNum(result.unchanged)} بی تغییر
            {result.locked > 0 && `، ${faNum(result.locked)} قفل (در پنل دریافت خورده یا باطل‌شده — دست نخورد)`}
            {result.voided > 0 && `، ${faNum(result.voided)} باطل (دیگر در وب حساب نیست)`}
            {result.missing > 0 && `؛ ${faNum(result.missing)} قرارداد قبلی در این فایل نبود و چون فایل کامل به نظر نمی‌رسید دست نخورد`}. {faNum(result.newParties)} شخص تازه ساخته شد
            {result.activated > 0 && ` و ${faNum(result.activated)} شخص غیرفعال فعال شد`}.
          </p>
          {result.vouchers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.vouchers.map((v) => (
                <span key={v.org} className="rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-white/5">
                  {v.org}: سند {faNum(v.number ?? 0)} — {formatAmount(B(v.amount))}
                </span>
              ))}
            </div>
          )}
          <Link href="/admin/accounting/installment-orgs" className={btn.soft}>
            دیدن سازمان‌ها
          </Link>
        </Card>
      )}

      {p && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="قرارداد" value={faNum(p.contracts)} sub={`${faNum(p.installments)} قسط`} />
            <Stat label="قرارداد باز" value={faNum(p.open)} tone="blue" />
            <Stat label="مانده‌ی اقساط باز" value={formatAmount(B(p.remaining))} sub="تومان (ریال ÷ ۱۰)" tone="blue" />
            <Stat label="سازمان" value={faNum(p.orgs.filter((o) => !o.personal).length)} sub={`${faNum(p.orgs.filter((o) => !o.exists).length)} تازه ساخته می‌شود`} />
            <Stat
              label="مشتری‌ها"
              value={faNum(p.matched.byCode + p.matched.byMobile)}
              sub={`با کد تفصیل ${faNum(p.matched.byCode)}، موبایل ${faNum(p.matched.byMobile)}؛ تازه ${faNum(p.problems.newParties.length)}`}
              tone={p.problems.newParties.length ? "amber" : "green"}
            />
          </div>

          <Card className="overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
              <p className="text-sm font-black">سازمان‌ها</p>
              <p className="text-[11px] text-gray-500">پورسانت فقط از مانده‌ی باز کم می‌شود (سهم سازمان)؛ اختلاف به هزینه‌ی «کارمزد فروش اقساطی سازمانی».</p>
            </div>
            <table className="mt-2 w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-right">سازمان</th>
                  <th className="px-3 py-2 text-left">قرارداد باز / همه</th>
                  <th className="px-3 py-2 text-left">مشتری باز</th>
                  <th className="px-3 py-2 text-left">مانده (طلب مشتری)</th>
                  <th className="px-3 py-2 text-left">سهم سازمان</th>
                  <th className="px-3 py-2 text-right">پورسانت ٪</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {p.orgs.map((o) => (
                  <tr key={o.name} className={o.open ? "" : "text-gray-400"}>
                    <td className="px-3 py-2">
                      <p className="font-black">{o.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {o.personal ? "خود مشتری می‌پردازد؛ طلب روی مشتری می‌ماند" : o.exists ? "سازمان موجود" : "تازه ساخته می‌شود"}
                        {!o.personal && o.tags.length > 1 && ` · ${faNum(o.tags.length)} برچسب`}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-left tabular-nums">
                      {faNum(o.open)} / {faNum(o.contracts)}
                    </td>
                    <td className="px-3 py-2 text-left tabular-nums">{faNum(o.customers)}</td>
                    <td className="px-3 py-2 text-left font-black tabular-nums">{formatAmount(B(o.remaining))}</td>
                    <td className="px-3 py-2 text-left tabular-nums">{o.personal ? "—" : formatAmount(B(o.remainingNet))}</td>
                    <td className="w-28 px-3 py-2">
                      {!o.personal && (
                        <input
                          value={commission[o.name] ?? String(o.commissionPct || "")}
                          onChange={(e) => setCommission((c) => ({ ...c, [o.name]: e.target.value }))}
                          placeholder="۰"
                          inputMode="decimal"
                          className={`${inputCls} !py-1.5 text-center`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black">برچسب‌های داخل نام مشتری ← سازمان</p>
                <p className="text-[11px] text-gray-500">
                  وب حساب ستون سازمان ندارد؛ «علیخانی (منابع طبیعی)» ← «منابع طبیعی». {faNum(p.tags.length)} برچسب
                  {unknown.length > 0 && <span className="font-bold text-amber-600"> — {faNum(unknown.length)} ناشناخته (پیش‌فرض: شخصی)</span>}
                </p>
              </div>
              <button onClick={() => setShowTags((v) => !v)} className={btn.small}>
                {showTags ? "بستن" : "دیدن و تغییر"}
              </button>
            </div>
            {(showTags || unknown.length > 0) && (
              <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border border-gray-100 dark:border-white/5">
                <datalist id="legacy-orgs">
                  {orgNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-[11px] text-gray-500 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-right">برچسب</th>
                      <th className="px-3 py-2 text-left">قرارداد</th>
                      <th className="px-3 py-2 text-left">مانده</th>
                      <th className="px-3 py-2 text-right">سازمان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {(showTags ? p.tags : unknown).map((t) => {
                      const key = t.tag ?? "";
                      const v = mapping[key] ?? (t.personal ? PERSONAL : t.org);
                      return (
                        <tr key={key} className={t.tag && !t.known ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}>
                          <td className="px-3 py-1.5">
                            <p className="font-bold">{t.tag ?? "بی برچسب (اقساط شخصی)"}</p>
                            <p className="text-[10px] text-gray-400">مثلاً {t.sample}</p>
                          </td>
                          <td className="px-3 py-1.5 text-left tabular-nums">
                            {faNum(t.open)} / {faNum(t.contracts)}
                          </td>
                          <td className="px-3 py-1.5 text-left tabular-nums">{formatAmount(B(t.remaining))}</td>
                          <td className="w-64 px-3 py-1.5">
                            <div className="flex gap-1">
                              <input
                                list="legacy-orgs"
                                value={v === PERSONAL ? "" : v}
                                placeholder="شخصی"
                                onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value.trim() ? e.target.value : PERSONAL }))}
                                className={`${inputCls} !py-1.5`}
                              />
                              {v !== PERSONAL && (
                                <button onClick={() => setMapping((m) => ({ ...m, [key]: PERSONAL }))} className={btn.small} title="اقساط شخصی">
                                  شخصی
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Problems p={p} />

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-gray-900/95">
            <button onClick={() => send("preview")} disabled={!!busy} className={btn.soft}>
              <RefreshCw className={`h-4 w-4 ${busy === "preview" ? "animate-spin" : ""}`} aria-hidden /> پیش‌نمایش با تغییرها
            </button>
            <button onClick={apply} disabled={!!busy} className={`${btn.primary} mr-auto`}>
              {busy === "apply" ? "در حال ثبت… (یک تا دو دقیقه)" : "ثبت انتقال"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Problems({ p }: { p: Preview }) {
  const x = p.problems;
  const any = x.overpaid.length || x.oldOverdue.length || x.shortCount || x.newParties.length || x.locked || x.noCode;
  if (!any) return null;
  return (
    <Card className="space-y-4 p-4">
      <p className="flex items-center gap-1.5 text-sm font-black text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" aria-hidden /> موارد قابل بررسی در داده‌ی وب حساب
      </p>
      {x.shortCount > 0 && (
        <Block title={`${faNum(x.shortCount)} مشتری مانده‌ی پنلش از اقساط بازش کمتر است (جمع ${formatAmount(B(x.shortSum))} تومان)`} tone="red">
          <p className="mb-2 text-xs leading-6 text-gray-600 dark:text-gray-300">
            بعد از انتقال این‌ها بستانکار می‌شوند. معمولاً یعنی مانده‌ی اشخاص به‌روز نیست (خرید اقساطی بعد از آخرین ورود مانده) — اول مانده‌ی اشخاص را دوباره وارد کنید.
          </p>
          <Rows rows={x.short.slice(0, 40).map((s) => [s.name, `مانده‌ی پنل ${formatAmount(B(s.balance))}`, `اقساط باز ${formatAmount(B(s.amount))}`])} />
        </Block>
      )}
      {x.newParties.length > 0 && (
        <Block title={`${faNum(x.newParties.length)} مشتری در پنل پیدا نشد (نه با کد تفصیل، نه موبایل) — ساخته می‌شوند`} tone="amber">
          <Rows rows={x.newParties.slice(0, 40).map((n) => [n.name, n.code ? `کد ${faNum(n.code)}` : "بی کد", n.mobile ? faNum(n.mobile) : "بی موبایل"])} />
        </Block>
      )}
      {x.overpaid.length > 0 && (
        <Block title={`${faNum(x.overpaid.length)} قرارداد بیش از مبلغش دریافت شده (قسط دوبار پرداخت‌شده در وب حساب)`} tone="amber">
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">قرارداد تسویه منتقل می‌شود؛ اضافه روی حساب مشتری می‌ماند. در وب حساب بررسی کنید.</p>
          <Rows rows={x.overpaid.map((o) => [o.name, `قرارداد ${faNum(Number(o.ref))}`, `اضافه ${formatAmount(B(o.amount))}`])} />
        </Block>
      )}
      {x.oldOverdue.length > 0 && (
        <Block title={`${faNum(x.oldOverdue.length)} قرارداد بیش از ۶ ماه معوق`} tone="amber">
          <Rows rows={x.oldOverdue.map((o) => [o.name, `${o.org} · قرارداد ${faNum(Number(o.ref))}`, `از ${formatJalali(new Date(o.due))} — ${formatAmount(B(o.amount))}`])} />
        </Block>
      )}
      {x.locked > 0 && <p className="text-xs text-gray-600 dark:text-gray-300">{faNum(x.locked)} قرارداد در پنل دریافت خورده یا باطل شده؛ ورود دوباره دستشان نمی‌زند.</p>}
      {x.noCode > 0 && <p className="text-xs text-gray-600 dark:text-gray-300">{faNum(x.noCode)} قسط کد تفصیل ندارد؛ با موبایل تطبیق می‌شوند.</p>}
    </Card>
  );
}

function Block({ title, tone, children }: { title: string; tone: "red" | "amber"; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-gray-100 p-3 dark:border-white/5">
      <summary className="cursor-pointer text-sm font-bold">
        <Badge tone={tone}>{tone === "red" ? "مهم" : "بررسی"}</Badge> {title}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function Rows({ rows }: { rows: string[][] }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`px-2 py-1.5 ${j === 0 ? "font-bold" : "text-gray-500"} ${j === r.length - 1 ? "text-left tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
