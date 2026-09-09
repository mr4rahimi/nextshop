"use client";

/**
 * تقویم ماهانه‌ی حضور.
 *
 * سه چیز که عمداً این‌طور است:
 *
 * **۱. عنوان «حضور در سیستم» است نه «ساعت کاری».** این عدد فقط می‌گوید پنل
 * چقدر باز بوده. جعبه‌ی محدودیت‌ها بالای صفحه بسته نمی‌شود و هیچ‌وقت نباید
 * حذف شود؛ عددی که محدودیتش نوشته نشده، فردا مبنای قضاوت می‌شود.
 *
 * **۲. تقویم شمسی است و همه‌ی روزهای ماه را نشان می‌دهد.** خانه‌ی خالی هم
 * اطلاعات است — غیبت باید دیده شود، نه اینکه ردیفش نباشد.
 *
 * **۳. اصلاح دستی رد پا می‌گذارد.** نامِ اصلاح‌کننده کنار همان روز می‌ماند و
 * دکمه‌ی «بازسازی» همیشه راهِ برگشت به عددِ محاسبه‌شده است.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMinutes, formatHoursShort, formatTimeTehran } from "@/lib/worklist/types";
import { JALALI_MONTH_OPTIONS, jalaliMonthName } from "@/lib/club/jalali";
import type { AttendanceDay, AttendanceResponse } from "./types";

const WEEKDAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

function fa(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export default function AttendanceClient({
  initialYear,
  initialMonth,
}: {
  initialYear: number;
  initialMonth: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AttendanceDay | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      const q = new URLSearchParams({ year: String(year), month: String(month) });
      if (userId) q.set("userId", userId);
      try {
        const res = await fetch(`/api/admin/worklist/attendance?${q}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "بارگذاری ناموفق بود");
        if (ignore) return;
        setData(body as AttendanceResponse);
        setError(null);
        // خانه‌ی بازِ ماه قبل نباید روی ماه تازه بماند
        setSelected((cur) =>
          cur ? (body as AttendanceResponse).days.find((d) => d.key === cur.key) ?? null : null,
        );
      } catch (e) {
        if (!ignore) setError((e as Error).message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [year, month, userId, reloadKey]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  // خانه‌های خالیِ ابتدای ماه تا روز اول سرِ ستون درستش بنشیند
  const leading = data?.days.length ? data.days[0].weekday : 0;
  const cells = useMemo(() => {
    if (!data) return [];
    return [...Array.from({ length: leading }, () => null), ...data.days];
  }, [data, leading]);

  return (
    <div className="space-y-5">
      {/* ── محدودیت‌ها: بسته نمی‌شود ───────────────────────────── */}
      <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3">
        <p className="text-xs font-black text-amber-800 dark:text-amber-300">
          این عدد «حضور در سیستم» است، نه ساعت کار
        </p>
        <ul className="mt-1.5 space-y-1 text-[11px] text-amber-800/80 dark:text-amber-200/70 leading-6">
          <li>· کاری که بیرون از پنل انجام می‌شود اینجا شمرده نمی‌شود.</li>
          <li>· پنلِ باز روی میز هم حاضر حساب می‌شود، حتی اگر کسی پایش نباشد.</li>
          <li>
            · بیشتر از {data ? fa(Math.round(data.capMin / 60)) : "۱۰"} ساعت در روز ثبت
            نمی‌شود؛ عددِ بزرگ‌تر یعنی خروج زده نشده.
          </li>
        </ul>
      </div>

      {/* ── نوار ماه و کارمند ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => shiftMonth(-1)}
          className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 transition"
        >
          ماه قبل
        </button>

        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-900 dark:text-white"
        >
          {JALALI_MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.title}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value) || year)}
          className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-900 dark:text-white text-center"
        />

        <button
          onClick={() => shiftMonth(1)}
          className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 transition"
        >
          ماه بعد
        </button>

        {data?.can.viewAll && data.staff.length > 0 && (
          <select
            value={data.userId}
            onChange={(e) => setUserId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-900 dark:text-white"
          >
            {data.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isMe ? " (خودم)" : ""}
              </option>
            ))}
          </select>
        )}

        {data?.can.edit && (
          <button
            onClick={async () => {
              await fetch("/api/admin/worklist/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: data.userId, year, month }),
              });
              reload();
            }}
            className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-bold text-gray-600 dark:text-gray-400 transition"
            title="روزهای اصلاح‌شده‌ی دستی دست‌نخورده می‌مانند"
          >
            بازسازی ماه
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* ── جمع ماه ───────────────────────────────────────────── */}
      {data && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryCard
            label={`جمع ${jalaliMonthName(data.month)}`}
            value={formatMinutes(data.totals.activeMin)}
          />
          <SummaryCard
            label="روزهای حاضر"
            value={
              data.totals.presentDays > 0 ? `${fa(data.totals.presentDays)} روز` : "—"
            }
          />
          <SummaryCard
            label="میانگین روزهای حاضر"
            value={
              data.totals.presentDays > 0
                ? formatMinutes(
                    Math.round(data.totals.activeMin / data.totals.presentDays),
                  )
                : "—"
            }
          />
        </div>
      )}

      {/* ── تقویم ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[10px] font-bold text-gray-400 dark:text-gray-500 py-1"
            >
              {w}
            </div>
          ))}
        </div>

        {loading && !data ? (
          <p className="text-xs text-gray-500 py-8 text-center">در حال بارگذاری...</p>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((day, i) =>
              day === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <DayCell
                  key={day.key}
                  day={day}
                  capMin={data?.capMin ?? 600}
                  isSelected={selected?.key === day.key}
                  onSelect={() => setSelected(selected?.key === day.key ? null : day)}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* ── جزئیات و اصلاح روز ─────────────────────────────────── */}
      {selected && data && (
        <DayDetail
          day={selected}
          userId={data.userId}
          canEdit={data.can.edit}
          onClose={() => setSelected(null)}
          onSaved={reload}
        />
      )}

      {/* ── جمعِ همه‌ی کارکنان ─────────────────────────────────── */}
      {data?.can.viewAll && data.staff.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <h2 className="text-xs font-black text-gray-900 dark:text-white">
              حضور تیم در {jalaliMonthName(data.month)} {fa(data.year)}
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {data.staff.map((s) => (
              <button
                key={s.id}
                onClick={() => setUserId(s.id)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-right transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                  s.id === data.userId ? "bg-blue-50/60 dark:bg-blue-500/10" : ""
                }`}
              >
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {s.name}
                  {s.isMe && (
                    <span className="text-[10px] text-gray-400 font-normal mr-1">
                      (خودم)
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-gray-500">
                    {s.presentDays > 0 ? `${fa(s.presentDays)} روز` : "—"}
                  </span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">
                    {formatMinutes(s.activeMin)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 px-4 py-3">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{value}</p>
    </div>
  );
}

function DayCell({
  day,
  capMin,
  isSelected,
  onSelect,
}: {
  day: AttendanceDay;
  capMin: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isHoliday = day.weekday === 6; // جمعه
  const present = day.activeMin > 0;
  const atCap = present && day.activeMin >= capMin;

  return (
    <button
      onClick={onSelect}
      disabled={day.isFuture}
      className={[
        "aspect-square rounded-xl border flex flex-col items-center justify-center gap-0.5 transition",
        isSelected
          ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-300 dark:ring-blue-500/40"
          : "border-gray-100 dark:border-white/5",
        day.isFuture
          ? "opacity-30 cursor-default"
          : "hover:border-gray-300 dark:hover:border-white/20",
        present
          ? "bg-emerald-50/70 dark:bg-emerald-500/10"
          : isHoliday
            ? "bg-gray-50 dark:bg-white/[0.02]"
            : "",
      ].join(" ")}
    >
      <span
        className={`text-[11px] font-bold ${
          isHoliday ? "text-red-500 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {fa(day.jd)}
      </span>
      <span
        className={`text-[10px] font-black ${
          atCap
            ? "text-amber-600 dark:text-amber-400"
            : present
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-gray-300 dark:text-gray-600"
        }`}
        dir="ltr"
      >
        {formatHoursShort(day.activeMin)}
      </span>
      {day.editedByName && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-violet-500"
          title={`اصلاح دستی: ${day.editedByName}`}
        />
      )}
    </button>
  );
}

function DayDetail({
  day,
  userId,
  canEdit,
  onClose,
  onSaved,
}: {
  day: AttendanceDay;
  userId: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [hours, setHours] = useState(Math.floor(day.activeMin / 60));
  const [minutes, setMinutes] = useState(day.activeMin % 60);
  const [note, setNote] = useState(day.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // انتخابِ روزِ دیگر باید فرم را از نو پر کند، نه اینکه عدد روز قبلی بماند
  useEffect(() => {
    setHours(Math.floor(day.activeMin / 60));
    setMinutes(day.activeMin % 60);
    setNote(day.note ?? "");
    setErr(null);
  }, [day.key, day.activeMin, day.note]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/worklist/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date: day.key, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "ذخیره نشد");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-500/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50/60 dark:bg-blue-500/10 border-b border-blue-100 dark:border-blue-500/20">
        <h3 className="text-xs font-black text-gray-900 dark:text-white">
          {fa(day.jd)} {jalaliMonthName(day.jm)} {fa(day.jy)}
        </h3>
        <button
          onClick={onClose}
          className="text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          بستن
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Fact label="اولین ورود" value={formatTimeTehran(day.firstIn)} />
          <Fact label="آخرین فعالیت" value={formatTimeTehran(day.lastOut)} />
          <Fact label="حضور در سیستم" value={formatMinutes(day.activeMin)} />
          <Fact label="از ورود تا خروج" value={formatMinutes(day.grossMin)} />
        </div>

        {day.editedByName && (
          <p className="text-[11px] text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 rounded-xl px-3 py-2">
            این روز را {day.editedByName} دستی اصلاح کرده است.
            {day.note && <span className="block mt-0.5 text-gray-600 dark:text-gray-400">{day.note}</span>}
          </p>
        )}

        {canEdit ? (
          <div className="space-y-3 pt-1 border-t border-gray-100 dark:border-white/5">
            <p className="text-[11px] text-gray-500 pt-3">
              اگر این عدد با واقعیت نمی‌خواند، اصلاحش کنید و دلیلش را بنویسید. عددِ
              محاسبه‌شده هیچ‌وقت پاک نمی‌شود و با «بازسازی» برمی‌گردد.
            </p>

            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="block text-[10px] text-gray-500 mb-1">ساعت</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                  className="w-20 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-bold text-center text-gray-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] text-gray-500 mb-1">دقیقه</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                  }
                  className="w-20 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-bold text-center text-gray-900 dark:text-white"
                />
              </label>
              <label className="block flex-1 min-w-[180px]">
                <span className="block text-[10px] text-gray-500 mb-1">دلیل اصلاح</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثلاً: تمام روز بیرون از دفتر، هماهنگی ارسال"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white"
                />
              </label>
            </div>

            {err && <p className="text-[11px] text-red-600 dark:text-red-400">{err}</p>}

            <div className="flex items-center gap-2">
              <button
                onClick={() => send({ activeMin: hours * 60 + minutes, note })}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-bold transition"
              >
                ذخیره‌ی اصلاح
              </button>
              <button
                onClick={() => send({ recompute: true })}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-xs font-bold transition"
              >
                بازسازی این روز
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 pt-3 border-t border-gray-100 dark:border-white/5">
            اصلاح این عدد از دسترسی شما خارج است. اگر با واقعیت نمی‌خواند، به مدیرتان
            بگویید.
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
    </div>
  );
}
