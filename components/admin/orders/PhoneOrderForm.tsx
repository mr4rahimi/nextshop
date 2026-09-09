"use client";

/**
 * فرم ثبت سفارش تلفنی.
 *
 * ⚠️ خودِ سفارش **کارِ کارتابل نمی‌سازد**؛ شمارشش از `Order.createdByStaffId`
 * می‌آید. دو تیک پایین فرم، کارِ **بعدی** می‌سازند: تأمین کالا و هماهنگی
 * ارسال. این‌ها زنجیره‌ی بعد از فروش‌اند نه خودِ فروش.
 *
 * مستندات: docs/features/staff-worklist.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import type { ContactSuggestion } from "@/components/admin/worklist/types";

interface ProductHit {
  id: string;
  title: string;
  price: string;
  salePrice: string | null;
  mainImage: string | null;
}

interface Line {
  productId: string;
  title: string;
  qty: number;
  /** خالی یعنی قیمت کاتالوگ */
  unitPrice: string;
  catalogPrice: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const STATUSES = [
  { key: "PENDING_PAYMENT", label: "در انتظار پرداخت" },
  { key: "PAID", label: "پرداخت شد" },
  { key: "CONFIRMED", label: "تأیید شد" },
] as const;

const fa = (n: number | bigint) => n.toLocaleString("fa-IR");

export default function PhoneOrderForm({ open, onClose, onCreated }: Props) {
  // ── مشتری ───────────────────────────────────────────────────
  const [customer, setCustomer] = useState<ContactSuggestion | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");

  // ── کالاها ──────────────────────────────────────────────────
  const [productQuery, setProductQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  // ── بقیه ────────────────────────────────────────────────────
  const [shippingFee, setShippingFee] = useState("");
  const [discountTotal, setDiscountTotal] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>("PENDING_PAYMENT");
  const [addr, setAddr] = useState({
    receiver: "", phone: "", province: "", city: "", addressLine: "", postalCode: "",
  });
  const [showAddr, setShowAddr] = useState(false);
  const [purchaseTask, setPurchaseTask] = useState(false);
  const [shippingTask, setShippingTask] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderNumber: string; tasks: number } | null>(null);

  const contactAbort = useRef<AbortController | null>(null);
  const productAbort = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setCustomer(null); setContactQuery(""); setSuggestions([]);
    setNewFirst(""); setNewLast("");
    setProductQuery(""); setHits([]); setLines([]);
    setShippingFee(""); setDiscountTotal(""); setNote("");
    setStatus("PENDING_PAYMENT");
    setAddr({ receiver: "", phone: "", province: "", city: "", addressLine: "", postalCode: "" });
    setShowAddr(false); setPurchaseTask(false); setShippingTask(false);
    setError(null); setDone(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // جستجوی مشتری
  useEffect(() => {
    if (!open || customer || contactQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const h = setTimeout(() => {
      contactAbort.current?.abort();
      const c = new AbortController();
      contactAbort.current = c;
      fetch(`/api/admin/worklist/contacts?q=${encodeURIComponent(contactQuery)}`, { signal: c.signal })
        .then((r) => r.json())
        .then((d) => setSuggestions(d.items ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [contactQuery, customer, open]);

  // جستجوی کالا
  useEffect(() => {
    if (!open || productQuery.trim().length < 2) {
      setHits([]);
      return;
    }
    const h = setTimeout(() => {
      productAbort.current?.abort();
      const c = new AbortController();
      productAbort.current = c;
      fetch(`/api/admin/products-search?q=${encodeURIComponent(productQuery)}`, { signal: c.signal })
        .then((r) => r.json())
        .then((d) => setHits((d.products ?? d.items ?? []).slice(0, 8)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [productQuery, open]);

  function addLine(p: ProductHit) {
    setLines((prev) =>
      prev.some((l) => l.productId === p.id)
        ? prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, {
            productId: p.id,
            title: p.title,
            qty: 1,
            unitPrice: "",
            catalogPrice: p.salePrice ?? p.price,
          }],
    );
    setProductQuery("");
    setHits([]);
  }

  const lineTotal = (l: Line) => {
    const unit = l.unitPrice.replace(/[^\d]/g, "");
    const price = unit ? Number(unit) : Number(l.catalogPrice);
    return price * l.qty;
  };
  const itemsTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const grandTotal =
    itemsTotal +
    Number(shippingFee.replace(/[^\d]/g, "") || 0) -
    Number(discountTotal.replace(/[^\d]/g, "") || 0);

  async function submit() {
    if (lines.length === 0) {
      setError("دست‌کم یک کالا انتخاب کنید");
      return;
    }
    if (!customer && !contactQuery.trim()) {
      setError("مشتری را انتخاب کنید یا شماره‌ی موبایل وارد کنید");
      return;
    }
    if (grandTotal < 0) {
      setError("تخفیف از مبلغ سفارش بیشتر است");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer?.id ?? null,
          newCustomer: customer
            ? null
            : { phone: contactQuery.trim(), firstName: newFirst.trim(), lastName: newLast.trim() },
          items: lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice.replace(/[^\d]/g, "") || null,
          })),
          address: showAddr && addr.addressLine.trim() ? addr : null,
          shippingFee: shippingFee.replace(/[^\d]/g, "") || null,
          discountTotal: discountTotal.replace(/[^\d]/g, "") || null,
          note: note.trim() || null,
          status,
          createPurchaseTask: purchaseTask,
          createShippingTask: shippingTask,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ثبت سفارش ناموفق بود");
      setDone({ orderNumber: d.order.orderNumber, tasks: (d.tasks ?? []).length });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت سفارش ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const inputCls =
    "w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400";
  const labelCls = "block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">ثبت سفارش تلفنی</h2>
            <HelpButton topic="phoneOrder" size="sm" />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-2xl">✅</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              سفارش {done.orderNumber} ثبت شد
            </p>
            {done.tasks > 0 && (
              <p className="text-xs text-gray-500">
                {fa(done.tasks)} کار پیگیری هم در کارتابل شما ساخته شد.
              </p>
            )}
            <div className="flex items-center gap-2 justify-center pt-2">
              <button
                onClick={reset}
                className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition"
              >
                سفارش بعدی
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-sm font-bold transition"
              >
                بستن
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* مشتری */}
              <div className="relative">
                <label className={labelCls}>مشتری — نام یا شماره</label>
                {customer ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {customer.name}
                      </p>
                      <p className="text-[11px] text-gray-500" dir="ltr">{customer.phone}</p>
                    </div>
                    <button
                      onClick={() => { setCustomer(null); setContactQuery(""); }}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold shrink-0"
                    >
                      تغییر
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={contactQuery}
                      onChange={(e) => setContactQuery(e.target.value)}
                      placeholder="۰۹۱۲... یا نام مشتری"
                      className={inputCls}
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden">
                        {suggestions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { setCustomer(s); setSuggestions([]); }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-white/5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{s.name}</p>
                              <p className="text-[11px] text-gray-500" dir="ltr">{s.phone}</p>
                            </div>
                            {s.orderCount > 0 && (
                              <span className="text-[10px] text-gray-400 shrink-0">{fa(s.orderCount)} سفارش</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} placeholder="نام (اختیاری)" className={inputCls} />
                      <input value={newLast} onChange={(e) => setNewLast(e.target.value)} placeholder="نام خانوادگی" className={inputCls} />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      اگر شماره در سیستم نباشد، مشتری تازه ساخته می‌شود.
                    </p>
                  </>
                )}
              </div>

              {/* کالاها */}
              <div className="relative">
                <label className={labelCls}>کالاها</label>
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="نام کالا را بنویسید..."
                  className={inputCls}
                />
                {hits.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                    {hits.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addLine(p)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{p.title}</span>
                        <span className="text-[11px] text-gray-500 shrink-0">
                          {fa(Number(p.salePrice ?? p.price))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {lines.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {lines.map((l, i) => (
                      <div key={l.productId} className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{l.title}</p>
                          <button
                            onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                            className="text-[11px] font-bold text-red-600 dark:text-red-400 shrink-0"
                          >
                            حذف
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 items-center">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">تعداد</label>
                            <input
                              type="number"
                              min={1}
                              value={l.qty}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((x, j) =>
                                    j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x,
                                  ),
                                )
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">
                              قیمت واحد
                            </label>
                            <input
                              value={l.unitPrice}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)),
                                )
                              }
                              placeholder={fa(Number(l.catalogPrice))}
                              inputMode="numeric"
                              className="w-full px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none"
                            />
                          </div>
                          <div className="text-left">
                            <label className="block text-[10px] text-gray-500 mb-1">جمع</label>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">
                              {fa(lineTotal(l))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400">
                      قیمت واحد را خالی بگذارید تا قیمت کاتالوگ اعمال شود.
                    </p>
                  </div>
                )}
              </div>

              {/* مبالغ */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>هزینه ارسال (تومان)</label>
                  <input value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} inputMode="numeric" placeholder="۰" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>تخفیف (تومان)</label>
                  <input value={discountTotal} onChange={(e) => setDiscountTotal(e.target.value)} inputMode="numeric" placeholder="۰" className={inputCls} />
                </div>
              </div>

              {/* وضعیت */}
              <div>
                <label className={labelCls}>وضعیت سفارش</label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStatus(s.key)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                        status === s.key
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-transparent"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {status !== "PENDING_PAYMENT" && (
                  <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                    با این وضعیت، موجودی کالاها همین حالا کسر می‌شود.
                  </p>
                )}
              </div>

              {/* آدرس */}
              <div>
                <button
                  onClick={() => setShowAddr((v) => !v)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400"
                >
                  {showAddr ? "بستن آدرس" : "افزودن آدرس ارسال"}
                </button>
                {showAddr && (
                  <div className="mt-2 grid sm:grid-cols-2 gap-2">
                    <input value={addr.receiver} onChange={(e) => setAddr({ ...addr, receiver: e.target.value })} placeholder="گیرنده" className={inputCls} />
                    <input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} placeholder="شماره گیرنده" className={inputCls} />
                    <input value={addr.province} onChange={(e) => setAddr({ ...addr, province: e.target.value })} placeholder="استان" className={inputCls} />
                    <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="شهر" className={inputCls} />
                    <input value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} placeholder="کد پستی" className={inputCls} />
                    <textarea value={addr.addressLine} onChange={(e) => setAddr({ ...addr, addressLine: e.target.value })} rows={2} placeholder="نشانی کامل" className={`${inputCls} sm:col-span-2 resize-none`} />
                  </div>
                )}
              </div>

              {/* یادداشت */}
              <div>
                <label className={labelCls}>یادداشت سفارش</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="هرچه روی تلفن توافق شد" className={`${inputCls} resize-none`} />
              </div>

              {/* کارهای بعدی */}
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3.5 space-y-2">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  کارهای بعدی در کارتابل ساخته شود؟
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={purchaseTask} onChange={(e) => setPurchaseTask(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">تأمین کالا از تأمین‌کننده</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={shippingTask} onChange={(e) => setShippingTask(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">هماهنگی ارسال با مشتری</span>
                </label>
                <p className="text-[10px] text-gray-400">
                  خودِ سفارش کار جدا نمی‌سازد؛ در گزارش عملکرد خودکار شمرده می‌شود.
                </p>
              </div>

              {error && (
                <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs font-bold text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">مبلغ نهایی</span>
                <span className="font-black text-gray-900 dark:text-white">
                  {fa(grandTotal)} تومان
                </span>
              </div>
              <button
                onClick={submit}
                disabled={saving || lines.length === 0}
                className="w-full px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold transition"
              >
                {saving ? "در حال ثبت..." : "ثبت سفارش"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
