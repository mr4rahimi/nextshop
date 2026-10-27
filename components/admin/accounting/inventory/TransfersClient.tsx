"use client";

/**
 * حواله‌های انتقال بین انبارها — فهرست، ثبت، ابطال و تأیید دریافت حواله‌ی دو مرحله‌ای.
 * نمای «در راه» سند به سند یا کالا به کالا (webhesab-parity.md بخش ۸).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import ProductPicker, { type ProductOption } from "../ProductPicker";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, Money, PageHeader, Segmented, Sheet } from "../ui";
import { Plus } from "lucide-react";

interface W {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  receiveConfirm: boolean;
}
interface T {
  id: string;
  number: number;
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  note: string | null;
  status: "POSTED" | "VOID";
  voidReason: string | null;
  createdByName: string;
  needsReceipt: boolean;
  receivedAt: string | null;
  receiveDate: string | null;
  receivedByName: string | null;
  receiveNote: string | null;
  shortageMode: "LOSS" | "RETURN" | null;
  shortageAdjustId: string | null;
  lines: { id: string; productId: string; qty: number; receivedQty: number | null }[];
}
interface Data {
  items: T[];
  titles: Record<string, string>;
  avgCost: Record<string, string> | null;
  inTransit: number;
  reasons: { id: string; name: string }[];
  can: { manage: boolean; receive: boolean; costs: boolean };
}

const kardex = (productId: string) => `/admin/accounting/inventory/${productId}`;
const inTransit = (t: T) => t.status === "POSTED" && t.needsReceipt && !t.receivedAt;

export default function TransfersClient() {
  const sp = useSearchParams();
  const [view, setView] = useState<"all" | "transit">(sp.get("view") === "transit" ? "transit" : "all");
  const [mode, setMode] = useState<"doc" | "item">("doc");
  const [src, setSrc] = useState(sp.get("src") ?? "");
  const [dst, setDst] = useState(sp.get("dst") ?? "");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [one, setOne] = useState(sp.get("id") ?? "");
  const [data, setData] = useState<Data | null>(null);
  const [whs, setWhs] = useState<W[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [receiving, setReceiving] = useState<T | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (view === "transit") p.set("view", "transit");
    if (src) p.set("src", src);
    if (dst) p.set("dst", dst);
    if (q.trim()) p.set("q", q.trim().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
    if (one) p.set("id", one);
    Promise.all([api<Data>(`/api/admin/accounting/inventory/transfers?${p}`), api<{ items: W[] }>("/api/admin/accounting/inventory/warehouses")])
      .then(([t, w]) => {
        setData(t);
        setWhs(w.items);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [view, src, dst, q, one]);
  useEffect(load, [load]);

  async function voidIt(t: T) {
    const back = inTransit(t) ? "کالا به انبار مبدأ برمی‌گردد." : "کالا از مقصد به مبدأ برمی‌گردد" + (t.shortageAdjustId ? " و سند کسری‌اش هم باطل می‌شود." : ".");
    const reason = window.prompt(`دلیل ابطال حواله‌ی ${faNum(t.number)}؟ ${back}`);
    if (!reason) return;
    try {
      await api(`/api/admin/accounting/inventory/transfers/${t.id}`, { method: "POST", json: { action: "void", reason } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    }
  }

  const name = (id: string) => whs.find((w) => w.id === id)?.name ?? "—";
  const activeW = whs.filter((w) => w.isActive);
  const valueOf = (productId: string, qty: number) => (data?.avgCost ? BigInt(data.avgCost[productId] ?? "0") * BigInt(qty) : 0n);

  // کالا به کالا — فقط حواله‌های در راه
  const byItem = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { productId: string; qty: number; transfers: { id: string; number: number; qty: number; to: string }[] }>();
    for (const t of data.items.filter(inTransit)) {
      for (const l of t.lines) {
        const r = m.get(l.productId) ?? { productId: l.productId, qty: 0, transfers: [] };
        r.qty += l.qty;
        r.transfers.push({ id: t.id, number: t.number, qty: l.qty, to: t.toWarehouseId });
        m.set(l.productId, r);
      }
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty);
  }, [data]);
  const transitList = data?.items.filter(inTransit) ?? [];
  const transitQty = transitList.reduce((s, t) => s + t.lines.reduce((x, l) => x + l.qty, 0), 0);
  const transitValue = data?.avgCost ? transitList.reduce((s, t) => s + t.lines.reduce((x, l) => x + valueOf(l.productId, l.qty), 0n), 0n) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="کالا و انبار"
        help="accountingTransfers"
        actions={
          data?.can.manage &&
          activeW.length > 1 && (
            <button onClick={() => setForm(true)} className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden />
              حواله‌ی تازه
            </button>
          )
        }
      />
      <InventoryTabs />
      <ErrorText>{error}</ErrorText>
      {data && whs.length > 0 && activeW.length < 2 && (
        <Card className="p-4 text-sm text-gray-600 dark:text-gray-300">برای انتقال کالا دست‌کم دو انبار لازم است. از زبانه‌ی «انبارها» انبار دوم را بسازید.</Card>
      )}

      <div className="space-y-2">
        <Chips
          value={view}
          onChange={(v) => {
            setView(v);
            setOne("");
          }}
          options={[
            { value: "all", label: "همه‌ی حواله‌ها" },
            { value: "transit", label: "در راه", count: data?.inTransit },
          ]}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <select value={src} onChange={(e) => setSrc(e.target.value)} className={inputCls} aria-label="از انبار">
            <option value="">از همه‌ی انبارها</option>
            {whs.map((w) => (
              <option key={w.id} value={w.id}>
                از {w.name}
              </option>
            ))}
          </select>
          <select value={dst} onChange={(e) => setDst(e.target.value)} className={inputCls} aria-label="به انبار">
            <option value="">به همه‌ی انبارها</option>
            {whs.map((w) => (
              <option key={w.id} value={w.id}>
                به {w.name}
              </option>
            ))}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شماره‌ی حواله" inputMode="numeric" className={`${inputCls} col-span-2 sm:col-span-1`} />
        </div>
        {one && (
          <button onClick={() => setOne("")} className={btn.small}>
            ✕ نمایش همه‌ی حواله‌ها
          </button>
        )}
      </div>

      {view === "transit" && data && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-black">{faNum(transitQty)} عدد</span> از {faNum(byItem.length)} کالا در {faNum(transitList.length)} حواله در راه است
            {transitValue !== null && (
              <span className="block text-xs text-gray-500 mt-1">
                ارزش: <Money value={transitValue} /> — در «ارزش موجودی» جزو انبار مقصد
              </span>
            )}
          </div>
          <div className="w-56">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "doc", label: "سند به سند" },
                { value: "item", label: "کالا به کالا" },
              ]}
            />
          </div>
        </Card>
      )}

      {view === "transit" && mode === "item" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr className="border-b border-gray-100 dark:border-white/5">
                <th className="text-right p-3">کالا</th>
                <th className="text-center p-3">در راه</th>
                {data?.avgCost && <th className="text-left p-3">ارزش</th>}
                <th className="text-right p-3">حواله‌ها</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {byItem.map((r) => (
                <tr key={r.productId}>
                  <td className="p-3">
                    <Link href={kardex(r.productId)} className="font-bold hover:underline">
                      {data?.titles[r.productId] ?? "کالا"}
                    </Link>
                  </td>
                  <td className="p-3 text-center font-black tabular-nums">{faNum(r.qty)}</td>
                  {data?.avgCost && (
                    <td className="p-3 text-left">
                      <Money value={valueOf(r.productId, r.qty)} />
                    </td>
                  )}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.transfers.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setOne(t.id);
                            setMode("doc");
                          }}
                          className="hover:opacity-80"
                        >
                          <Badge tone="amber">
                            {faNum(t.number)} ← {name(t.to)} × {faNum(t.qty)}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !byItem.length && <Empty title="کالایی در راه نیست" />}
        </Card>
      ) : (
        <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
          {data?.items.map((t) => (
            <TransferRow key={t.id} t={t} data={data} name={name} onVoid={() => voidIt(t)} onReceive={() => setReceiving(t)} />
          ))}
          {data && !data.items.length && <Empty title={view === "transit" ? "حواله‌ای در راه نیست" : "حواله‌ای پیدا نشد"} />}
        </Card>
      )}

      {form && (
        <TransferForm
          warehouses={activeW}
          onClose={() => setForm(false)}
          onSaved={() => {
            setForm(false);
            load();
          }}
        />
      )}
      {receiving && data && (
        <ReceiveForm
          t={receiving}
          titles={data.titles}
          reasons={data.reasons}
          name={name}
          onClose={() => setReceiving(null)}
          onSaved={() => {
            setReceiving(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TransferRow({ t, data, name, onVoid, onReceive }: { t: T; data: Data; name: (id: string) => string; onVoid: () => void; onReceive: () => void }) {
  const qty = t.lines.reduce((s, l) => s + l.qty, 0);
  const got = t.lines.reduce((s, l) => s + (l.receivedQty ?? l.qty), 0);
  const pending = inTransit(t);
  return (
    <div id={t.id} className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={`text-sm font-bold ${t.status === "VOID" ? "line-through text-gray-400" : ""}`}>
            حواله‌ی {faNum(t.number)}: {name(t.fromWarehouseId)} ← {name(t.toWarehouseId)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {formatJalali(new Date(t.date))} · {faNum(qty)} عدد از {faNum(t.lines.length)} کالا · {t.createdByName}
          </p>
          {t.note && <p className="text-xs text-gray-500 mt-1">{t.note}</p>}
          {t.receivedAt && (
            <p className="text-xs text-emerald-600 mt-1">
              دریافت {t.receiveDate ? formatJalali(new Date(t.receiveDate)) : ""} · {t.receivedByName}
              {got < qty && (
                <>
                  {" · "}
                  <span className="text-red-600 font-bold">کسری {faNum(qty - got)}</span>
                  {t.shortageMode === "RETURN" && " — به مبدأ برگشت"}
                  {t.shortageMode === "LOSS" && t.shortageAdjustId && (
                    <>
                      {" — "}
                      <Link href={`/admin/accounting/inventory/adjustments/${t.shortageAdjustId}`} className="underline">
                        سند خروج کسری
                      </Link>
                    </>
                  )}
                </>
              )}
              {t.receiveNote && ` · ${t.receiveNote}`}
            </p>
          )}
          {t.voidReason && <p className="text-xs text-red-600 mt-1">باطل: {t.voidReason}</p>}
        </div>
        <div className="flex items-center gap-2">
          {t.status === "VOID" && <Badge tone="red">باطل</Badge>}
          {pending && <Badge tone="amber">در راه</Badge>}
          {t.status === "POSTED" && t.receivedAt && <Badge tone="green">رسید</Badge>}
          {pending && data.can.receive && (
            <button onClick={onReceive} className={btn.primary}>
              تأیید دریافت
            </button>
          )}
          {t.status === "POSTED" && data.can.manage && (
            <button onClick={onVoid} className={btn.small}>
              ابطال
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {t.lines.map((l) => (
          <Link key={l.id} href={kardex(l.productId)} className="hover:opacity-80">
            <Badge tone={l.receivedQty !== null && l.receivedQty < l.qty ? "red" : "gray"}>
              {data.titles[l.productId] ?? "کالا"} × {faNum(l.qty)}
              {l.receivedQty !== null && l.receivedQty < l.qty && ` (رسید ${faNum(l.receivedQty)})`}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

const toLatin = (v: string) => v.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

function ReceiveForm({
  t,
  titles,
  reasons,
  name,
  onClose,
  onSaved,
}: {
  t: T;
  titles: Record<string, string>;
  reasons: { id: string; name: string }[];
  name: (id: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(dayValue(todayKey()));
  const [got, setGot] = useState<Record<string, string>>(() => Object.fromEntries(t.lines.map((l) => [l.id, String(l.qty)])));
  const [shortage, setShortage] = useState<"LOSS" | "RETURN">("LOSS");
  const [reasonId, setReasonId] = useState(reasons.find((r) => r.name === "کسری")?.id ?? reasons[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const short = t.lines.reduce((s, l) => s + Math.max(0, l.qty - Number(got[l.id] || 0)), 0);
  const over = t.lines.some((l) => Number(got[l.id] || 0) > l.qty);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/inventory/transfers/${t.id}`, {
        method: "POST",
        json: { action: "receive", date, lines: t.lines.map((l) => ({ lineId: l.id, qty: Number(got[l.id] || 0) })), shortage, reasonId: shortage === "LOSS" ? reasonId : null, note },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={`تأیید دریافت حواله‌ی ${faNum(t.number)}`}
      help="accountingTransfers"
      footer={
        <button onClick={save} disabled={busy || over} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : short ? `تأیید دریافت با ${faNum(short)} کسری` : "همه رسید — تأیید"}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          از {name(t.fromWarehouseId)} به {name(t.toWarehouseId)} · ارسال {formatJalali(new Date(t.date))}. تعداد رسیده‌ی هر کالا را بشمارید و بنویسید.
        </p>
        <Field label="تاریخ دریافت">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <div className="space-y-2">
          {t.lines.map((l) => {
            const n = Number(got[l.id] || 0);
            return (
              <div key={l.id} className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{titles[l.productId] ?? "کالا"}</span>
                  <span className={`block text-[11px] ${n > l.qty ? "text-red-600 font-bold" : n < l.qty ? "text-amber-600 font-bold" : "text-gray-400"}`}>
                    ارسال‌شده {faNum(l.qty)}
                    {n < l.qty && ` · کسری ${faNum(l.qty - n)}`}
                    {n > l.qty && " · بیشتر از ارسال نمی‌شود"}
                  </span>
                </span>
                <input
                  value={got[l.id] ?? ""}
                  onChange={(e) => setGot((x) => ({ ...x, [l.id]: toLatin(e.target.value) }))}
                  inputMode="numeric"
                  aria-label="تعداد رسیده"
                  className="w-20 px-2 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-center font-bold"
                />
              </div>
            );
          })}
        </div>
        {short > 0 && (
          <div className="space-y-3 rounded-xl border border-amber-500/30 p-3">
            <p className="text-sm font-bold">{faNum(short)} عدد نرسیده؛ تکلیفش؟</p>
            <Segmented
              value={shortage}
              onChange={setShortage}
              options={[
                { value: "LOSS", label: "کسری انبار مقصد" },
                { value: "RETURN", label: "برگشت به مبدأ" },
              ]}
            />
            {shortage === "LOSS" ? (
              <Field label="دلیل خروج" hint="یک سند «خروج دستی» در انبار مقصد ساخته می‌شود و ارزشش به سرفصل همین دلیل می‌رود">
                <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} className={inputCls}>
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="text-[11px] text-gray-500">کالای نرسیده به موجودی {name(t.fromWarehouseId)} برمی‌گردد (مثلاً ارسال نشده یا پس فرستاده شد).</p>
            )}
          </div>
        )}
        <Field label="توضیح (اختیاری)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function TransferForm({ warehouses, onClose, onSaved }: { warehouses: W[]; onClose: () => void; onSaved: () => void }) {
  const def = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const [from, setFrom] = useState(def?.id ?? "");
  const [to, setTo] = useState(warehouses.find((w) => w.id !== def?.id)?.id ?? "");
  const [date, setDate] = useState(dayValue(todayKey()));
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<{ p: ProductOption; qty: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dest = warehouses.find((w) => w.id === to);

  function add(p: ProductOption) {
    setLines((x) => (x.some((l) => l.p.id === p.id) ? x.map((l) => (l.p.id === p.id ? { ...l, qty: String(Number(l.qty || 0) + 1) } : l)) : [...x, { p, qty: "1" }]));
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/accounting/inventory/transfers", {
        method: "POST",
        json: { date, fromWarehouseId: from, toWarehouseId: to, note, lines: lines.map((l) => ({ productId: l.p.id, qty: Number(l.qty) })) },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title="حواله‌ی انتقال"
      help="accountingTransfers"
      footer={
        <button onClick={save} disabled={busy || !lines.length} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : `${dest?.receiveConfirm ? "ارسال" : "ثبت"} حواله (${faNum(lines.reduce((s, l) => s + Number(l.qty || 0), 0))} عدد)`}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="از انبار">
            <select
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (e.target.value === to) setTo(warehouses.find((w) => w.id !== e.target.value)?.id ?? "");
              }}
              className={inputCls}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="به انبار">
            <select value={to} onChange={(e) => setTo(e.target.value)} className={inputCls}>
              {warehouses.filter((w) => w.id !== from).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {dest?.receiveConfirm && (
          <p className="text-xs rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2">
            «{dest.name}» دریافت با تأیید دارد: کالا همین حالا از مبدأ کم می‌شود و تا تأیید دریافت در آن انبار «در راه» می‌ماند.
          </p>
        )}
        <Field label="تاریخ">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="کالاها" hint="بارکدخوان را هم می‌شود استفاده کرد؛ هر اسکن یک عدد اضافه می‌کند">
          <ProductPicker onPick={add} warehouseId={from} autoFocus />
        </Field>
        <div className="space-y-2">
          {lines.map((l) => {
            const avail = l.p.byWarehouse[from] ?? 0;
            const over = Number(l.qty || 0) > avail;
            return (
              <div key={l.p.id} className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{l.p.title}</span>
                  <span className={`block text-[11px] ${over ? "text-red-600 font-bold" : "text-gray-400"}`}>موجودی مبدأ {faNum(avail)}</span>
                </span>
                <input
                  value={l.qty}
                  onChange={(e) => setLines((x) => x.map((y) => (y.p.id === l.p.id ? { ...y, qty: toLatin(e.target.value) } : y)))}
                  inputMode="numeric"
                  className="w-20 px-2 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-center font-bold"
                />
                <button onClick={() => setLines((x) => x.filter((y) => y.p.id !== l.p.id))} className="text-gray-400 hover:text-red-600 px-1">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <Field label="توضیح (اختیاری)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
