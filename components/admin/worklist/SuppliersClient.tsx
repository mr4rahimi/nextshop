"use client";

/**
 * مدیریت تأمین‌کننده‌ها — افزودن کامل، ویرایش و غیرفعال‌کردن.
 *
 * حذف ندارد: کارهای قدیمی به تأمین‌کننده ارجاع دارند. غیرفعال فقط از
 * انتخابگر فرم کار بیرون می‌رود.
 */

import { useCallback, useEffect, useState } from "react";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  city: string | null;
  note: string | null;
  isActive: boolean;
  createdByName: string | null;
  _count: { tasks: number };
}

const EMPTY = { name: "", contactName: "", phone: "", city: "", note: "" };

const inputCls =
  "w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400";

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

export default function SuppliersClient() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [can, setCan] = useState({ create: false, manage: false });
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ q: q.trim(), take: "500" });
    if (showInactive) p.set("all", "1");
    fetch(`/api/admin/worklist/suppliers?${p}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setItems(d.suppliers);
        setCan(d.can);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => setLoading(false));
  }, [q, showInactive]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function submit() {
    if (!form.name.trim()) {
      setError("نام تأمین‌کننده لازم است");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editingId ? `/api/admin/worklist/suppliers/${editingId}` : "/api/admin/worklist/suppliers",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");
      if (d.existed) setError(`«${d.supplier.name}» از قبل در فهرست بود`);
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Supplier) {
    const res = await fetch(`/api/admin/worklist/suppliers/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (!res.ok) setError("تغییر وضعیت ناموفق بود");
    load();
  }

  return (
    <div className="space-y-4">
      {(can.create || can.manage) && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-4 space-y-3">
          <h2 className="text-xs font-black text-gray-900 dark:text-white">
            {editingId ? "ویرایش تأمین‌کننده" : "تأمین‌کننده‌ی تازه"}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input className={inputCls} placeholder="نام *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inputCls} placeholder="نام رابط" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            <input className={inputCls} placeholder="شماره تماس" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={inputCls} placeholder="شهر" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="یادداشت (کالاها، شرایط پرداخت…)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
            >
              {saving ? "در حال ذخیره..." : editingId ? "ذخیره‌ی تغییرات" : "افزودن"}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300"
              >
                انصراف
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو با نام، رابط یا شماره..."
          className={`${inputCls} max-w-sm`}
        />
        {can.manage && (
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-blue-500" />
            نمایش غیرفعال‌ها
          </label>
        )}
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-xs text-gray-500">در حال بارگذاری...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-xs text-gray-500">تأمین‌کننده‌ای پیدا نشد</p>
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
              <tr>
                <th className="px-4 py-2.5">نام</th>
                <th className="px-3 py-2.5">رابط</th>
                <th className="px-3 py-2.5">شماره</th>
                <th className="px-3 py-2.5">شهر</th>
                <th className="px-3 py-2.5 text-center">کارها</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {items.map((s) => (
                <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-gray-900 dark:text-white">{s.name}</p>
                    {s.note && <p className="text-[11px] text-gray-400 line-clamp-1">{s.note}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{s.contactName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{s.city ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{fa(s._count.tasks)}</td>
                  <td className="px-4 py-2.5">
                    {can.manage && (
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => {
                            setEditingId(s.id);
                            setForm({
                              name: s.name,
                              contactName: s.contactName ?? "",
                              phone: s.phone ?? "",
                              city: s.city ?? "",
                              note: s.note ?? "",
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white"
                        >
                          ویرایش
                        </button>
                        <button
                          onClick={() => toggleActive(s)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300 hover:bg-amber-500 hover:text-white"
                        >
                          {s.isActive ? "غیرفعال" : "فعال"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
