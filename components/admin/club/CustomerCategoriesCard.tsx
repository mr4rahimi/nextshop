"use client";

/**
 * مدیریت دسته‌های مشتری در تنظیمات باشگاه.
 *
 * بخش ۱۹ مستندات، سؤال ۷: سه دسته‌ی ارگانی، تهران و شهرستان فعلاً کافی‌اند،
 * ولی مدیر باید بتواند اضافه کند. کارت برای کسی که مجوز ندارد رندر نمی‌شود.
 */

import { useCallback, useEffect, useState } from "react";

interface Category {
  id: string;
  title: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { profiles: number };
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

export default function CustomerCategoriesCard() {
  const [items, setItems] = useState<Category[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/club/categories?all=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.can?.manage) setItems(d.categories);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function patch(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/club/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) setError((await res.json()).error ?? "ذخیره نشد");
    load();
  }

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/club/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, color: COLORS[(items?.length ?? 0) % COLORS.length] }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "ساخت دسته ناموفق بود");
      return;
    }
    setTitle("");
    load();
  }

  if (!items) return null;

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-black text-gray-900 dark:text-white">دسته‌های مشتری</h2>
        <p className="text-[11px] text-gray-500 mt-1">
          هر مشتری در یک دسته است، مثل ارگانی، تهران یا شهرستان. با سطح باشگاه فرق دارد: سطح با خرید به دست می‌آید، دسته را شما تعیین می‌کنید.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className={`flex flex-wrap items-center gap-2 ${c.isActive ? "" : "opacity-50"}`}>
            <input
              type="color"
              value={c.color ?? "#6b7280"}
              onChange={(e) => patch(c.id, { color: e.target.value })}
              className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent cursor-pointer"
              aria-label="رنگ دسته"
            />
            <input
              defaultValue={c.title}
              onBlur={(e) => e.target.value.trim() !== c.title && patch(c.id, { title: e.target.value })}
              className="flex-1 min-w-[140px] px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-primary-500 dark:text-white"
            />
            <span className="text-[11px] font-bold text-gray-400 w-20 text-center">
              {c._count.profiles.toLocaleString("fa-IR")} مشتری
            </span>
            <button
              onClick={() => patch(c.id, { isActive: !c.isActive })}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[11px] font-black text-gray-600 dark:text-gray-300"
            >
              {c.isActive ? "غیرفعال" : "فعال"}
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400">هنوز دسته‌ای ساخته نشده است</p>}
      </div>

      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="دسته‌ی تازه، مثلاً «همکاران»"
          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-primary-500 dark:text-white"
        />
        <button
          onClick={add}
          disabled={busy || !title.trim()}
          className="px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-black disabled:opacity-40"
        >
          افزودن
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </section>
  );
}
