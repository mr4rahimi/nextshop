"use client";

/**
 * الگوهای کار دوره‌ای سئو.
 *
 * ⚠️ این صفحه **کار نمی‌سازد**؛ فقط الگو را تعریف می‌کند. ساختِ کار با
 * زمان‌بند است (هر ده دقیقه) و همین باعث می‌شود «اجرای بعدی» عددی باشد که
 * کاربر باید ببیند — وگرنه فکر می‌کند دکمه‌ای را نزده است.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵.۶
 */

import { useCallback, useEffect, useState } from "react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { formatJalaliShort } from "@/lib/club/jalali";
import { PRIORITY_LABELS, type StaffPriority } from "@/lib/worklist/types";

interface Category {
  id: string;
  title: string;
}

interface Staff {
  id: string;
  name: string;
  isMe: boolean;
}

interface Rule {
  id: string;
  title: string;
  categoryId: string;
  description: string | null;
  pageUrls: string | null;
  assigneeId: string | null;
  assigneeName: string;
  priority: StaffPriority;
  checklist: unknown;
  unit: "WEEK" | "MONTH";
  intervalCount: number;
  dueOffsetDays: number | null;
  reviewOffsetDays: number | null;
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  category: { id: string; title: string };
  _count: { tasks: number };
}

const inputCls =
  "w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400";

const EMPTY = {
  title: "",
  categoryId: "",
  description: "",
  pageUrls: "",
  assigneeId: "",
  priority: "NORMAL" as StaffPriority,
  unit: "MONTH" as "WEEK" | "MONTH",
  intervalCount: "1",
  dueOffsetDays: "",
  reviewOffsetDays: "",
  firstRunAt: "",
  checklist: "",
};

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

function parseChecklist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/** «هر ۲ ماه» / «هر هفته» */
function everyLabel(unit: "WEEK" | "MONTH", count: number): string {
  const u = unit === "WEEK" ? "هفته" : "ماه";
  return count === 1 ? `هر ${u}` : `هر ${fa(count)} ${u}`;
}

export default function SeoRecurringPanel({
  categories,
  staff,
  canManage,
}: {
  categories: Category[];
  staff: Staff[];
  canManage: boolean;
}) {
  const [items, setItems] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/worklist/seo/recurring")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setItems(d.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function submit() {
    if (!form.title.trim()) return setError("عنوان الگو لازم است");
    if (!form.categoryId) return setError("دسته را انتخاب کنید");
    if (!form.assigneeId) return setError("مسئول الگو لازم است");

    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        intervalCount: Number(form.intervalCount) || 1,
        dueOffsetDays: form.dueOffsetDays === "" ? null : Number(form.dueOffsetDays),
        reviewOffsetDays:
          form.reviewOffsetDays === "" ? null : Number(form.reviewOffsetDays),
        firstRunAt: form.firstRunAt || null,
        checklist: form.checklist
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      };
      const res = await fetch(
        editingId
          ? `/api/admin/worklist/seo/recurring/${editingId}`
          : "/api/admin/worklist/seo/recurring",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingId ? { ...body, nextRunAt: form.firstRunAt || null } : body,
          ),
        },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");
      setForm(EMPTY);
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: Rule) {
    await fetch(`/api/admin/worklist/seo/recurring/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    load();
  }

  async function remove(rule: Rule) {
    if (!confirm(`الگوی «${rule.title}» حذف شود؟ کارهای ساخته‌شده‌اش می‌مانند.`)) return;
    await fetch(`/api/admin/worklist/seo/recurring/${rule.id}`, { method: "DELETE" });
    load();
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setShowForm(true);
    setForm({
      title: rule.title,
      categoryId: rule.categoryId,
      description: rule.description ?? "",
      pageUrls: rule.pageUrls ?? "",
      assigneeId: rule.assigneeId ?? "",
      priority: rule.priority,
      unit: rule.unit,
      intervalCount: String(rule.intervalCount),
      dueOffsetDays: rule.dueOffsetDays === null ? "" : String(rule.dueOffsetDays),
      reviewOffsetDays:
        rule.reviewOffsetDays === null ? "" : String(rule.reviewOffsetDays),
      firstRunAt: "",
      checklist: parseChecklist(rule.checklist).join("\n"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3">
        <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
          کارهای تکرارشونده مثل «بررسی ماهانه‌ی خطاهای سرچ‌کنسول» را اینجا یک‌بار تعریف
          کنید. سیستم خودش در موعد، کار را می‌سازد و به مسئولش اعلان می‌دهد.
          <br />
          <b>«هر ماه» یعنی ماه شمسی.</b> اگر نوبتی رد شود، فقط یک کار ساخته می‌شود نه چند
          تا — و تا کارِ قبلیِ همان الگو باز باشد، کار تازه‌ای ساخته نمی‌شود.
        </p>
      </div>

      {canManage && (
        <button
          onClick={() => {
            setShowForm((s) => !s);
            if (showForm) {
              setEditingId(null);
              setForm(EMPTY);
            }
          }}
          className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold"
        >
          {showForm ? "بستن فرم" : "الگوی تازه"}
        </button>
      )}

      {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}

      {showForm && canManage && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-4 space-y-3">
          <h2 className="text-xs font-black text-gray-900 dark:text-white">
            {editingId ? "ویرایش الگو" : "الگوی دوره‌ای تازه"}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input
              className={inputCls}
              placeholder="عنوان کار *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              className={inputCls}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">دسته *</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
            >
              <option value="">مسئول *</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMe ? " (خودم)" : ""}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as StaffPriority })
              }
            >
              {(Object.keys(PRIORITY_LABELS) as StaffPriority[]).map((p) => (
                <option key={p} value={p}>
                  اولویت: {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">هر چند وقت</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={form.intervalCount}
                  onChange={(e) => setForm({ ...form, intervalCount: e.target.value })}
                />
                <select
                  className={inputCls}
                  value={form.unit}
                  onChange={(e) =>
                    setForm({ ...form, unit: e.target.value as "WEEK" | "MONTH" })
                  }
                >
                  <option value="MONTH">ماه شمسی</option>
                  <option value="WEEK">هفته</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">
                {editingId ? "اجرای بعدی (خالی = دست‌نخورده)" : "اولین اجرا"}
              </label>
              <JalaliDatePicker
                value={form.firstRunAt}
                onChange={(v) => setForm({ ...form, firstRunAt: v })}
                mode="datetime"
                placeholder={editingId ? "بدون تغییر" : "یک دوره بعد"}
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">
                مهلت: چند روز بعد از ساخت
              </label>
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="بدون مهلت"
                value={form.dueOffsetDays}
                onChange={(e) => setForm({ ...form, dueOffsetDays: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">
                بررسی نتیجه: چند روز بعد
              </label>
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="بدون بررسی"
                value={form.reviewOffsetDays}
                onChange={(e) => setForm({ ...form, reviewOffsetDays: e.target.value })}
              />
            </div>
          </div>

          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="شرح کار"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <textarea
            className={`${inputCls} resize-none`}
            dir="ltr"
            rows={2}
            placeholder="آدرس صفحه‌های مربوط — هر خط یک آدرس"
            value={form.pageUrls}
            onChange={(e) => setForm({ ...form, pageUrls: e.target.value })}
          />
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="چک‌لیست — هر خط یک بند"
            value={form.checklist}
            onChange={(e) => setForm({ ...form, checklist: e.target.value })}
          />

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
            >
              {saving ? "در حال ذخیره..." : editingId ? "ذخیره‌ی تغییرات" : "ساخت الگو"}
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

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-xs text-gray-500">در حال بارگذاری...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-xs text-gray-500">
            هنوز الگوی دوره‌ای تعریف نشده است
          </p>
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
              <tr>
                <th className="px-4 py-2.5">عنوان</th>
                <th className="px-3 py-2.5">دسته</th>
                <th className="px-3 py-2.5">مسئول</th>
                <th className="px-3 py-2.5">تکرار</th>
                <th className="px-3 py-2.5">اجرای بعدی</th>
                <th className="px-3 py-2.5 text-center">ساخته</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {items.map((r) => (
                <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-gray-900 dark:text-white">{r.title}</p>
                    {r.description && (
                      <p className="text-[11px] text-gray-400 line-clamp-1">
                        {r.description}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {r.category.title}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {r.assigneeName}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {everyLabel(r.unit, r.intervalCount)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {r.isActive ? formatJalaliShort(new Date(r.nextRunAt)) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">
                    {fa(r._count.tasks)}
                  </td>
                  <td className="px-4 py-2.5">
                    {canManage && (
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => startEdit(r)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white"
                        >
                          ویرایش
                        </button>
                        <button
                          onClick={() => toggle(r)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300 hover:bg-amber-500 hover:text-white"
                        >
                          {r.isActive ? "غیرفعال" : "فعال"}
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300 hover:bg-red-500 hover:text-white"
                        >
                          حذف
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
