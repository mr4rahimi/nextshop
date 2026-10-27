"use client";

/**
 * صندوق‌های فروشگاه — docs/plans/inventory-items.md بخش ۱۳.
 * زبانه‌ها: صندوق‌ها (ورود به هر پیشخوان؛ مدیر: تعریف)، فروشنده‌ها، شیفت‌ها، گزارش فروش.
 * «فروش سریع ساده» (فروش بی‌صندوق و بی‌شیفت، قبل از ۲.۹۵.۰) هنوز از همین‌جا باز می‌شود.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Lock, Monitor, Pencil, Plus, Printer, ScanSearch, Unlock, UserRound, Zap } from "lucide-react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { formatJalali } from "@/lib/club/jalali";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Sheet, Stat } from "../ui";
import { useAccess } from "../access";
import { B, abs, faNum, formatAmount, timeFa } from "./shared";

interface Terminal {
  id: string;
  code: number;
  name: string;
  warehouseId: string;
  cashTreasuryId: string;
  cardTreasuryId: string | null;
  roundTo: number;
  receiptHeader: string | null;
  receiptFooter: string | null;
  paperMm: number;
  isActive: boolean;
  openShift: { id: string; number: number; openedAt: string; openedByName: string } | null;
  cashBook: string | null;
}
interface Seller {
  id: string;
  code: number;
  name: string;
  commissionBp: number;
  isActive: boolean;
}
interface HubData {
  terminals: Terminal[];
  warehouses: { id: string; name: string }[];
  treasuries: { id: string; name: string; kind: string }[];
  sellers: Seller[];
  can: { manage: boolean };
}
type Tab = "terminals" | "sellers" | "shifts" | "report";

export default function PosHub() {
  const sp = useSearchParams();
  const router = useRouter();
  const { can } = useAccess();
  const [d, setD] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tab = (sp.get("tab") as Tab) || "terminals";
  const setTab = (t: Tab) => router.replace(`/admin/accounting/pos${t === "terminals" ? "" : `?tab=${t}`}`);

  const load = useCallback(() => api<HubData>("/api/admin/accounting/pos/terminals").then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const manage = !!d?.can.manage;
  const canReport = manage || can("ACC_REPORTS");
  return (
    <div className="space-y-4">
      <PageHeader
        title="صندوق فروشگاه"
        help="accountingPosHub"
        desc="هر پیشخوان یک صندوق با انبار، صندوق نقد و کارتخوان خودش. صندوق را باز کنید، بفروشید و آخر روز ببندید."
        actions={
          <>
            <Link href="/admin/accounting/price-check" className={btn.soft}>
              <ScanSearch className="h-4 w-4" aria-hidden /> چک کردن قیمت
            </Link>
            {can("ACC_SALES") && (
              <Link href="/admin/accounting/pos/quick" className={btn.soft}>
                <Zap className="h-4 w-4" aria-hidden /> فروش سریع ساده
              </Link>
            )}
          </>
        }
      />
      {error && <ErrorText>{error}</ErrorText>}
      {d && (manage || canReport) && (
        <Chips
          value={tab}
          onChange={setTab}
          options={[
            { value: "terminals", label: "صندوق‌ها" },
            ...(manage ? [{ value: "sellers" as Tab, label: "فروشنده‌ها" }] : []),
            { value: "shifts", label: "شیفت‌ها" },
            ...(canReport ? [{ value: "report" as Tab, label: "گزارش فروش" }] : []),
          ]}
        />
      )}
      {!d ? (
        !error && <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : tab === "sellers" && manage ? (
        <SellersPanel sellers={d.sellers} onChange={load} />
      ) : tab === "shifts" ? (
        <ShiftsPanel terminals={d.terminals} />
      ) : tab === "report" && canReport ? (
        <ReportPanel terminals={d.terminals} sellers={d.sellers} />
      ) : (
        <TerminalsPanel d={d} onChange={load} />
      )}
    </div>
  );
}

function TerminalsPanel({ d, onChange }: { d: HubData; onChange: () => void }) {
  const [edit, setEdit] = useState<Terminal | "new" | null>(null);
  const manage = d.can.manage;
  return (
    <>
      {!d.terminals.length ? (
        <Card>
          <Empty
            title="هنوز صندوقی تعریف نشده"
            desc={manage ? "برای هر پیشخوان فروشگاه یک صندوق بسازید: انبارش، صندوق نقدش و کارتخوانش." : "مدیر صندوق باید اول صندوق‌ها را تعریف کند."}
            action={
              manage ? (
                <button onClick={() => setEdit("new")} className={btn.primary}>
                  <Plus className="h-4 w-4" aria-hidden /> صندوق تازه
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.terminals.map((t) => (
            <Card key={t.id} className={`p-4 ${t.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${t.openShift ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-600/25" : "bg-gradient-to-br from-slate-400 to-slate-600 shadow-slate-600/20"}`}>
                  <Monitor className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black">{t.name}</p>
                  <p className="text-[11px] font-bold text-gray-400">
                    {d.warehouses.find((w) => w.id === t.warehouseId)?.name ?? "—"} · {d.treasuries.find((x) => x.id === t.cashTreasuryId)?.name ?? "—"}
                  </p>
                  <div className="mt-1.5">
                    {t.openShift ? (
                      <Badge tone="green">
                        باز — شیفت {faNum(t.openShift.number)} از {timeFa(t.openShift.openedAt)} ({t.openShift.openedByName})
                      </Badge>
                    ) : (
                      <Badge>{t.isActive ? "بسته" : "غیرفعال"}</Badge>
                    )}
                  </div>
                </div>
                {manage && (
                  <button onClick={() => setEdit(t)} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white" aria-label="ویرایش">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {t.isActive && (
                <Link
                  href={`/admin/accounting/pos/register/${t.id}`}
                  className={`mt-4 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition active:scale-[0.99] ${t.openShift ? "bg-emerald-600" : "bg-gray-900 dark:bg-white dark:text-gray-900"}`}
                >
                  {t.openShift ? <Unlock className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                  {t.openShift ? "ورود به صندوق" : "باز کردن صندوق"}
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </Card>
          ))}
          {manage && (
            <button onClick={() => setEdit("new")} className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-bold text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:border-white/10">
              <Plus className="h-6 w-6" aria-hidden /> صندوق تازه
            </button>
          )}
        </div>
      )}
      {edit && <TerminalForm d={d} t={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChange(); }} />}
    </>
  );
}

function TerminalForm({ d, t, onClose, onSaved }: { d: HubData; t: Terminal | null; onClose: () => void; onSaved: () => void }) {
  const used = new Set(d.terminals.filter((x) => x.id !== t?.id).map((x) => x.cashTreasuryId));
  const cashes = d.treasuries.filter((x) => x.kind === "CASH" && !used.has(x.id));
  const cards = d.treasuries.filter((x) => x.kind === "POS" || x.kind === "BANK");
  const [f, setF] = useState({
    name: t?.name ?? "",
    warehouseId: t?.warehouseId ?? d.warehouses[0]?.id ?? "",
    cashTreasuryId: t?.cashTreasuryId ?? "new",
    cardTreasuryId: t?.cardTreasuryId ?? cards.find((c) => c.kind === "POS")?.id ?? "",
    roundTo: String(t?.roundTo ?? 0),
    paperMm: String(t?.paperMm ?? 80),
    receiptHeader: t?.receiptHeader ?? "",
    receiptFooter: t?.receiptFooter ?? "",
    isActive: t?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(t ? `/api/admin/accounting/pos/terminals/${t.id}` : "/api/admin/accounting/pos/terminals", {
        method: t ? "PATCH" : "POST",
        json: { ...f, cardTreasuryId: f.cardTreasuryId || null, roundTo: Number(f.roundTo) || 0, paperMm: Number(f.paperMm) },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={t ? `ویرایش ${t.name}` : "صندوق تازه"}
      help="accountingPosHub"
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "…" : "ذخیره"}
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="نام صندوق">
          <input value={f.name} onChange={set("name")} className={inputCls} placeholder="مثلاً صندوق ۱ — ورودی" />
        </Field>
        <Field label="انبار" hint="فروش این صندوق از این انبار کم می‌شود و موجودی همین انبار کنار هر کالا دیده می‌شود.">
          <select value={f.warehouseId} onChange={set("warehouseId")} className={inputCls}>
            {d.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="صندوق نقد" hint="هر پیشخوان صندوق نقد جدا دارد تا «بستن صندوق» پول همان کشو را بشمارد.">
          <select value={f.cashTreasuryId} onChange={set("cashTreasuryId")} className={inputCls}>
            <option value="new">+ صندوق نقد تازه به نام همین پیشخوان</option>
            {cashes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="کارتخوان">
          <select value={f.cardTreasuryId} onChange={set("cardTreasuryId")} className={inputCls}>
            <option value="">ندارد</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.kind === "BANK" ? " (حساب بانکی)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="گرد کردن جمع به پایین" hint="مثلاً ۱۰۰۰: ۳۲۵٬۵۰۰ ← ۳۲۵٬۰۰۰">
            <select value={f.roundTo} onChange={set("roundTo")} className={inputCls}>
              {[0, 100, 500, 1000, 5000, 10000].map((r) => (
                <option key={r} value={r}>
                  {r ? `${formatAmount(r)} تومان` : "گرد نشود"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="کاغذ رسید">
            <select value={f.paperMm} onChange={set("paperMm")} className={inputCls}>
              <option value="80">۸۰ میلی‌متر</option>
              <option value="58">۵۸ میلی‌متر</option>
            </select>
          </Field>
        </div>
        <Field label="متن بالای رسید (اختیاری)">
          <textarea value={f.receiptHeader} onChange={set("receiptHeader")} rows={2} className={inputCls} placeholder="نشانی شعبه، اینستاگرام…" />
        </Field>
        <Field label="متن پایین رسید (اختیاری)">
          <textarea value={f.receiptFooter} onChange={set("receiptFooter")} rows={2} className={inputCls} placeholder="مثلاً: تعویض تا ۷ روز با رسید و برچسب" />
        </Field>
        {t && (
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF((x) => ({ ...x, isActive: e.target.checked }))} className="h-4 w-4" /> فعال
          </label>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function SellersPanel({ sellers, onChange }: { sellers: Seller[]; onChange: () => void }) {
  const [edit, setEdit] = useState<Seller | "new" | null>(null);
  return (
    <>
      <Card>
        {!sellers.length ? (
          <Empty
            title="فروشنده‌ای تعریف نشده"
            desc="اگر فروشنده‌ها را تعریف کنید، صندوق پیش از هر فروش فروشنده را می‌پرسد و گزارش فروش هر نفر را دارید. حساب پنل لازم ندارند."
            action={
              <button onClick={() => setEdit("new")} className={btn.primary}>
                <Plus className="h-4 w-4" aria-hidden /> فروشنده‌ی تازه
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-[var(--adm-border)]">
            {sellers.map((s) => (
              <button key={s.id} onClick={() => setEdit(s)} className={`flex w-full items-center gap-3 px-4 py-3 text-right ${s.isActive ? "" : "opacity-50"}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-sm font-black text-violet-600">{faNum(s.code)}</span>
                <span className="flex-1 text-sm font-black">{s.name}</span>
                {s.commissionBp > 0 && <Badge tone="blue">پورسانت {faNum(s.commissionBp / 100)}٪</Badge>}
                {!s.isActive && <Badge>غیرفعال</Badge>}
                <Pencil className="h-4 w-4 text-gray-400" aria-hidden />
              </button>
            ))}
            <button onClick={() => setEdit("new")} className="flex w-full items-center justify-center gap-1 px-4 py-3 text-sm font-bold text-blue-600">
              <Plus className="h-4 w-4" aria-hidden /> فروشنده‌ی تازه
            </button>
          </div>
        )}
      </Card>
      {edit && <SellerForm s={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChange(); }} />}
    </>
  );
}

function SellerForm({ s, onClose, onSaved }: { s: Seller | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(s?.name ?? "");
  const [code, setCode] = useState(s ? String(s.code) : "");
  const [pct, setPct] = useState(s ? String(s.commissionBp / 100) : "");
  const [active, setActive] = useState(s?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    try {
      await api(s ? `/api/admin/accounting/pos/sellers/${s.id}` : "/api/admin/accounting/pos/sellers", {
        method: s ? "PATCH" : "POST",
        json: { name, code: code || null, commissionPct: Number(pct) || 0, isActive: active },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    }
  }
  return (
    <Sheet open onClose={onClose} title={s ? s.name : "فروشنده‌ی تازه"} footer={<button onClick={save} className={`${btn.primary} w-full`}>ذخیره</button>}>
      <div className="space-y-3">
        <Field label="نام">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="کد کوتاه (۱ تا ۹۹)" hint="پشت صندوق: کد + Enter">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={inputCls} placeholder="خودکار" inputMode="numeric" />
          </Field>
          <Field label="درصد پورسانت" hint="فقط در گزارش؛ سند نمی‌خورد">
            <input value={pct} onChange={(e) => setPct(e.target.value)} className={inputCls} placeholder="۰" inputMode="decimal" />
          </Field>
        </div>
        {s && (
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" /> فعال
          </label>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function ShiftsPanel({ terminals }: { terminals: Terminal[] }) {
  const [tid, setTid] = useState("");
  const [rows, setRows] = useState<
    { id: string; number: number; status: string; openedAt: string; closedAt: string | null; openedByName: string; closedByName: string | null; cashDiff: string | null; net: string; terminal: { name: string }; _count: { tickets: number } }[] | null
  >(null);
  useEffect(() => {
    api<{ shifts: NonNullable<typeof rows> }>(`/api/admin/accounting/pos/shifts${tid ? `?terminalId=${tid}` : ""}`).then((r) => setRows(r.shifts)).catch(() => setRows([]));
  }, [tid]);
  return (
    <div className="space-y-3">
      {terminals.length > 1 && (
        <Chips value={tid} onChange={setTid} options={[{ value: "", label: "همه‌ی صندوق‌ها" }, ...terminals.map((t) => ({ value: t.id, label: t.name }))]} />
      )}
      <Card className="overflow-hidden">
        {!rows ? (
          <p className="p-4 text-xs text-gray-400">…</p>
        ) : !rows.length ? (
          <Empty title="هنوز شیفتی نیست" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-right">صندوق / شیفت</th>
                  <th className="px-3 py-2 text-right">باز</th>
                  <th className="px-3 py-2 text-right">بسته</th>
                  <th className="px-3 py-2 text-left">رسید</th>
                  <th className="px-3 py-2 text-left">فروش خالص</th>
                  <th className="px-3 py-2 text-left">مغایرت</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {rows.map((r) => {
                  const diff = B(r.cashDiff);
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-2.5 font-black">
                        <Link href={`/admin/accounting/pos/shifts/${r.id}`} className="hover:text-blue-600">
                          {r.terminal.name} · {faNum(r.number)}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        {formatJalali(new Date(r.openedAt))} {timeFa(r.openedAt)} · {r.openedByName}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{r.closedAt ? `${timeFa(r.closedAt)} · ${r.closedByName}` : <Badge tone="green">باز</Badge>}</td>
                      <td className="px-3 py-2.5 text-left tabular-nums">{faNum(r._count.tickets)}</td>
                      <td className="px-3 py-2.5 text-left font-black tabular-nums">{formatAmount(r.net)}</td>
                      <td className={`px-3 py-2.5 text-left font-bold tabular-nums ${diff < 0n ? "text-red-600" : diff > 0n ? "text-amber-600" : "text-gray-400"}`}>
                        {r.status === "CLOSED" ? (diff === 0n ? "—" : `${diff < 0n ? "کسری" : "اضافه"} ${formatAmount(abs(diff))}`) : ""}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.status === "CLOSED" && (
                          <a href={`/admin/accounting/pos/shifts/${r.id}/print`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-900 dark:hover:text-white" aria-label="چاپ">
                            <Printer className="h-4 w-4" aria-hidden />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

interface Agg {
  tickets: number;
  saleTotal: string;
  returnTotal: string;
  net: string;
  saleQty: number;
  returnQty: number;
  discount: string;
  cash: string;
  card: string;
  credit: string;
}
interface Report {
  total: Agg & { avgBasket: string };
  terminals: (Agg & { id: string; name: string })[];
  sellers: (Agg & { id: string | null; name: string; commissionBp: number; commission: string })[];
  days: (Agg & { day: string })[];
  hours: (Agg & { hour: number })[];
}

const DAY = 86_400_000;
const todayStr = () => new Date(Math.floor((Date.now() + 3.5 * 3_600_000) / DAY) * DAY).toISOString().slice(0, 10);
const shiftDay = (s: string, n: number) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);

function ReportPanel({ terminals, sellers }: { terminals: Terminal[]; sellers: Seller[] }) {
  const [preset, setPreset] = useState<"today" | "yesterday" | "7d" | "30d" | "custom">("today");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [tid, setTid] = useState("");
  const [sid, setSid] = useState("");
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => {
    const t = todayStr();
    if (preset === "today") return [t, t];
    if (preset === "yesterday") return [shiftDay(t, -1), shiftDay(t, -1)];
    if (preset === "7d") return [shiftDay(t, -6), t];
    if (preset === "30d") return [shiftDay(t, -29), t];
    return [from, to];
  }, [preset, from, to]);
  useEffect(() => {
    const p = new URLSearchParams({ from: range[0], to: range[1] });
    if (tid) p.set("terminalId", tid);
    if (sid) p.set("sellerId", sid);
    setR(null);
    api<Report>(`/api/admin/accounting/pos/reports?${p}`).then(setR).catch((e) => setError(e.message));
  }, [range, tid, sid]);
  const maxHour = r ? r.hours.reduce((m, h) => (B(h.net) > m ? B(h.net) : m), 1n) : 1n;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chips
          value={preset}
          onChange={setPreset}
          options={[
            { value: "today", label: "امروز" },
            { value: "yesterday", label: "دیروز" },
            { value: "7d", label: "۷ روز" },
            { value: "30d", label: "۳۰ روز" },
            { value: "custom", label: "بازه" },
          ]}
        />
        {terminals.length > 1 && (
          <select value={tid} onChange={(e) => setTid(e.target.value)} className={`${inputCls} !w-auto !py-1.5 text-xs`}>
            <option value="">همه‌ی صندوق‌ها</option>
            {terminals.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {sellers.length > 0 && (
          <select value={sid} onChange={(e) => setSid(e.target.value)} className={`${inputCls} !w-auto !py-1.5 text-xs`}>
            <option value="">همه‌ی فروشنده‌ها</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {preset === "custom" && (
        <div className="grid max-w-md grid-cols-2 gap-2">
          <JalaliDatePicker value={from} onChange={(v: string) => setFrom(v)} placeholder="از تاریخ" />
          <JalaliDatePicker value={to} onChange={(v: string) => setTo(v)} placeholder="تا تاریخ" />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      {!r ? (
        <p className="text-xs text-gray-400">…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="فروش خالص" value={formatAmount(r.total.net)} sub={`فروش ${formatAmount(r.total.saleTotal)} − مرجوعی ${formatAmount(r.total.returnTotal)}`} tone="blue" />
            <Stat label="رسیدها" value={faNum(r.total.tickets)} sub={`${faNum(r.total.saleQty)} کالا فروخته، ${faNum(r.total.returnQty)} برگشت`} />
            <Stat label="میانگین هر خرید" value={formatAmount(r.total.avgBasket)} />
            <Stat label="نقد / کارت" value={formatAmount(r.total.cash)} sub={`کارت ${formatAmount(r.total.card)}${B(r.total.credit) ? ` · نسیه ${formatAmount(r.total.credit)}` : ""}`} tone="green" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AggTable title="فروشنده‌ها" rows={r.sellers.map((s) => ({ key: s.id ?? "-", name: s.name, a: s, extra: s.commissionBp ? `${formatAmount(s.commission)} (${faNum(s.commissionBp / 100)}٪)` : "—" }))} extraLabel="پورسانت (برآورد)" icon />
            <AggTable title="صندوق‌ها" rows={r.terminals.map((t) => ({ key: t.id, name: t.name, a: t }))} />
          </div>
          {r.hours.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-sm font-black">فروش ساعتی</p>
              <div className="space-y-1.5">
                {r.hours.map((h) => (
                  <div key={h.hour} className="flex items-center gap-2 text-xs">
                    <span className="w-12 tabular-nums text-gray-500">{faNum(h.hour)}:۰۰</span>
                    <div className="h-5 flex-1 overflow-hidden rounded-md bg-gray-100 dark:bg-white/5">
                      <div className="h-full rounded-md bg-blue-500" style={{ width: `${Math.max(2, Number((B(h.net) * 100n) / maxHour))}%` }} />
                    </div>
                    <span className="w-28 text-left font-bold tabular-nums">{formatAmount(h.net)}</span>
                    <span className="w-14 text-left text-gray-400">{faNum(h.tickets)} رسید</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {r.days.length > 1 && <AggTable title="روزها" rows={r.days.map((x) => ({ key: x.day, name: formatJalali(new Date(`${x.day}T00:00:00Z`)), a: x }))} />}
        </>
      )}
    </div>
  );
}

function AggTable({ title, rows, extraLabel, icon }: { title: string; rows: { key: string; name: string; a: Agg; extra?: string }[]; extraLabel?: string; icon?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <p className="px-4 pt-3 text-sm font-black">{title}</p>
      {!rows.length ? (
        <Empty title="در این بازه فروشی نیست" />
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
              <tr>
                <th className="px-3 py-2 text-right" />
                <th className="px-3 py-2 text-left">رسید</th>
                <th className="px-3 py-2 text-left">کالا</th>
                <th className="px-3 py-2 text-left">مرجوعی</th>
                <th className="px-3 py-2 text-left">خالص</th>
                {extraLabel && <th className="px-3 py-2 text-left">{extraLabel}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--adm-border)]">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-3 py-2 font-black">
                    {icon && <UserRound className="ml-1 inline h-3.5 w-3.5 text-violet-500" aria-hidden />}
                    {r.name}
                  </td>
                  <td className="px-3 py-2 text-left tabular-nums">{faNum(r.a.tickets)}</td>
                  <td className="px-3 py-2 text-left tabular-nums">{faNum(r.a.saleQty - r.a.returnQty)}</td>
                  <td className="px-3 py-2 text-left tabular-nums text-rose-600">{B(r.a.returnTotal) ? formatAmount(r.a.returnTotal) : "—"}</td>
                  <td className="px-3 py-2 text-left font-black tabular-nums">{formatAmount(r.a.net)}</td>
                  {extraLabel && <td className="px-3 py-2 text-left tabular-nums">{r.extra}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
