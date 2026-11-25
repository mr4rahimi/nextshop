"use client";

/**
 * «ارزیابی موجودی پایان دوره» — اقل بها و خالص ارزش فروش (webhesab-parity.md بخش ۳۴.۴).
 * محاسبه ← بازبینی (قیمت مورد انتظار هر کالا، بیرون گذاشتن، افزودن کالای آسیب‌دیده) ← ثبت سند تفاوت.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, PageHeader, SectionTitle, Sheet, Stat } from "../ui";
import { Amt, Table, td, tdNum, th, thNum } from "../reports/kit";
import ProductPicker from "../ProductPicker";

type Reason = "PRICE" | "STALE" | "MANUAL";
const REASON: Record<Reason, { label: string; tone: "red" | "amber" | "blue" }> = {
  PRICE: { label: "قیمت زیر بها", tone: "red" },
  STALE: { label: "راکد", tone: "amber" },
  MANUAL: { label: "قیمت دستی", tone: "blue" },
};

interface Row {
  itemId: string;
  code: string;
  title: string;
  qty: number;
  unitCost: string;
  value: string;
  price: string;
  daysIdle: number | null;
  discountBp: number;
  expected: string;
  nrv: string;
  perUnit: string;
  provision: string;
  reason: Reason;
}
interface Plan {
  rows: Row[];
  truncated: boolean;
  count: number;
  total: string;
  byReason: Record<Reason, string>;
  affectedValue: string;
  kardexValue: string;
  items: number;
  unpriced: { count: number; value: string; top: { itemId: string; code: string; title: string; qty: number; value: string }[] };
  booked: string;
  delta: string;
}
interface RunRow {
  id: string;
  number: number;
  date: string;
  total: string;
  booked: string;
  status: string;
  lines: number;
  voucherId: string | null;
  createdByName: string;
  note: string | null;
}
interface Status {
  mode: string;
  account: { id: string; code: string; name: string } | null;
  book: string;
  active: {
    id: string;
    number: number;
    date: string;
    total: string;
    booked: string;
    lines: number;
    releasedThrough: string | null;
    sellCostPct: number;
    staleDays: number;
    staleDiscountPct: number;
    pendingRelease: string;
    soldUnits: number;
  } | null;
  diff: string;
  runs: RunRow[];
  can: { settings: boolean };
}
interface RunDetail {
  number: number;
  date: string;
  lines: { id: string; itemId: string; code: string; title: string; qty: number; unitCost: string; price: string; expected: string; nrv: string; perUnit: string; provision: string; reason: Reason; daysIdle: number | null }[];
}

const big = (v: string) => BigInt(v);
const pctText = (bp: number) => `${faNum(bp / 100)}٪`;

export default function ValuationClient() {
  const [s, setS] = useState<Status | null>(null);
  const [form, setForm] = useState({ sellCostPct: "5", staleDays: "180", staleDiscountPct: "30" });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [exclude, setExclude] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [showUnpriced, setShowUnpriced] = useState(false);

  const load = useCallback(() => {
    api<Status>("/api/admin/accounting/inventory/valuation")
      .then((d) => {
        setS(d);
        if (d.active) setForm({ sellCostPct: String(d.active.sellCostPct), staleDays: String(d.active.staleDays), staleDiscountPct: String(d.active.staleDiscountPct) });
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const body = useMemo(() => ({ ...form, overrides: Object.fromEntries(Object.entries(overrides).filter(([, v]) => v.trim())), exclude }), [form, overrides, exclude]);

  async function preview(next?: { overrides?: Record<string, string>; exclude?: string[] }) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const b = { ...body, ...(next?.overrides ? { overrides: Object.fromEntries(Object.entries(next.overrides).filter(([, v]) => v.trim())) } : {}), ...(next?.exclude ? { exclude: next.exclude } : {}) };
      const r = await api<{ result: Plan }>("/api/admin/accounting/inventory/valuation", { method: "POST", json: { action: "preview", ...b } });
      setPlan(r.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!plan) return;
    const d = big(plan.delta);
    if (!confirm(d === 0n ? "ارزیابی ثبت شود؟ (ذخیره تغییری نمی‌کند)" : `سند ${d > 0n ? "کاهش ارزش" : "برگشت ذخیره"} ${formatAmount(d < 0n ? -d : d)} تومان ثبت شود؟`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ result: { number: number } }>("/api/admin/accounting/inventory/valuation", { method: "POST", json: { action: "commit", ...body, note } });
      setMsg(`ارزیابی ${faNum(r.result.number)} ثبت شد.`);
      setPlan(null);
      setOverrides({});
      setExclude([]);
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ result: { message: string } }>("/api/admin/accounting/inventory/valuation", { method: "POST", json: { action: "release" } });
      setMsg(r.result.message);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const setOverride = (id: string, v: string) => setOverrides((o) => ({ ...o, [id]: v }));
  const toggleExclude = (id: string) => {
    const next = exclude.includes(id) ? exclude.filter((x) => x !== id) : [...exclude, id];
    setExclude(next);
    void preview({ exclude: next });
  };

  const a = s?.active;
  const settings = !!s?.can.settings;

  return (
    <div className="space-y-4">
      <PageHeader
        title="ارزیابی موجودی پایان دوره"
        help="accountingInventoryValuation"
        back={{ href: "/admin/accounting/inventory", label: "کالا و انبار" }}
        desc="کالایی که امروز ارزان‌تر از قیمت خریدش فروخته می‌شود — یا مدت‌هاست فروش نرفته — دیگر به اندازه‌ی بهایش نمی‌ارزد. اینجا این کاهش را در دفتر ثبت می‌کنید؛ بهای کالا و سود فروش‌ها دست نمی‌خورد."
        actions={
          <Link href="/admin/accounting/reports/inventory" className={btn.soft}>
            ارزش موجودی کالا
          </Link>
        }
      />
      <ErrorText>{error}</ErrorText>
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10">{msg}</p>}

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="ذخیره‌ی کاهش ارزش در دفتر" value={<Amt v={s.book} strong />} sub={s.account ? `حساب ${faNum(Number(s.account.code))}` : "هنوز ثبت نشده"} href={s.account ? `/admin/accounting/accounts/${s.account.id}` : undefined} tone={big(s.book) ? "red" : "gray"} />
          <Stat label="آخرین ارزیابی" value={<span className="text-base">{a ? `${faNum(a.number)} — ${formatJalali(new Date(a.date))}` : "هنوز نه"}</span>} sub={a ? `${faNum(a.lines)} کالا، ${formatAmount(a.total)} تومان` : "سالی یک بار، پیش از بستن سال"} />
          <Stat
            label="سهم کالاهای فروش‌رفته"
            value={<Amt v={a?.pendingRelease ?? "0"} strong />}
            sub={a ? `${faNum(a.soldUnits)} واحد فروش رفت — آخر هر ماه خودکار برمی‌گردد` : "—"}
            tone="green"
          />
          <Stat label="تطبیق با دفتر" value={big(s.diff) === 0n ? <span className="text-base text-emerald-600">یکی است</span> : <Amt v={s.diff} strong />} sub="ذخیره‌ی دفتر با آخرین ارزیابی" tone={big(s.diff) === 0n ? "green" : "amber"} />
        </div>
      )}
      {a && big(a.pendingRelease) !== 0n && settings && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            از ارزیابی {faNum(a.number)} تا امروز {faNum(a.soldUnits)} واحد فروش رفته؛ ذخیره‌ی آن‌ها (<Amt v={a.pendingRelease} />) دیگر لازم نیست.
          </p>
          <button onClick={release} disabled={busy} className={btn.small}>
            برگشت همین حالا
          </button>
        </Card>
      )}

      {s?.mode !== "INTERNAL" && s && <p className="text-xs font-bold text-amber-600">فقط با حسابداری داخلی.</p>}

      <Card className="space-y-3 p-4">
        <SectionTitle title="ارزیابی تازه" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="هزینه‌ی فروش (٪)" hint="کمیسیون، بسته‌بندی، ارسال — از قیمت کم می‌شود">
            <input className={inputCls} inputMode="decimal" value={form.sellCostPct} onChange={(e) => setForm({ ...form, sellCostPct: e.target.value })} />
          </Field>
          <Field label="راکد از چند روز بی‌فروش" hint="از آخرین فروش، یا ورود اگر هیچ‌وقت فروش نرفته">
            <input className={inputCls} inputMode="numeric" value={form.staleDays} onChange={(e) => setForm({ ...form, staleDays: e.target.value })} />
          </Field>
          <Field label="تخفیف لازم برای فروش راکدها (٪)" hint="دو برابر آن روزها ← دو برابر تخفیف (سقف ۹۰٪)">
            <input className={inputCls} inputMode="decimal" value={form.staleDiscountPct} onChange={(e) => setForm({ ...form, staleDiscountPct: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => preview()} disabled={busy} className={btn.primary}>
            {busy ? "…" : plan ? "محاسبه‌ی دوباره" : "محاسبه"}
          </button>
          <span className="text-[11px] text-gray-400">محاسبه چیزی ثبت نمی‌کند.</span>
        </div>
      </Card>

      {plan && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="کاهش ارزش لازم" value={<Amt v={plan.total} strong />} sub={`${faNum(plan.count)} کالا از ${faNum(plan.items)}`} tone="red" />
            <Stat label="قیمت زیر بها" value={<Amt v={plan.byReason.PRICE} />} sub={`راکد ${formatAmount(plan.byReason.STALE)} · دستی ${formatAmount(plan.byReason.MANUAL)}`} />
            <Stat label="ارزش دفتری همین کالاها" value={<Amt v={plan.affectedValue} />} sub={`کل انبار ${formatAmount(plan.kardexValue)}`} />
            <Stat
              label="سند این ارزیابی"
              value={big(plan.delta) === 0n ? <span className="text-base">بی‌تغییر</span> : <Amt v={(big(plan.delta) < 0n ? -big(plan.delta) : big(plan.delta)).toString()} strong />}
              sub={big(plan.delta) > 0n ? "کاهش ارزش بیشتر (هزینه)" : big(plan.delta) < 0n ? "برگشت ذخیره (کاهش هزینه)" : `ذخیره‌ی فعلی ${formatAmount(plan.booked)}`}
              tone={big(plan.delta) > 0n ? "red" : "green"}
            />
          </div>

          {plan.unpriced.count > 0 && (
            <Card className="space-y-2 p-4">
              <button onClick={() => setShowUnpriced((x) => !x)} className="text-right text-sm font-bold text-amber-700">
                ⚠️ {faNum(plan.unpriced.count)} کالای موجود قیمت فروش ندارد (ارزش <Amt v={plan.unpriced.value} />) و ارزیابی نشد {showUnpriced ? "▲" : "▼"}
              </button>
              {showUnpriced && (
                <div className="space-y-1">
                  {plan.unpriced.top.map((u) => (
                    <div key={u.itemId} className="flex items-center justify-between gap-2 text-xs">
                      <Link href={`/admin/accounting/inventory/${u.itemId}`} className="font-bold text-blue-600">
                        {u.title} <span className="text-gray-400">{u.code}</span>
                      </Link>
                      <span className="flex items-center gap-2">
                        {faNum(u.qty)} عدد · <Amt v={u.value} />
                        <input placeholder="قیمت مورد انتظار" className={`${inputCls} !w-36 !py-1`} value={overrides[u.itemId] ?? ""} onChange={(e) => setOverride(u.itemId, e.target.value)} onBlur={() => overrides[u.itemId] && preview()} />
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-400">قیمت فروشگاه را در «قیمت فروشگاه» بگذارید، یا اینجا قیمتی که فکر می‌کنید فروش می‌رود.</p>
                </div>
              )}
            </Card>
          )}

          <Card className="space-y-2 p-4">
            <SectionTitle title="کالای آسیب‌دیده، تاریخ‌گذشته یا از مد افتاده" />
            <p className="text-xs text-gray-500">کالا را پیدا کنید و قیمتی که واقعاً فروش می‌رود را در ستون «قیمت مورد انتظار» بنویسید.</p>
            <ProductPicker
              placeholder="نام، کد یا بارکد کالا"
              onPick={(p) => {
                const v = prompt(`«${p.title}» — قیمت فروش مورد انتظار هر واحد (تومان):`, "0");
                if (v === null) return;
                const next = { ...overrides, [p.id]: v };
                setOverrides(next);
                void preview({ overrides: next });
              }}
            />
          </Card>

          <Table
            head={
              <tr>
                <th className={th}>کالا</th>
                <th className={thNum}>تعداد</th>
                <th className={thNum}>بهای واحد</th>
                <th className={thNum}>قیمت امروز</th>
                <th className={thNum}>بی‌فروش</th>
                <th className={thNum}>قیمت مورد انتظار</th>
                <th className={thNum}>خالص ارزش فروش</th>
                <th className={thNum}>کاهش ارزش</th>
                <th className={th} />
              </tr>
            }
            foot={
              <tr>
                <td className={td}>جمع</td>
                <td colSpan={6} />
                <td className={tdNum}>
                  <Amt v={plan.total} strong />
                </td>
                <td />
              </tr>
            }
          >
            {plan.rows.map((r) => (
              <tr key={r.itemId}>
                <td className={td}>
                  <Link href={`/admin/accounting/inventory/${r.itemId}`} className="font-bold text-blue-600">
                    {r.title}
                  </Link>
                  <span className="mr-1 text-[11px] text-gray-400">{r.code}</span>
                  <span className="mr-2">
                    <Badge tone={REASON[r.reason].tone}>{REASON[r.reason].label}</Badge>
                  </span>
                </td>
                <td className={tdNum}>{faNum(r.qty)}</td>
                <td className={tdNum}>
                  <Amt v={r.unitCost} />
                </td>
                <td className={tdNum}>
                  <Amt v={r.price} muted={!big(r.price)} />
                </td>
                <td className={tdNum}>
                  {r.daysIdle === null ? "—" : `${faNum(r.daysIdle)} روز`}
                  {r.discountBp > 0 && <span className="block text-[10px] text-amber-600">تخفیف {pctText(r.discountBp)}</span>}
                </td>
                <td className={tdNum}>
                  <input
                    className={`${inputCls} !w-32 !py-1 text-left`}
                    inputMode="numeric"
                    placeholder={formatAmount(r.expected)}
                    value={overrides[r.itemId] ?? ""}
                    onChange={(e) => setOverride(r.itemId, e.target.value)}
                    onBlur={() => overrides[r.itemId] !== undefined && preview()}
                    onKeyDown={(e) => e.key === "Enter" && preview()}
                  />
                </td>
                <td className={tdNum}>
                  <Amt v={r.nrv} />
                </td>
                <td className={tdNum}>
                  <Amt v={r.provision} strong />
                  <span className="block text-[10px] text-gray-400">هر واحد {formatAmount(r.perUnit)}</span>
                </td>
                <td className={td}>
                  <button onClick={() => toggleExclude(r.itemId)} className="text-[11px] font-bold text-gray-500 hover:text-rose-600" title="این کالا ارزیابی نشود">
                    بیرون
                  </button>
                </td>
              </tr>
            ))}
            {!plan.rows.length && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-xs text-gray-400">
                  همه‌ی کالاها بیش از بهایشان فروش می‌روند — کاهش ارزشی لازم نیست.
                </td>
              </tr>
            )}
          </Table>
          {plan.truncated && <p className="text-[11px] text-amber-600">فقط {faNum(plan.rows.length)} ردیف اول نشان داده شد.</p>}
          {exclude.length > 0 && (
            <p className="text-xs text-gray-500">
              {faNum(exclude.length)} کالا بیرون گذاشته شد.{" "}
              <button
                className="font-bold text-blue-600"
                onClick={() => {
                  setExclude([]);
                  void preview({ exclude: [] });
                }}
              >
                برگرداندن همه
              </button>
            </p>
          )}

          {settings && s?.mode === "INTERNAL" && (
            <Card className="flex flex-wrap items-end gap-3 p-4">
              <Field label="یادداشت (اختیاری)" className="min-w-60 flex-1">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً ارزیابی پایان سال ۱۴۰۵" />
              </Field>
              <button onClick={commit} disabled={busy} className={btn.primary}>
                {busy ? "…" : "ثبت ارزیابی و سند"}
              </button>
            </Card>
          )}
        </>
      )}

      {s && s.runs.length > 0 && (
        <>
          <SectionTitle title="ارزیابی‌های قبلی" />
          <Table
            head={
              <tr>
                <th className={th}>شماره</th>
                <th className={th}>تاریخ</th>
                <th className={thNum}>کالا</th>
                <th className={thNum}>کاهش ارزش</th>
                <th className={thNum}>الان در دفتر</th>
                <th className={th}>وضعیت</th>
                <th className={th}>سند</th>
              </tr>
            }
          >
            {s.runs.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <button
                    className="font-bold text-blue-600"
                    onClick={() =>
                      api<RunDetail>(`/api/admin/accounting/inventory/valuation/${r.id}`)
                        .then(setDetail)
                        .catch((e) => setError(e.message))
                    }
                  >
                    {faNum(r.number)}
                  </button>
                  {r.note && <span className="mr-2 text-[11px] text-gray-400">{r.note}</span>}
                </td>
                <td className={td}>{formatJalali(new Date(r.date))}</td>
                <td className={tdNum}>{faNum(r.lines)}</td>
                <td className={tdNum}>
                  <Amt v={r.total} />
                </td>
                <td className={tdNum}>{r.status === "ACTIVE" ? <Amt v={r.booked} strong /> : "—"}</td>
                <td className={td}>{r.status === "ACTIVE" ? <Badge tone="green">فعال</Badge> : <Badge>جایگزین شد</Badge>}</td>
                <td className={td}>
                  {r.voucherId ? (
                    <Link href={`/admin/accounting/vouchers/${r.voucherId}`} className="text-xs font-bold text-blue-600">
                      دیدن سند
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">بی‌سند</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}

      <p className="text-[11px] leading-5 text-gray-400">
        نمای حسابدار: اقل بها و خالص ارزش فروش (استاندارد ۸). بد «هزینه‌ی کاهش ارزش موجودی» / بس «ذخیره‌ی کاهش ارزش موجودی» (کاهنده‌ی موجودی کالا)؛ فقط تفاوت با ذخیره‌ی
        فعلی سند می‌خورد. سهم واحدهای فروش‌رفته آخر هر ماه برمی‌گردد. کاردکس و میانگین موزون دست نمی‌خورند.
      </p>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? `ارزیابی ${faNum(detail.number)} — ${formatJalali(new Date(detail.date))}` : ""} wide>
        {detail && (
          <Table
            head={
              <tr>
                <th className={th}>کالا</th>
                <th className={thNum}>تعداد</th>
                <th className={thNum}>بها</th>
                <th className={thNum}>مورد انتظار</th>
                <th className={thNum}>کاهش</th>
              </tr>
            }
          >
            {detail.lines.map((l) => (
              <tr key={l.id}>
                <td className={td}>
                  <Link href={`/admin/accounting/inventory/${l.itemId}`} className="font-bold text-blue-600">
                    {l.title}
                  </Link>{" "}
                  <Badge tone={REASON[l.reason].tone}>{REASON[l.reason].label}</Badge>
                </td>
                <td className={tdNum}>{faNum(l.qty)}</td>
                <td className={tdNum}>
                  <Amt v={l.unitCost} />
                </td>
                <td className={tdNum}>
                  <Amt v={l.expected} />
                </td>
                <td className={tdNum}>
                  <Amt v={l.provision} strong />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Sheet>
    </div>
  );
}
