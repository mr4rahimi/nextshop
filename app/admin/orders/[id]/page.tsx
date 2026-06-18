"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderItem {
  id: string;
  qty: number;
  unitPrice: string;
  unitSalePrice: string | null;
  titleSnapshot: string;
  skuSnapshot: string | null;
  product: { id: string; title: string; slug: string; mainImage: string | null; images: { url: string }[] };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  itemsTotal: string;
  shippingFee: string;
  discountTotal: string;
  grandTotal: string;
  note: string | null;
  trackingCode: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; phone: string; email: string | null; avatarUrl: string | null };
  address: { receiver: string; phone: string; province: string; city: string; addressLine: string; postalCode: string | null } | null;
  items: OrderItem[];
  payments: { id: string; status: string; provider: string | null; amount: string; createdAt: string }[];
}

interface StoreSettings {
  storeName: string | null;
  senderName: string | null;
  senderPhone: string | null;
  senderProvince: string | null;
  senderCity: string | null;
  senderAddress: string | null;
  senderPostalCode: string | null;
  storeLogo: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200",   dot: "bg-amber-500" },
  PAID:            { label: "پرداخت شده",        color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200",       dot: "bg-blue-500" },
  CONFIRMED:       { label: "تأیید شده",          color: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200", dot: "bg-indigo-500" },
  PROCESSING:      { label: "در حال آماده‌سازی", color: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 border-cyan-200",       dot: "bg-cyan-500 animate-pulse" },
  PACKAGING:       { label: "بسته‌بندی",          color: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 border-violet-200", dot: "bg-violet-500" },
  SHIPPED:         { label: "ارسال شده",          color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-200", dot: "bg-purple-500 animate-pulse" },
  DELIVERED:       { label: "تحویل داده شده",     color: "bg-teal-50 dark:bg-teal-900/20 text-teal-600 border-teal-200",     dot: "bg-teal-500" },
  COMPLETED:       { label: "تکمیل شده",          color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200", dot: "bg-emerald-500" },
  CANCELED:        { label: "لغو شده",            color: "bg-red-50 dark:bg-red-900/20 text-red-500 border-red-200",         dot: "bg-red-500" },
  REFUNDED:        { label: "مسترد شده",          color: "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200",       dot: "bg-gray-400" },
};

const STATUS_FLOW = [
  "PENDING_PAYMENT","PAID","CONFIRMED","PROCESSING","PACKAGING","SHIPPED","DELIVERED","COMPLETED"
];

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "در انتظار", SUCCEEDED: "موفق", FAILED: "ناموفق", REFUNDED: "مسترد",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }
function formatDate(iso: string)  { return new Date(iso).toLocaleDateString("fa-IR"); }
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fa-IR")} ${d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`;
}

// ── Print helpers ──────────────────────────────────────────────────────────────
function printInvoice(order: Order) {
  const w = window.open("", "_blank");
  if (!w) return;
  const items = order.items.map(i => {
    const p = Number(i.unitSalePrice ?? i.unitPrice);
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i.titleSnapshot}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">${p.toLocaleString("fa-IR")}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">${(p * i.qty).toLocaleString("fa-IR")}</td>
    </tr>`;
  }).join("");
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>فاکتور #${order.orderNumber}</title>
    <style>body{font-family:Tahoma,sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:10px;text-align:right;font-size:12px}td{font-size:13px}h1{font-size:20px}h2{font-size:14px;color:#555}.total{font-size:16px;font-weight:bold;color:#2563eb}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:2px solid #111;padding-bottom:16px">
      <h1>فاکتور فروش — #${order.orderNumber}</h1>
      <div style="text-align:left;font-size:12px;color:#555">
        <div>تاریخ: ${formatDate(order.createdAt)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div><h2>اطلاعات خریدار</h2>
        <p>${[order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.phone}</p>
        <p>${order.user.phone}</p>
        ${order.user.email ? `<p>${order.user.email}</p>` : ""}
      </div>
      <div><h2>آدرس تحویل</h2>
        ${order.address ? `<p>${order.address.province}، ${order.address.city}</p><p>${order.address.addressLine}</p><p>کد پستی: ${order.address.postalCode ?? "—"}</p>` : "<p>—</p>"}
      </div>
    </div>
    <table><thead><tr><th>شرح کالا</th><th style="text-align:center">تعداد</th><th style="text-align:left">قیمت واحد (تومان)</th><th style="text-align:left">جمع (تومان)</th></tr></thead>
    <tbody>${items}</tbody></table>
    <div style="margin-top:24px;text-align:left;border-top:1px solid #eee;padding-top:16px">
      <p>جمع اقلام: ${toFa(order.itemsTotal)} تومان</p>
      ${Number(order.shippingFee) > 0 ? `<p>هزینه ارسال: ${toFa(order.shippingFee)} تومان</p>` : ""}
      ${Number(order.discountTotal) > 0 ? `<p>تخفیف: -${toFa(order.discountTotal)} تومان</p>` : ""}
      <p class="total">مبلغ نهایی: ${toFa(order.grandTotal)} تومان</p>
    </div>
    <script>window.print();window.close();</script></body></html>`);
  w.document.close();
}

function printShippingLabel(order: Order, settings: StoreSettings | null) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>رسید پستی #${order.orderNumber}</title>
    <style>
      body{font-family:Tahoma,sans-serif;padding:0;margin:0;color:#111}
      .label{width:148mm;min-height:100mm;border:2px solid #111;padding:16px;box-sizing:border-box;page-break-inside:avoid}
      .section{border:1px solid #ccc;padding:10px;margin-bottom:8px;border-radius:4px}
      h3{margin:0 0 8px;font-size:13px;color:#555;border-bottom:1px solid #eee;padding-bottom:4px}
      p{margin:4px 0;font-size:13px}
      .barcode{text-align:center;font-size:20px;font-family:monospace;letter-spacing:4px;padding:8px;background:#f5f5f5;border-radius:4px}
      .order-num{font-size:18px;font-weight:bold;text-align:center;padding:8px;background:#2563eb;color:white;border-radius:4px;margin-bottom:8px}
      @media print{body{margin:0}}</style>
    </head><body>
    <div class="label">
      <div class="order-num">سفارش #${order.orderNumber}</div>
      <div class="section"><h3>فرستنده</h3>
        <p>${settings?.senderName ?? settings?.storeName ?? "فروشگاه"}</p>
        <p>${settings?.senderPhone ?? "—"}</p>
        <p>${[settings?.senderProvince, settings?.senderCity].filter(Boolean).join("، ") || "—"}</p>
        <p>${settings?.senderAddress ?? "—"}</p>
        ${settings?.senderPostalCode ? `<p>کد پستی: ${settings.senderPostalCode}</p>` : ""}
      </div>
      <div class="section"><h3>گیرنده</h3>
        <p>${order.address?.receiver ?? "—"}</p>
        <p>${order.address?.phone ?? "—"}</p>
        <p>${[order.address?.province, order.address?.city].filter(Boolean).join("، ") ?? "—"}</p>
        <p>${order.address?.addressLine ?? "—"}</p>
        ${order.address?.postalCode ? `<p>کد پستی: ${order.address.postalCode}</p>` : ""}
      </div>
      ${order.trackingCode ? `<div class="barcode">${order.trackingCode}</div>` : ""}
      <p style="font-size:10px;text-align:center;color:#888;margin-top:8px">تاریخ ارسال: ${formatDate(order.createdAt)}</p>
    </div>
    <script>window.print();window.close();</script></body></html>`);
  w.document.close();
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then(r => r.json())
      .then(data => {
        setOrder(data.order);
        setStoreSettings(data.storeSettings);
        setNote(data.order.note ?? "");
        setTrackingCode(data.order.trackingCode ?? "");
        setSelectedStatus(data.order.status);
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    if (!order) return;
    setSaving(true); setStatusMsg("");
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: selectedStatus, trackingCode, note }),
    });
    const data = await res.json();
    setOrder(prev => prev ? { ...prev, ...data } : prev);
    setStatusMsg("تغییرات ذخیره شد");
    setSaving(false);
    setTimeout(() => setStatusMsg(""), 3000);
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
    </div>
  );

  if (!order) return <div className="p-6 text-gray-500">سفارش یافت نشد</div>;

  const s = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING_PAYMENT;
  const userName = [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.phone;
  const currentStepIdx = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-600 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">سفارش #{order.orderNumber}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => printInvoice(order)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            چاپ فاکتور
          </button>
          <button onClick={() => printShippingLabel(order, storeSettings)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            چاپ رسید پستی
          </button>
          <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border ${s.color}`}>
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>
      </div>

      {}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-black text-sm text-gray-900 dark:text-white mb-6">مسیر سفارش</h3>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {STATUS_FLOW.map((st, i) => {
            const s = STATUS_MAP[st];
            const done  = i <= currentStepIdx;
            const active = i === currentStepIdx;
            return (
              <div key={st} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    active ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30" :
                    done ? "bg-emerald-500 border-emerald-500" : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  }`}>
                    {done && !active ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : active ? (
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full" />
                    )}
                  </div>
                  <span className={`text-[9px] font-black whitespace-nowrap max-w-[64px] text-center leading-tight ${
                    active ? "text-blue-600 dark:text-blue-400" : done ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                  }`}>{s.label}</span>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`h-0.5 w-8 mx-1 flex-shrink-0 transition-all ${i < currentStepIdx ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {}
        <div className="lg:col-span-2 space-y-6">

          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">تغییر وضعیت سفارش</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <button key={key} onClick={() => setSelectedStatus(key)}
                  className={`relative flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-black transition-all text-right ${
                    selectedStatus === key ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600" : "border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${val.dot.replace("animate-pulse","")}`} />
                  {val.label}
                  {selectedStatus === key && (
                    <svg className="w-3.5 h-3.5 absolute left-2 top-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">کد رهگیری مرسوله</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                  placeholder="کد رهگیری پست..."
                  value={trackingCode} onChange={e => setTrackingCode(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">یادداشت ادمین</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                  placeholder="یادداشت داخلی..."
                  value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-60 hover:bg-blue-700 transition-all">
                {saving ? "ذخیره..." : "ذخیره تغییرات"}
              </button>
              {statusMsg && <span className="text-xs font-bold text-emerald-600">✓ {statusMsg}</span>}
            </div>
          </div>

          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">اقلام سفارش ({toFa(order.items.length)} قلم)</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {order.items.map(item => {
                const img = item.product.mainImage ?? item.product.images[0]?.url ?? null;
                const price = Number(item.unitSalePrice ?? item.unitPrice);
                const orig  = Number(item.unitPrice);
                return (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-700">
                      {img ? <img src={img} alt={item.titleSnapshot} className="w-full h-full object-contain" /> : <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">{item.titleSnapshot}</p>
                      {item.unitSalePrice && Number(item.unitSalePrice) < orig && (
                        <p className="text-[10px] text-gray-400 line-through tabular-nums">{toFa(orig)} تومان</p>
                      )}
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="text-xs text-gray-500">{toFa(item.qty)} عدد × {toFa(price)}</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{toFa(price * item.qty)} ت</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {}
            <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">جمع اقلام:</span>
                <span className="font-black tabular-nums">{toFa(order.itemsTotal)} تومان</span>
              </div>
              {Number(order.shippingFee) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">هزینه ارسال:</span>
                  <span className="font-black tabular-nums">{toFa(order.shippingFee)} تومان</span>
                </div>
              )}
              {Number(order.discountTotal) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">تخفیف:</span>
                  <span className="font-black text-emerald-600 tabular-nums">-{toFa(order.discountTotal)} تومان</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="font-black text-gray-900 dark:text-white">مبلغ نهایی:</span>
                <span className="font-black text-blue-600 text-lg tabular-nums">{toFa(order.grandTotal)} تومان</span>
              </div>
            </div>
          </div>

          {}
          {order.payments.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-black text-sm text-gray-900 dark:text-white">وضعیت پرداخت</h3>
              </div>
              {order.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {p.provider === "card_transfer" ? "کارت به کارت" : "درگاه آنلاین"}
                    </p>
                    <p className="text-[10px] text-gray-400">{formatDateTime(p.createdAt)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{toFa(p.amount)} تومان</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                      p.status === "SUCCEEDED" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                      p.status === "FAILED" ? "bg-red-50 dark:bg-red-900/20 text-red-500" :
                      "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                    }`}>{PAYMENT_STATUS[p.status] ?? p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {}
        <div className="space-y-6">

          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">اطلاعات خریدار</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {order.user.avatarUrl
                  ? <img src={order.user.avatarUrl} alt={userName} className="w-full h-full object-cover" />
                  : <span className="text-lg font-black text-blue-600">{(order.user.firstName ?? order.user.phone).charAt(0)}</span>
                }
              </div>
              <div>
                <p className="font-black text-sm text-gray-900 dark:text-white">{userName}</p>
                <p className="text-xs text-gray-400" dir="ltr">{order.user.phone}</p>
              </div>
            </div>
            {order.user.email && <p className="text-xs text-gray-500 mb-3">{order.user.email}</p>}
            <Link href={`/admin/users/${order.user.id}`}
              className="block w-full py-2 text-center text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 transition-all">
              مشاهده پروفایل کاربر
            </Link>
          </div>

          {}
          {order.address && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">آدرس تحویل</h3>
              {[
                { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", val: order.address.receiver },
                { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", val: order.address.phone },
                { icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z", val: `${order.address.province}، ${order.address.city}، ${order.address.addressLine}` },
                ...(order.address.postalCode ? [{ icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", val: `کد پستی: ${order.address.postalCode}` }] : []),
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-relaxed">{item.val}</p>
                </div>
              ))}
            </div>
          )}

          {}
          {order.trackingCode && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-5">
              <h3 className="font-black text-sm text-blue-700 dark:text-blue-400 mb-2">کد رهگیری</h3>
              <p className="text-lg font-black text-blue-600 tracking-widest tabular-nums">{order.trackingCode}</p>
            </div>
          )}

          {}
          {order.note && (
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800 p-5">
              <h3 className="font-black text-sm text-amber-700 dark:text-amber-400 mb-2">یادداشت</h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{order.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
