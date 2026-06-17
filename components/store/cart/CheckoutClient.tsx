"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/store/cart/CartContext";
import { PROVINCES } from "@/lib/iran-cities";

interface Address {
  id: string;
  title: string | null;
  receiver: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string | null;
  isDefault: boolean;
}

interface ShippingMethod {
  id: string;
  title: string;
  type: string;
  fee: string;
  description: string | null;
  cities: string[];
}

interface StoreSettings {
  cardNumber: string | null;
  cardHolder: string | null;
  cardBank: string | null;
  cardReceiptInfo: string | null;
  paymentGatewayActive: boolean;
  walletEnabled: boolean;
}

interface Props {
  initialAddresses: Address[];
  storeSettings: StoreSettings;
  walletBalance: string;
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

function CheckoutSteps({ current }: { current: number }) {
  const steps = [
    { label: "سبد خرید", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
    { label: "اطلاعات ارسال", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "پرداخت نهایی", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  ];
  return (
    <div className="max-w-4xl mx-auto mb-16 px-4" dir="rtl">
      <div className="relative flex items-center justify-between">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-white/5 -translate-y-1/2 rounded-full" />
        <div className="absolute top-1/2 right-0 h-1 bg-primary-500 -translate-y-1/2 rounded-full transition-all duration-700"
          style={{ width: current === 0 ? "0%" : current === 1 ? "50%" : "100%" }} />
        {steps.map((s, i) => (
          <div key={i} className={`relative z-10 flex flex-col items-center gap-3 ${i > current ? "opacity-50" : ""}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-4 ${
              i < current ? "bg-emerald-500 text-white border-white dark:border-[#0f172a] shadow-lg" :
              i === current ? "bg-primary-500 text-white border-white dark:border-[#0f172a] shadow-xl shadow-primary-500/40" :
              "bg-white/40 dark:bg-white/[0.02] text-gray-400 border-gray-100 dark:border-white/5"
            }`}>
              {i < current ? (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={s.icon} />
                </svg>
              )}
            </div>
            <span className={`text-[11px] font-black uppercase tracking-widest ${i < current ? "text-emerald-500" : i === current ? "text-primary-600 dark:text-primary-400" : "text-gray-400"}`}>
              {i < current ? "تکمیل شد" : s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_ADDR = { title: "", receiver: "", phone: "", province: "", city: "", addressLine: "", postalCode: "", isDefault: false };

export default function CheckoutClient({ initialAddresses, storeSettings, walletBalance }: Props) {
  const { items, total, count, clearCart } = useCart();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(
    initialAddresses.find(a => a.isDefault) ?? initialAddresses[0] ?? null
  );
  const [showAddressList, setShowAddressList] = useState(initialAddresses.length === 0);
  const [showAddForm, setShowAddForm] = useState(initialAddresses.length === 0);
  const [newAddr, setNewAddr] = useState({ ...EMPTY_ADDR });
  const [savingAddr, setSavingAddr] = useState(false);

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingMethod | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"online" | "card">("online");
  const [useWallet, setUseWallet] = useState(false);
  const walletBalanceNum = Number(walletBalance ?? "0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addrCities = PROVINCES.find(p => p.name === newAddr.province)?.cities ?? [];

  // لود روش‌های ارسال وقتی آدرس انتخاب شد
  useEffect(() => {
    if (!selectedAddress) return;
    fetch(`/api/store/shipping?city=${encodeURIComponent(selectedAddress.city)}`)
      .then(r => r.json())
      .then((methods: ShippingMethod[]) => {
        setShippingMethods(methods);
        setSelectedShipping(methods[0] ?? null);
      });
  }, [selectedAddress?.id]);

  useEffect(() => {
    if (count === 0) router.push("/cart");
    }, [count]);

    if (count === 0) return null;

  const shippingFee = selectedShipping ? Number(selectedShipping.fee) : 0;
  const discount = items.reduce((s, i) => {
    const orig = Number(i.product.price);
    const sale = Number(i.product.salePrice ?? i.product.price);
    return s + (orig - sale) * i.qty;
  }, 0);
  const walletDiscount = useWallet ? Math.min(walletBalanceNum, total + shippingFee) : 0;
  const grandTotal = total + shippingFee - walletDiscount;

  async function handleSaveAddress() {
    if (!newAddr.receiver || !newAddr.phone || !newAddr.province || !newAddr.city || !newAddr.addressLine) {
      setError("لطفاً همه فیلدهای اجباری را پر کنید"); return;
    }
    setSavingAddr(true); setError("");
    const res = await fetch("/api/user/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAddr),
    });
    const addr = await res.json();
    setAddresses(prev => [addr, ...prev]);
    setSelectedAddress(addr);
    setShowAddForm(false);
    setShowAddressList(false);
    setNewAddr({ ...EMPTY_ADDR });
    setSavingAddr(false);
  }

  async function handleSubmit() {
    if (!selectedAddress) { setError("آدرس تحویل را انتخاب کنید"); return; }
    if (!selectedShipping) { setError("روش ارسال را انتخاب کنید"); return; }

    setSubmitting(true); setError("");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressId: selectedAddress.id,
        shippingMethodId: selectedShipping.id,
        paymentMethod,
        useWallet,
        items: items.map(i => ({ productId: i.productId, qty: i.qty })),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "خطا در ثبت سفارش"); setSubmitting(false); return; }

  
    router.push(`/checkout/confirm/${data.orderId}`);
  }

  return (
    <section className="relative py-16 transition-colors duration-700" dir="rtl">
      <CheckoutSteps current={1} />

      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ستون اصلی */}
          <div className="lg:col-span-9 space-y-6">

            {/* ── آدرس تحویل ─────────────────────────────────────── */}
            <div className="bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">آدرس تحویل سفارش</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Shipping Details</p>
                  </div>
                </div>
                {selectedAddress && (
                  <button onClick={() => { setShowAddressList(!showAddressList); setShowAddForm(false); }}
                    className="px-4 py-2 bg-primary-600/10 text-primary-600 rounded-xl text-xs font-black hover:bg-primary-600 hover:text-white transition-all">
                    تغییر یا ویرایش
                  </button>
                )}
              </div>

              {/* آدرس انتخاب‌شده */}
              {selectedAddress && !showAddressList && (
                <div className="p-6 bg-primary-500/5 rounded-3xl border border-primary-500/10">
                  <p className="text-gray-800 dark:text-gray-200 font-bold leading-loose text-sm">
                    {selectedAddress.province}، {selectedAddress.city}، {selectedAddress.addressLine}
                  </p>
                  <div className="flex items-center gap-6 mt-4 text-[11px] text-gray-500 font-bold">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <b>{selectedAddress.receiver}</b>
                    </span>
                    <span className="flex items-center gap-1.5" dir="ltr">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <b>{selectedAddress.phone}</b>
                    </span>
                  </div>
                </div>
              )}

              {/* لیست آدرس‌ها */}
              {showAddressList && (
                <div className="space-y-3">
                  {addresses.map(a => (
                    <div key={a.id} onClick={() => { setSelectedAddress(a); setShowAddressList(false); }}
                      className={`cursor-pointer p-5 rounded-2xl border-2 transition-all ${selectedAddress?.id === a.id ? "border-primary-500 bg-primary-50/50 dark:bg-primary-900/10" : "border-gray-100 dark:border-white/5 bg-white/60 dark:bg-white/5 hover:border-primary-300"}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          {a.title && <span className="text-[10px] font-black text-primary-600 block mb-1">{a.title}</span>}
                          <p className="text-xs text-gray-700 dark:text-gray-300 font-bold leading-relaxed">
                            {a.province}، {a.city}، {a.addressLine}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">{a.receiver} — {a.phone}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedAddress?.id === a.id ? "bg-primary-500 border-primary-500" : "border-gray-300"}`}>
                          {selectedAddress?.id === a.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button onClick={() => setShowAddForm(!showAddForm)}
                    className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-white/10 rounded-2xl text-gray-400 text-xs font-black hover:bg-primary-50/50 hover:border-primary-500/50 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    افزودن آدرس جدید
                  </button>
                </div>
              )}

              {/* فرم آدرس جدید */}
              {showAddForm && (
                <div className="mt-4 space-y-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                  <h4 className="font-black text-sm text-gray-900 dark:text-white">آدرس جدید</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input placeholder="نام و نام‌خانوادگی گیرنده *"
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-500 dark:text-white"
                      value={newAddr.receiver} onChange={e => setNewAddr(f => ({ ...f, receiver: e.target.value }))} />
                    <input placeholder="شماره تماس *" dir="ltr"
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-500 dark:text-white"
                      value={newAddr.phone} onChange={e => setNewAddr(f => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
                    <select className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-500 dark:text-white"
                      value={newAddr.province} onChange={e => setNewAddr(f => ({ ...f, province: e.target.value, city: "" }))}>
                      <option value="">انتخاب استان *</option>
                      {PROVINCES.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <select className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-500 dark:text-white disabled:opacity-50"
                      disabled={!newAddr.province} value={newAddr.city} onChange={e => setNewAddr(f => ({ ...f, city: e.target.value }))}>
                      <option value="">انتخاب شهر *</option>
                      {addrCities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <textarea rows={2} placeholder="نشانی دقیق پستی *"
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-500 resize-none dark:text-white"
                    value={newAddr.addressLine} onChange={e => setNewAddr(f => ({ ...f, addressLine: e.target.value }))} />
                  {error && <p className="text-xs text-secondary-500 font-bold">{error}</p>}
                  <div className="flex gap-3">
                    <button onClick={handleSaveAddress} disabled={savingAddr}
                      className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-black text-sm disabled:opacity-60 hover:bg-primary-700 transition-all">
                      {savingAddr ? "ذخیره..." : "ثبت و انتخاب این آدرس"}
                    </button>
                    <button onClick={() => setShowAddForm(false)}
                      className="px-5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 py-3 rounded-xl font-black text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                      انصراف
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── روش ارسال ──────────────────────────────────────── */}
            <div className="bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-primary-600/10 rounded-xl flex items-center justify-center text-primary-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">روش ارسال</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Delivery Method</p>
                </div>
              </div>

              {!selectedAddress ? (
                <div className="text-center py-8 text-gray-400 text-sm font-bold">ابتدا آدرس تحویل را انتخاب کنید</div>
              ) : shippingMethods.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm font-bold">روش ارسالی برای این شهر تعریف نشده</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {shippingMethods.map(m => (
                    <div key={m.id} onClick={() => setSelectedShipping(m)}
                      className={`cursor-pointer p-5 rounded-[2rem] border-2 transition-all ${selectedShipping?.id === m.id ? "border-primary-600 bg-white dark:bg-white/5 shadow-sm" : "border-gray-100 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] hover:border-primary-300"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedShipping?.id === m.id ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-400"} transition-all`}>
                          {m.type === "EXPRESS" ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-sm text-gray-900 dark:text-white">{m.title}</p>
                          {m.description && <p className="text-[10px] text-gray-400 mt-0.5">{m.description}</p>}
                          <p className={`text-xs font-black mt-1 ${Number(m.fee) === 0 ? "text-emerald-500" : "text-primary-600"}`}>
                            {Number(m.fee) === 0 ? "ارسال رایگان" : `${toFa(m.fee)} تومان`}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedShipping?.id === m.id ? "bg-primary-500 border-primary-500" : "border-gray-300"}`}>
                          {selectedShipping?.id === m.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── روش پرداخت ─────────────────────────────────────── */}
            <div className="bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-primary-600/10 rounded-xl flex items-center justify-center text-primary-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">روش پرداخت</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Payment Method</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* پرداخت آنلاین */}
                <div onClick={() => setPaymentMethod("online")}
                  className={`cursor-pointer flex items-center p-6 border-2 rounded-[2rem] transition-all ${paymentMethod === "online" ? "border-primary-600 bg-white dark:bg-white/5 shadow-sm" : "border-gray-100 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] hover:border-primary-300"}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ml-4 transition-all ${paymentMethod === "online" ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" : "bg-gray-100 dark:bg-white/5 text-gray-400"}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-black text-gray-900 dark:text-white">درگاه بانکی (آنلاین)</span>
                    <span className="text-[10px] text-emerald-500 font-black bg-emerald-500/10 px-2 py-0.5 rounded-lg inline-block mt-1">پرداخت امن</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === "online" ? "border-primary-600 bg-primary-600" : "border-gray-200 dark:border-white/10"}`}>
                    {paymentMethod === "online" && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </div>

                {/* کارت به کارت */}
                <div onClick={() => setPaymentMethod("card")}
                  className={`cursor-pointer flex items-center p-6 border-2 rounded-[2rem] transition-all ${paymentMethod === "card" ? "border-primary-600 bg-white dark:bg-white/5 shadow-sm" : "border-gray-100 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] hover:border-primary-300"}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ml-4 transition-all ${paymentMethod === "card" ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" : "bg-gray-100 dark:bg-white/5 text-gray-400"}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-black text-gray-900 dark:text-white">کارت به کارت</span>
                    <span className="text-[10px] text-gray-400 font-bold">ارسال فیش پس از ثبت سفارش</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === "card" ? "border-primary-600 bg-primary-600" : "border-gray-200 dark:border-white/10"}`}>
                    {paymentMethod === "card" && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </div>
              </div>

              {/* اطلاعات کارت به کارت */}
              {paymentMethod === "card" && storeSettings.cardNumber && (
                <div className="mt-6 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <p className="text-xs font-black text-gray-700 dark:text-gray-300">اطلاعات کارت برای انتقال وجه:</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-gray-900 dark:text-white tracking-widest" dir="ltr">{storeSettings.cardNumber}</span>
                    <span className="text-xs text-gray-500">{storeSettings.cardBank}</span>
                  </div>
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-400">{storeSettings.cardHolder}</p>
                  {storeSettings.cardReceiptInfo && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/20 px-3 py-2 rounded-xl">
                      {storeSettings.cardReceiptInfo}
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* ── خلاصه فاکتور ────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="sticky top-8">
              <div className="relative bg-white/20 dark:bg-black/20 backdrop-blur-[60px] border border-white/50 dark:border-white/5 rounded-[3.5rem] p-2 shadow-2xl overflow-hidden">
                <div className="p-8 pb-4 text-center">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">خلاصه فاکتور</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[4px] mt-1">Order Summary</p>
                </div>

                <div className="bg-white/40 dark:bg-white/[0.02] rounded-[3rem] p-8 space-y-6 border border-white/60 dark:border-white/5 shadow-inner">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">قیمت کالاها ({toFa(count)})</span>
                      <div className="flex-1 border-b border-dashed border-gray-300 dark:border-white/10 mx-3 mb-1" />
                      <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{toFa(total + discount)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">سود شما از خرید</span>
                        <div className="flex-1 border-b border-dashed border-gray-300 dark:border-white/10 mx-3 mb-1" />
                        <span className="text-sm font-black text-rose-500 tabular-nums">-{toFa(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">هزینه ارسال</span>
                      <div className="flex-1 border-b border-dashed border-gray-300 dark:border-white/10 mx-3 mb-1" />
                      {shippingFee === 0
                        ? <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg">رایگان</span>
                        : <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{toFa(shippingFee)}</span>
                      }
                    </div>
                  </div>

                  {/* کیف پول */}
                  {storeSettings.walletEnabled && walletBalanceNum > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setUseWallet(!useWallet)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${useWallet ? "bg-primary-600" : "bg-gray-200 dark:bg-white/10"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useWallet ? "-translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">استفاده از کیف پول</span>
                        </div>
                        <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-2 py-0.5 rounded-lg">
                          {toFa(walletBalanceNum)} تومان
                        </span>
                      </div>
                      {useWallet && walletDiscount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">تخفیف کیف پول</span>
                          <div className="flex-1 border-b border-dashed border-gray-300 dark:border-white/10 mx-3 mb-1" />
                          <span className="text-sm font-black text-primary-600 dark:text-primary-400 tabular-nums">-{toFa(walletDiscount)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent" />

                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-[5px]">Net Payable</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums">{toFa(grandTotal)}</span>
                      <span className="text-[10px] font-bold text-gray-400">تومان</span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <button onClick={handleSubmit} disabled={submitting || !selectedAddress || !selectedShipping }
                    className="group/pay relative w-full h-20 bg-primary-600 dark:bg-primary-500 rounded-[2.2rem] overflow-hidden transition-all duration-500 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_25px_50px_-12px_rgba(37,99,235,0.7)] hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                    <div className="relative flex items-center justify-between px-8">
                      <span className="text-white font-black text-xl tracking-tight">
                        {submitting ? "در حال ثبت..." : "تأیید و پرداخت"}
                      </span>
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 shadow-inner">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </div>
                  </button>
                  <p className="text-[9px] text-center text-gray-400 font-bold mt-4 leading-relaxed px-4">
                    با ثبت سفارش، قوانین و مقررات فروشگاه را می‌پذیرم.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}