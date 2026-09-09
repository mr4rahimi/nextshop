"use client";

/**
 * تنظیم قواعد تکرارشونده.
 *
 * همان چیزی که خواسته شده بود: مدیر تعیین می‌کند به مشتریان ثابت هر چند وقت
 * یک‌بار تماس گرفته شود، سقف روزانه چند تاست، و کدام کارمند مسئولش است.
 * هیچ‌کدام در کد نیست.
 */

import { useCallback, useEffect, useState } from "react";
import HelpButton from "./HelpButton";
import { DOMAIN_LABELS, formatDateTime } from "@/lib/worklist/types";
import type { StaffDomain } from "@/lib/worklist/types";
import type { TaskTypeLite, StaffMember } from "./types";

type Schedule = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOMER_IDLE";

const SCHEDULE_LABELS: Record<Schedule, string> = {
  DAILY: "هر روز",
  WEEKLY: "روزهای هفته",
  MONTHLY: "ماهانه",
  CUSTOMER_IDLE: "مشتری راکد",
};

const WEEKDAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

interface Rule {
  id: string;
  typeId: string;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  schedule: Schedule;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  timeOfDay: string | null;
  idleDays: number | null;
  maxPerRun: number;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunCount: number;
  type: { id: string; title: string; icon: string | null; domain: StaffDomain };
}

const EMPTY = {
  typeId: "",
  title: "",
  ownerId: "",
  schedule: "DAILY" as Schedule,
  daysOfWeek: [] as number[],
  dayOfMonth: 1,
  timeOfDay: "09:00",
  idleDays: 90,
  maxPerRun: 20,
};

export default function RulesClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [types, setTypes] = useState<TaskTypeLite[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetch("/api/admin/worklist/rules").then((r) => (r.ok ? r.json() : { rules: [] })),
      fetch("/api/admin/worklist/task-types").then((r) => (r.ok ? r.json() : { types: [] })),
      fetch("/api/admin/worklist/staff").then((r) => (r.ok ? r.json() : { staff: [] })),
    ])
      .then(([a, b, c]) => {
        if (ignore) return;
        setRules(a.rules ?? []);
        setTypes(b.types ?? []);
        setStaff(c.staff ?? []);
      })
      .catch(() => {
        if (!ignore) setError("بارگذاری ناموفق بود");
      });
    return () => { ignore = true; };
  }, [reloadKey]);

  async function save() {
    if (!draft.typeId || !draft.title.trim() || !draft.ownerId) {
      setError("نوع کار، عنوان و مسئول را کامل کنید");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklist/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره ناموفق بود");
      setDraft({ ...EMPTY });
      setFormOpen(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(rule: Rule) {
    setBusy(true);
    await fetch(`/api/admin/worklist/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    setBusy(false);
    reload();
  }

  async function remove(rule: Rule) {
    if (!confirm(`قاعده‌ی «${rule.title}» حذف شود؟ کارهای ساخته‌شده باقی می‌مانند.`)) return;
    setBusy(true);
    await fetch(`/api/admin/worklist/rules/${rule.id}`, { method: "DELETE" });
    setBusy(false);
    reload();
  }

  async function runNow() {
    setBusy(true);
    setRunMsg(null);
    try {
      const res = await fetch("/api/admin/worklist/rules/run", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "اجرا ناموفق بود");
      setRunMsg(
        d.created > 0
          ? `${d.created.toLocaleString("fa-IR")} کار تازه ساخته شد.`
          : "کار تازه‌ای لازم نبود؛ همه‌چیز از قبل ساخته شده بود.",
      );
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "اجرا ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  const selectedType = types.find((t) => t.id === draft.typeId);
  const fa = (n: number) => n.toLocaleString("fa-IR");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition"
        >
          {formOpen ? "بستن فرم" : "قاعده‌ی تازه"}
        </button>
        <button
          onClick={runNow}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-xs font-bold transition"
        >
          اجرای همین حالا
        </button>
        <span className="text-[11px] text-gray-500">
          زمان‌بند خودش هر ده دقیقه اجرا می‌شود
        </span>
      </div>

      {runMsg && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {runMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* فرم */}
      {formOpen && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                نوع کار
              </label>
              <select
                value={draft.typeId}
                onChange={(e) => {
                  const t = types.find((x) => x.id === e.target.value);
                  setDraft((d) => ({
                    ...d,
                    typeId: e.target.value,
                    title: d.title || (t?.title ?? ""),
                    schedule: t?.slug === "regular-customer-call" ? "CUSTOMER_IDLE" : d.schedule,
                  }));
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
              >
                <option value="">انتخاب کنید</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {DOMAIN_LABELS[t.domain]} — {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                مسئول
              </label>
              <select
                value={draft.ownerId}
                onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
              >
                <option value="">انتخاب کنید</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.roleTitle ? ` — ${s.roleTitle}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                عنوانی که در کارتابل دیده می‌شود
              </label>
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="مثلاً: قیمت‌گذاری روزانه‌ی سایت"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                تکرار
              </label>
              <select
                value={draft.schedule}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, schedule: e.target.value as Schedule }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
              >
                {(Object.keys(SCHEDULE_LABELS) as Schedule[]).map((s) => (
                  <option key={s} value={s}>
                    {SCHEDULE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {draft.schedule !== "CUSTOMER_IDLE" && (
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                  ساعت پیشنهادی
                </label>
                <input
                  value={draft.timeOfDay}
                  onChange={(e) => setDraft((d) => ({ ...d, timeOfDay: e.target.value }))}
                  dir="ltr"
                  placeholder="09:00"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                />
              </div>
            )}

            {draft.schedule === "WEEKLY" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                  روزهای هفته
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          daysOfWeek: d.daysOfWeek.includes(i)
                            ? d.daysOfWeek.filter((x) => x !== i)
                            : [...d.daysOfWeek, i],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                        draft.daysOfWeek.includes(i)
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {draft.schedule === "MONTHLY" && (
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                  روز ماه
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={draft.dayOfMonth}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dayOfMonth: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                />
              </div>
            )}

            {draft.schedule === "CUSTOMER_IDLE" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                    چند روز از آخرین خرید گذشته باشد
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={draft.idleDays}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, idleDays: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">
                    همین عدد فاصله‌ی محافظ هم هست: مشتری‌ای که در این بازه با او تماس
                    گرفته شده دوباره انتخاب نمی‌شود.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                    سقف در هر اجرا
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.maxPerRun}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, maxPerRun: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">
                    قدیمی‌ترین خریدها اول انتخاب می‌شوند، بقیه اجرای بعدی.
                  </p>
                </div>
              </>
            )}
          </div>

          {selectedType?.slaMinutes && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              این نوع کار مهلت خودکار {fa(Math.round(selectedType.slaMinutes / 60))} ساعته
              دارد و ساعت پیشنهادی نادیده گرفته می‌شود.
            </p>
          )}

          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold transition"
          >
            {busy ? "در حال ذخیره..." : "ذخیره‌ی قاعده"}
          </button>
        </div>
      )}

      {/* فهرست قواعد */}
      {rules.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            هنوز قاعده‌ای تعریف نشده
          </p>
          <p className="text-xs text-gray-400 mt-1">
            کارهای تکراری روزانه را اینجا تعریف کنید تا خودشان در کارتابل بیایند.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 ${
                r.isActive
                  ? "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                  : "border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{r.type.icon ?? "•"}</span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {r.title}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-white/5 text-gray-500">
                      {SCHEDULE_LABELS[r.schedule]}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5 flex-wrap text-[11px] text-gray-500">
                    <span>مسئول: {r.ownerName ?? "—"}</span>
                    {r.schedule === "WEEKLY" && r.daysOfWeek.length > 0 && (
                      <span>{r.daysOfWeek.map((d) => WEEKDAYS[d]).join("، ")}</span>
                    )}
                    {r.schedule === "MONTHLY" && r.dayOfMonth && (
                      <span>روز {fa(r.dayOfMonth)} ماه</span>
                    )}
                    {r.schedule === "CUSTOMER_IDLE" && r.idleDays && (
                      <span>
                        بیش از {fa(r.idleDays)} روز · سقف {fa(r.maxPerRun)}
                      </span>
                    )}
                    {r.timeOfDay && <span dir="ltr">{r.timeOfDay}</span>}
                  </div>
                  {r.lastRunAt && (
                    <p className="mt-1.5 text-[10px] text-gray-400">
                      آخرین اجرا {formatDateTime(r.lastRunAt)} · {fa(r.lastRunCount)} کار
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => toggle(r)}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-[11px] font-bold text-gray-700 dark:text-gray-300 transition"
                  >
                    {r.isActive ? "غیرفعال" : "فعال"}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-40 text-[11px] font-bold text-red-600 dark:text-red-400 transition"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2">
        <HelpButton topic="rules" />
      </div>
    </div>
  );
}
