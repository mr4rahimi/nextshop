"use client";

/** حواله‌های انتقال بین انبارها — فهرست، ثبت و ابطال */

import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import ProductPicker, { type ProductOption } from "../ProductPicker";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Empty, ErrorText, Field, inputCls, PageHeader, Sheet } from "../ui";
import { Plus } from "lucide-react";

interface W {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
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
  lines: { id: string; productId: string; qty: number }[];
}

export default function TransfersClient() {
  const [data, setData] = useState<{ items: T[]; titles: Record<string, string>; can: { manage: boolean } } | null>(null);
  const [whs, setWhs] = useState<W[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api<{ items: T[]; titles: Record<string, string>; can: { manage: boolean } }>("/api/admin/accounting/inventory/transfers"),
      api<{ items: W[] }>("/api/admin/accounting/inventory/warehouses"),
    ])
      .then(([t, w]) => {
        setData(t);
        setWhs(w.items);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function voidIt(t: T) {
    const reason = window.prompt(`دلیل ابطال حواله‌ی ${faNum(t.number)}؟ کالا به انبار مبدأ برمی‌گردد.`);
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
      {data && activeW.length < 2 && (
        <Card className="p-4 text-sm text-gray-600 dark:text-gray-300">برای انتقال کالا دست‌کم دو انبار لازم است. از زبانه‌ی «انبارها» انبار دوم را بسازید.</Card>
      )}
      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((t) => (
          <div key={t.id} id={t.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className={`text-sm font-bold ${t.status === "VOID" ? "line-through text-gray-400" : ""}`}>
                  حواله‌ی {faNum(t.number)}: {name(t.fromWarehouseId)} ← {name(t.toWarehouseId)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {formatJalali(new Date(t.date))} · {faNum(t.lines.reduce((s, l) => s + l.qty, 0))} عدد از {faNum(t.lines.length)} کالا · {t.createdByName}
                </p>
                {t.note && <p className="text-xs text-gray-500 mt-1">{t.note}</p>}
                {t.voidReason && <p className="text-xs text-red-600 mt-1">باطل: {t.voidReason}</p>}
              </div>
              <div className="flex items-center gap-2">
                {t.status === "VOID" && <Badge tone="red">باطل</Badge>}
                {t.status === "POSTED" && data.can.manage && (
                  <button onClick={() => voidIt(t)} className={btn.small}>
                    ابطال
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {t.lines.map((l) => (
                <Badge key={l.id}>
                  {data.titles[l.productId] ?? "کالا"} × {faNum(l.qty)}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {data && !data.items.length && <Empty title="هنوز حواله‌ای ثبت نشده" />}
      </Card>
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
    </div>
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
          {busy ? "در حال ثبت…" : `ثبت حواله (${faNum(lines.reduce((s, l) => s + Number(l.qty || 0), 0))} عدد)`}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="از انبار">
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls}>
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
                  onChange={(e) => setLines((x) => x.map((y) => (y.p.id === l.p.id ? { ...y, qty: e.target.value.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))) } : y)))}
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
