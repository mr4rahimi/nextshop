"use client";

/**
 * فرم سفارش خرید — docs/plans/webhesab-parity.md بخش ۱۳.
 * «پیشنهاد خرید»: کالاهای رو به اتمام (موجودی + در راه ≤ نقطه‌ی سفارش) همین عرضه‌کننده.
 * ردیفی که فاکتور شده کمتر از فاکتورشده نمی‌شود و پاک نمی‌شود (سرور هم جلویش را می‌گیرد).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb } from "lucide-react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { faNum, formatAmount, toLatinDigits } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import ProductPicker from "../ProductPicker";
import { api, btn, Card, ErrorText, Field, inputCls, PageHeader, SectionTitle, Sheet } from "../ui";

interface Line {
  key: number;
  id?: string;
  productId: string;
  title: string;
  code: string;
  image: string | null;
  qty: string;
  unitPrice: string;
  /** فاکتورشده (صادر + پیش‌نویس) — کف تعداد */
  used: number;
}
interface Suggestion {
  productId: string;
  title: string;
  code: string;
  image: string | null;
  stock: number;
  onOrder: number;
  reorderPoint: number;
  qty: number;
  unitPrice: string;
}

let seq = 0;
const nextKey = () => ++seq;
const digits = (v: string) => toLatinDigits(v).replace(/[^\d]/g, "");

export default function PurchaseOrderEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);
  const [party, setParty] = useState<PartyOption | null>(null);
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [note, setNote] = useState("");
  const [number, setNumber] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [suggest, setSuggest] = useState<(Suggestion & { pick: boolean })[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await api<{ today: string; warehouses: { id: string; name: string; isDefault: boolean }[] }>("/api/admin/accounting/invoices/form");
        setWarehouses(c.warehouses);
        setDate(c.today);
        setWarehouseId((c.warehouses.find((w) => w.isDefault) ?? c.warehouses[0])?.id ?? "");
        if (!id) return;
        const d = await api<{
          order: {
            number: number;
            date: string;
            dueDate: string | null;
            warehouseId: string | null;
            supplierRef: string | null;
            note: string | null;
            party: { id: string; code: number; name: string; mobile: string | null };
            lines: { id: string; productId: string; title: string; code: string; image: string | null; qty: number; unitPrice: string | null; received: number; draft: number }[];
          };
          state: string;
        }>(`/api/admin/accounting/purchase-orders/${id}`);
        const o = d.order;
        setNumber(o.number);
        setParty(o.party);
        setDate(o.date.slice(0, 10));
        setDueDate(o.dueDate?.slice(0, 10) ?? "");
        if (o.warehouseId) setWarehouseId(o.warehouseId);
        setSupplierRef(o.supplierRef ?? "");
        setNote(o.note ?? "");
        setLines(o.lines.map((l) => ({ key: nextKey(), id: l.id, productId: l.productId, title: l.title, code: l.code, image: l.image, qty: String(l.qty), unitPrice: l.unitPrice ?? "0", used: l.received + l.draft })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "بارگذاری نشد");
      }
    })();
  }, [id]);

  const patch = (key: number, p: Partial<Line>) => setLines((x) => x.map((l) => (l.key === key ? { ...l, ...p } : l)));
  function add(p: { productId: string; title: string; code: string; image: string | null; qty?: number; unitPrice?: string }) {
    setLines((x) => {
      const hit = x.find((l) => l.productId === p.productId);
      if (hit) return x.map((l) => (l.key === hit.key ? { ...l, qty: String(Number(l.qty || 0) + (p.qty ?? 1)) } : l));
      return [...x, { key: nextKey(), productId: p.productId, title: p.title, code: p.code, image: p.image, qty: String(p.qty ?? 1), unitPrice: p.unitPrice && p.unitPrice !== "0" ? p.unitPrice : "", used: 0 }];
    });
  }

  async function loadSuggest() {
    setError(null);
    try {
      const p = new URLSearchParams();
      if (party) p.set("partyId", party.id);
      if (warehouseId && warehouses.length > 1) p.set("warehouseId", warehouseId);
      const r = await api<{ items: Suggestion[] }>(`/api/admin/accounting/purchase-orders/suggest?${p}`);
      const have = new Set(lines.map((l) => l.productId));
      setSuggest(r.items.map((s) => ({ ...s, pick: !have.has(s.productId) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "پیشنهاد نیامد");
    }
  }

  const total = useMemo(() => lines.reduce((s, l) => s + BigInt(l.unitPrice || "0") * BigInt(Number(digits(l.qty) || "0")), 0n), [lines]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const json = {
        date,
        dueDate: dueDate || null,
        partyId: party?.id,
        warehouseId: warehouseId || null,
        supplierRef,
        note,
        lines: lines.map((l) => ({ id: l.id ?? null, productId: l.productId, qty: digits(l.qty), unitPrice: l.unitPrice || "0" })),
      };
      const r = id
        ? await api<{ id: string }>(`/api/admin/accounting/purchase-orders/${id}`, { method: "PUT", json })
        : await api<{ id: string }>("/api/admin/accounting/purchase-orders", { method: "POST", json });
      router.push(`/admin/accounting/purchases/orders/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={id ? `ویرایش سفارش خرید ${number ? faNum(number) : ""}` : "سفارش خرید تازه"}
        help="accountingPurchaseOrders"
        back={{ href: id ? `/admin/accounting/purchases/orders/${id}` : "/admin/accounting/purchases/orders", label: id ? "سفارش" : "سفارش خرید" }}
      />
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <Field label="عرضه‌کننده" className="md:col-span-3">
          <PartyPicker value={party} onChange={setParty} canCreate role="supplier" />
        </Field>
        <Field label="تاریخ سفارش">
          <JalaliDatePicker value={date} onChange={setDate} clearable={false} />
        </Field>
        <Field label="موعد تحویل (اختیاری)">
          <JalaliDatePicker value={dueDate} onChange={setDueDate} />
        </Field>
        {warehouses.length > 1 ? (
          <Field label="تحویل به انبار">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div />
        )}
        <Field label="کد پیگیری عرضه‌کننده (اختیاری)" hint="شماره‌ی پیش‌فاکتور یا سفارش در سیستم او">
          <input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} className={inputCls} dir="ltr" />
        </Field>
        <Field label="یادداشت" className="md:col-span-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
      </Card>

      <Card className="space-y-3 p-4">
        <SectionTitle
          title="کالاها"
          actions={
            <button type="button" onClick={loadSuggest} className={btn.small}>
              <Lightbulb className="h-3.5 w-3.5" aria-hidden />
              پیشنهاد خرید
            </button>
          }
        />
        <ProductPicker
          onPick={(p) => add({ productId: p.id, title: p.title, code: p.sku ?? "", image: p.image, unitPrice: p.price })}
          warehouseId={warehouseId || undefined}
          priceFor="purchase"
          partyId={party?.id}
        />
        <div className="space-y-2">
          {lines.map((l) => {
            const qty = Number(digits(l.qty) || "0");
            return (
              <div key={l.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-2.5 dark:bg-white/5">
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-gray-200 dark:bg-white/10" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{l.title}</p>
                    <p className={`text-[10px] ${l.used && qty < l.used ? "font-bold text-red-600" : "text-gray-400"}`}>
                      {[l.code && `کد ${faNum(l.code)}`, l.used > 0 && `فاکتورشده ${faNum(l.used)} — کمتر نمی‌شود`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-1 text-[11px] text-gray-500">
                  تعداد
                  <input value={faNum(l.qty)} onChange={(e) => patch(l.key, { qty: digits(e.target.value) })} inputMode="numeric" className={`${inputCls} !w-20 !py-1.5 text-center font-bold`} />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-gray-500">
                  فی
                  <span className="w-36">
                    <AmountInput compact value={l.unitPrice} onChange={(v) => patch(l.key, { unitPrice: v })} />
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}
                  disabled={l.used > 0}
                  className="px-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                  aria-label="حذف ردیف"
                  title={l.used > 0 ? "فاکتور شده و حذف نمی‌شود" : "حذف"}
                >
                  ✕
                </button>
              </div>
            );
          })}
          {!lines.length && <p className="py-4 text-center text-xs text-gray-400">کالا را جستجو یا اسکن کنید، یا «پیشنهاد خرید» را بزنید.</p>}
        </div>
        {lines.length > 0 && (
          <p className="text-left text-sm">
            {faNum(lines.length)} قلم، {faNum(lines.reduce((s, l) => s + Number(digits(l.qty) || "0"), 0))} عدد
            {total > 0n && <> — جمع تقریبی {formatAmount(total)} تومان</>}
          </p>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy || !party || !lines.length} className={`${btn.primary} flex-1 md:flex-none`}>
          {busy ? "…" : id ? "ذخیره" : "ثبت سفارش"}
        </button>
      </div>

      {suggest && (
        <Sheet
          open
          onClose={() => setSuggest(null)}
          title="پیشنهاد خرید"
          help="accountingPurchaseOrders"
          wide
          footer={
            <button
              onClick={() => {
                for (const s of suggest.filter((x) => x.pick)) add({ ...s, unitPrice: s.unitPrice });
                setSuggest(null);
              }}
              disabled={!suggest.some((s) => s.pick)}
              className={`${btn.primary} w-full`}
            >
              افزودن {faNum(suggest.filter((s) => s.pick).length)} کالا به سفارش
            </button>
          }
        >
          <p className="mb-3 text-xs leading-6 text-gray-500">
            کالاهایی که موجودی به‌اضافه‌ی سفارش‌های باز در راهشان به نقطه‌ی سفارش رسیده{party ? ` و عرضه‌کننده‌شان «${party.name}» است` : ""}. تعداد پیشنهادی تا دو برابر نقطه‌ی سفارش
            پر می‌کند؛ در سفارش عوضش کنید.
          </p>
          {!suggest.length ? (
            <p className="py-6 text-center text-sm text-gray-400">کالای رو به اتمامی نیست.</p>
          ) : (
            <div className="divide-y divide-[var(--adm-border)] rounded-2xl border border-[var(--adm-border)]">
              <label className="flex items-center gap-2 px-3 py-2 text-xs font-bold">
                <input type="checkbox" checked={suggest.every((s) => s.pick)} onChange={(e) => setSuggest(suggest.map((s) => ({ ...s, pick: e.target.checked })))} />
                همه
              </label>
              {suggest.map((s, i) => (
                <label key={s.productId} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                  <input type="checkbox" checked={s.pick} onChange={(e) => setSuggest(suggest.map((x, k) => (k === i ? { ...x, pick: e.target.checked } : x)))} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.title}</span>
                    <span className="text-[11px] text-gray-400">
                      موجودی {faNum(s.stock)} · در راه {faNum(s.onOrder)} · نقطه‌ی سفارش {faNum(s.reorderPoint)}
                    </span>
                  </span>
                  <span className="text-sm font-black tabular-nums">{faNum(s.qty)}</span>
                </label>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
