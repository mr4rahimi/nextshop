"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface UserDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  nationalCode: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  walletBalance: string;
  addresses: any[];
  orders: { id: string; orderNumber: string; status: string; grandTotal: string; createdAt: string; _count: { items: number } }[];
  walletTx: { id: string; amount: string; reason: string; createdAt: string }[];
  _count: { orders: number; reviews: number; wishlist: number };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
  PAID:            { label: "پرداخت شده",        color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
  PROCESSING:      { label: "در حال پردازش",     color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
  SHIPPED:         { label: "ارسال شده",          color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
  DELIVERED:       { label: "تحویل شده",          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
  CANCELED:        { label: "لغو شده",            color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
  REFUNDED:        { label: "مرجوع شده",          color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
};

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("fa-IR"); }

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", isActive: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(r => r.json())
      .then(data => {
        setUser(data);
        setForm({ firstName: data.firstName ?? "", lastName: data.lastName ?? "", email: data.email ?? "", isActive: data.isActive });
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setUser(prev => prev ? { ...prev, ...data } : prev);
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.phone;
    if (!confirm(`کاربر "${name}" و تمام اطلاعاتش حذف شود؟`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    router.push("/admin/users");
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
    </div>
  );

  if (!user) return <div className="p-6 text-gray-500">کاربر یافت نشد</div>;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/users"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-600 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">جزئیات کاربر</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(!editing)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            ویرایش
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-100 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            حذف کاربر
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ستون راست — پروفایل */}
        <div className="space-y-6">

          {/* کارت پروفایل */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-500/20 to-blue-500/5 border border-blue-500/10 flex items-center justify-center overflow-hidden mb-4">
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                  : <span className="text-2xl font-black text-blue-600">{(user.firstName ?? user.phone).charAt(0)}</span>
                }
              </div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">{fullName}</h2>
              <p className="text-sm text-gray-500 mt-1" dir="ltr">{user.phone}</p>
              <span className={`mt-3 px-3 py-1 rounded-full text-[10px] font-black ${user.isActive ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-red-50 dark:bg-red-900/20 text-red-500"}`}>
                {user.isActive ? "فعال" : "غیرفعال"}
              </span>
            </div>

            <div className="mt-6 space-y-3 text-sm">
              {user.email && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400 text-xs truncate">{user.email}</span>
                </div>
              )}
              {user.nationalCode && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400 text-xs tabular-nums">{user.nationalCode}</span>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-600 dark:text-gray-400 text-xs">عضویت: {formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* آمار */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "سفارش", value: user._count.orders, color: "blue" },
              { label: "نظر", value: user._count.reviews, color: "purple" },
              { label: "علاقه", value: user._count.wishlist, color: "rose" },
            ].map(item => (
              <div key={item.label} className={`bg-${item.color}-50 dark:bg-${item.color}-900/20 rounded-2xl p-4 text-center`}>
                <p className={`text-xl font-black text-${item.color}-600`}>{toFa(item.value)}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          {/* کیف پول */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
            <p className="text-[11px] font-black opacity-70 uppercase">موجودی کیف پول</p>
            <p className="text-2xl font-black mt-1 tabular-nums">{toFa(user.walletBalance)}</p>
            <p className="text-[10px] opacity-60 mt-0.5">تومان</p>
          </div>
        </div>

        {/* ستون چپ — جزئیات */}
        <div className="lg:col-span-2 space-y-6">

          {/* فرم ویرایش */}
          {editing && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 space-y-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">ویرایش اطلاعات کاربر</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">نام</label>
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">نام خانوادگی</label>
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-500 block mb-1">ایمیل</label>
                  <input type="email" dir="ltr" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-all" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-5" />
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">کاربر فعال</span>
              </label>
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:bg-blue-700 transition-all">
                  {saving ? "ذخیره..." : "ذخیره"}
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  انصراف
                </button>
              </div>
            </div>
          )}

          {/* سفارشات */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">سفارشات اخیر</h3>
              <span className="text-xs font-bold text-gray-400">{toFa(user._count.orders)} سفارش کل</span>
            </div>
            {user.orders.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">سفارشی ثبت نشده</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {user.orders.map(order => {
                  const s = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING_PAYMENT;
                  return (
                    <div key={order.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">#{order.orderNumber}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${s.color}`}>{s.label}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(order.createdAt)} — {toFa(order._count.items)} قلم</p>
                      </div>
                      <span className="text-sm font-black text-gray-700 dark:text-gray-300 tabular-nums flex-shrink-0">{toFa(order.grandTotal)} ت</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* آدرس‌ها */}
          {user.addresses.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-black text-sm text-gray-900 dark:text-white">آدرس‌ها ({toFa(user.addresses.length)})</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {user.addresses.map((addr: any) => (
                  <div key={addr.id} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      {addr.title && <span className="text-xs font-black text-gray-700 dark:text-gray-300">{addr.title}</span>}
                      {addr.isDefault && <span className="px-2 py-0.5 rounded bg-blue-500 text-white text-[8px] font-black">پیش‌فرض</span>}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-5">
                      {addr.province}، {addr.city}، {addr.addressLine}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تراکنش‌های کیف پول */}
          {user.walletTx.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-black text-sm text-gray-900 dark:text-white">تراکنش‌های اخیر کیف پول</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {user.walletTx.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{tx.reason}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-black tabular-nums ${Number(tx.amount) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {Number(tx.amount) >= 0 ? "+" : ""}{toFa(tx.amount)} ت
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}