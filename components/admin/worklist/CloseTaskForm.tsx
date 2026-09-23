"use client";

/**
 * فرم کوچکِ بستن کار — وقتی نتیجه بدون یک عدد بی‌معنی است.
 *
 * - «خرید شد» روی کار تأمین کالای یک سفارش ← قیمت خرید **واحد** هر کالا و
 *   تأمین‌کننده. قیمت روی سود معامله می‌نشیند؛ اگر مشتری هنوز پرداخت نکرده،
 *   منتظر می‌ماند و با پرداخت خودکار اعمال می‌شود (بخش ۲۲.۱۰).
 * - نوعی که مبلغ می‌خواهد (`needsAmount`) و مبلغش خالی است ← مبلغ
 * - نوعی که باربری می‌خواهد (`needsCarrier`) و خالی است ← باربری
 *
 * بقیه‌ی نتیجه‌ها همان یک ضربه‌اند (TaskCard) — این فرم فقط جایی باز می‌شود
 * که بدون آن عدد، کار «بسته» ولی بی‌ثمر ثبت می‌شد.
 */

import { useEffect, useState } from "react";
import SupplierPicker, { type SupplierOption } from "./SupplierPicker";
import type { CarrierOption, TaskItem } from "./types";

export const PURCHASE_SLUG = "purchase-coordination";

interface PurchaseItem {
  id: string;
  title: string;
  qty: number;
  unitPrice: string;
  unitCost: string | null;
}

export interface OutcomeLite {
  value: string;
  label: string;
  isSuccess?: boolean;
}

/** آیا این نتیجه پیش از ثبت فرم لازم دارد؟ */
export function needsCloseForm(task: TaskItem, o: OutcomeLite): boolean {
  if (task.type.slug === PURCHASE_SLUG && o.isSuccess) return true;
  if (task.type.needsAmount && o.isSuccess && !task.amount) return true;
  if (task.type.needsCarrier && !task.carrier && (o.isSuccess || o.value === "dispatched")) return true;
  return false;
}

const digits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^\d]/g, "");
const fa = (n: number) => n.toLocaleString("fa-IR");

const inputCls =
  "w-full px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400";

export default function CloseTaskForm({
  task,
  outcome,
  busy,
  onCancel,
  onSubmit,
}: {
  task: TaskItem;
  outcome: OutcomeLite;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const purchase = task.type.slug === PURCHASE_SLUG && !!outcome.isSuccess;
  const askAmount = !purchase && task.type.needsAmount && !!outcome.isSuccess && !task.amount;
  const askCarrier = task.type.needsCarrier && !task.carrier;

  const [items, setItems] = useState<PurchaseItem[] | null>(purchase ? null : []);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState<SupplierOption | null>(
    task.supplierId ? { id: task.supplierId, name: task.supplierName ?? "" } : null,
  );
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchase) return;
    fetch(`/api/admin/worklist/tasks/${task.id}/purchase-items`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: PurchaseItem[] }) => {
        setItems(d.items);
        setCosts(Object.fromEntries(d.items.map((i) => [i.id, i.unitCost ?? ""])));
      })
      .catch(() => setItems([]));
  }, [purchase, task.id]);

  useEffect(() => {
    if (!askCarrier) return;
    fetch("/api/admin/worklist/carriers")
      .then((r) => (r.ok ? r.json() : { carriers: [] }))
      .then((d) => setCarriers(d.carriers ?? []))
      .catch(() => {});
  }, [askCarrier]);

  // کار تأمینی که به سفارش وصل نیست: یک مبلغ کل، مثل قبل
  const perItem = purchase && (items?.length ?? 0) > 0;
  const costTotal = perItem ? items!.reduce((s, i) => s + Number(digits(costs[i.id] ?? "") || 0) * i.qty, 0) : 0;
  const saleTotal = perItem ? items!.reduce((s, i) => s + Number(i.unitPrice) * i.qty, 0) : 0;

  function submit() {
    setError(null);
    const body: Record<string, unknown> = { outcome: outcome.value };
    if (perItem) {
      const missing = items!.filter((i) => !Number(digits(costs[i.id] ?? "")));
      if (missing.length) return setError("قیمت خرید همه‌ی کالاها را وارد کنید");
      body.itemCosts = Object.fromEntries(items!.map((i) => [i.id, digits(costs[i.id])]));
    } else if (purchase || askAmount) {
      if (!Number(digits(amount))) return setError(purchase ? "مبلغ کل خرید را وارد کنید" : "مبلغ را وارد کنید");
      body.amount = digits(amount);
    }
    if (purchase) {
      if (!supplier) return setError("تأمین‌کننده را انتخاب یا اضافه کنید");
      body.supplierId = supplier.id;
    }
    if (askCarrier) {
      if (!carrier) return setError("باربری را انتخاب کنید");
      body.carrier = carrier;
    }
    onSubmit(body);
  }

  return (
    <div className="mt-2 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-3 space-y-3">
      <p className="text-xs font-bold text-gray-900 dark:text-white">«{outcome.label}» — پیش از ثبت:</p>

      {purchase && items === null && <p className="text-[11px] text-gray-400">در حال بارگذاری کالاها...</p>}

      {perItem && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500">قیمت خرید یک عدد از هر کالا</p>
          {items!.map((i) => (
            <div key={i.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                  {i.title} × {fa(i.qty)}
                </p>
                <p className="text-[10px] text-gray-400">فروش واحد {fa(Number(i.unitPrice))}</p>
              </div>
              <input
                value={costs[i.id] ? fa(Number(digits(costs[i.id]))) : ""}
                onChange={(e) => setCosts({ ...costs, [i.id]: digits(e.target.value) })}
                inputMode="numeric"
                placeholder="قیمت خرید واحد"
                className={`${inputCls} w-36`}
              />
            </div>
          ))}
          {costTotal > 0 && (
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              جمع خرید <b>{fa(costTotal)}</b> تومان
              {" · "}
              <span className={saleTotal - costTotal < 0 ? "text-red-600" : "text-emerald-600"}>
                سود تقریبی {fa(saleTotal - costTotal)}
              </span>
            </p>
          )}
        </div>
      )}

      {((purchase && items !== null && !perItem) || askAmount) && (
        <input
          value={amount ? fa(Number(digits(amount))) : ""}
          onChange={(e) => setAmount(digits(e.target.value))}
          inputMode="numeric"
          placeholder={purchase ? "مبلغ کل خرید (تومان)" : "مبلغ (تومان)"}
          className={inputCls}
        />
      )}

      {purchase && (
        <div>
          <p className="text-[10px] text-gray-500 mb-1">تأمین‌کننده</p>
          <SupplierPicker value={supplier} onChange={setSupplier} />
        </div>
      )}

      {askCarrier && (
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls}>
          <option value="">باربری را انتخاب کنید</option>
          {carriers.map((c) => (
            <option key={c.title} value={c.title}>
              {c.title}
              {c.sla ? ` — ${c.sla}` : ""}
            </option>
          ))}
        </select>
      )}

      {purchase && (
        <p className="text-[10px] text-gray-500">
          قیمت خرید روی سود معامله می‌نشیند. اگر مشتری هنوز پرداخت نکرده، با پرداختش خودکار اعمال می‌شود. بعد از ثبت،
          کار «هماهنگی ارسال» برای همین سفارش ساخته می‌شود.
        </p>
      )}

      {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          disabled={busy || (purchase && items === null)}
          onClick={submit}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[11px] font-bold"
        >
          {busy ? "..." : "ثبت و بستن کار"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-500">
          انصراف
        </button>
      </div>
    </div>
  );
}
