"use client";

import { useEffect, useState } from "react";
import { getMvpUserId } from "@/lib/mvpUser";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const userId = getMvpUserId();
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/orders?userId=${userId}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const userId = typeof window !== "undefined" ? getMvpUserId() : null;

  if (!userId) return <div className="p-6">برای MVP اول برو: /account/mvp-login</div>;
  if (loading) return <div className="p-6">در حال بارگذاری...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-3">
      <h1 className="text-xl font-bold">سفارشات من</h1>
      {orders.length === 0 ? (
        <div>سفارشی ثبت نشده.</div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="border rounded p-3">
            <div className="flex justify-between">
              <div className="font-semibold">{o.orderNumber}</div>
              <div className="text-sm">{o.status}</div>
            </div>
            <div className="text-sm opacity-70 mt-1">
              مبلغ: {Number(o.grandTotal).toLocaleString("fa-IR")} تومان — آیتم‌ها: {o.items.length}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
