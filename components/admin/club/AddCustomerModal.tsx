"use client";

/**
 * فرم سه‌فیلدی افزودن مشتری: شماره، نام، دسته — نه بیشتر (بخش ۲۱.۵).
 *
 * مشتری به نام کسی ثبت می‌شود که فرم را پر کرده. اگر شماره مال همکار دیگری
 * باشد، پیام نام صاحب را می‌گوید تا با او هماهنگ شود.
 */

import { useState } from "react";

interface Props {
  categories: { id: string; title?: string }[];
  onClose: () => void;
  onAdded: () => void;
}

const inputCls =
  "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-primary-500 dark:text-white";

export default function AddCustomerModal({ categories, onClose, onAdded }: Props) {
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/club/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, firstName, lastName, categoryId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ثبت نشد");
      if (d.alreadyMine) {
        setInfo("این مشتری از قبل در فهرست شماست");
        return;
      }
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت نشد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-700 p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">افزودن مشتری</h3>
            <p className="text-[11px] text-gray-400 mt-1">در فهرست مشتریان شما ثبت می‌شود</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400">
            ✕
          </button>
        </div>

        <input
          autoFocus
          required
          inputMode="tel"
          dir="ltr"
          placeholder="09xxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={`${inputCls} text-center`}
        />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="نام" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
          <input placeholder="نام خانوادگی" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </div>
        {categories.length > 0 && (
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">دسته (اختیاری)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}

        {error && <p className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-xs font-bold text-center">{error}</p>}
        {info && <p className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl text-xs font-bold text-center">{info}</p>}

        <button
          type="submit"
          disabled={saving || !phone.trim()}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : "ثبت مشتری"}
        </button>
      </form>
    </div>
  );
}
