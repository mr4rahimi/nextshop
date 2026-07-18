"use client";

import { useCallback, useEffect, useState } from "react";
import { JALALI_MONTH_OPTIONS, formatJalaliShort, toJalali } from "@/lib/club/jalali";

interface Member {
  id: string;
  source: string;
  sourcePlatform: string | null;
  smsConsent: boolean;
  birthDate: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  totalSpent: string;
  orderCount: number;
  lastPurchaseAt: string | null;
  isBlocked: boolean;
  tags: string[];
  note: string | null;
  joinedAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
    isActive: boolean;
  };
}

interface Stats {
  all: number;
  consent: number;
  withBirth: number;
  buyers: number;
  bySource: Record<string, number>;
}

const SOURCE_FA: Record<string, string> = {
  ONLINE: "سایت",
  IN_STORE: "حضوری",
  CALLER_ID: "شماره‌گیر",
  IMPORT: "ورود فایل",
  MARKETPLACE: "مارکت‌پلیس",
};

const SOURCE_STYLE: Record<string, string> = {
  ONLINE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  IN_STORE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CALLER_ID: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  IMPORT: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  MARKETPLACE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const PAGE_SIZE = 20;

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

export default function AdminClubMembersPage() {
  const [items, setItems] = useState<Member[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Member | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    source: "",
    consent: "",
    birth: "",
    birthMonth: "",
    buyer: "",
  });

  const queryString = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams({ page: String(page), ...extra });
      Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
      return p.toString();
    },
    [filters, page]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/club/members?${queryString()}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, q: searchInput.trim() }));
  }

  function resetFilters() {
    setSearchInput("");
    setFilters({ q: "", source: "", consent: "", birth: "", birthMonth: "", buyer: "" });
  }

  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* سرصفحه */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            اعضای باشگاه مشتریان
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {toFa(total)} عضو {hasFilters ? "با فیلتر فعلی" : "در مجموع"}
          </p>
        </div>

        <a
          href={`/api/admin/club/members/export?${queryString()}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          خروجی اکسل
        </a>
      </div>

      {/* آمار */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="کل اعضا" value={stats.all} />
          <StatCard
            label="رضایت پیامک تبلیغاتی"
            value={stats.consent}
            hint={stats.all ? `${Math.round((stats.consent / stats.all) * 100)}٪` : undefined}
            tone={stats.consent === 0 ? "warn" : "ok"}
          />
          <StatCard
            label="دارای تاریخ تولد"
            value={stats.withBirth}
            hint={stats.all ? `${Math.round((stats.withBirth / stats.all) * 100)}٪` : undefined}
          />
          <StatCard label="دارای خرید" value={stats.buyers} />
        </div>
      )}

      {/* فیلترها */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <form onSubmit={applySearch} className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="جستجو با نام یا شماره موبایل..."
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary-500 dark:text-white"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-black hover:bg-primary-700 transition-all"
          >
            جستجو
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.source}
            onChange={(v) => setFilters((f) => ({ ...f, source: v }))}
            options={[
              { value: "", label: "همه منابع" },
              ...Object.entries(SOURCE_FA).map(([value, label]) => ({
                value,
                label: `${label}${stats?.bySource[value] ? ` (${toFa(stats.bySource[value])})` : ""}`,
              })),
            ]}
          />
          <Select
            value={filters.consent}
            onChange={(v) => setFilters((f) => ({ ...f, consent: v }))}
            options={[
              { value: "", label: "رضایت پیامک: همه" },
              { value: "yes", label: "رضایت دارد" },
              { value: "no", label: "رضایت ندارد" },
            ]}
          />
          <Select
            value={filters.birth}
            onChange={(v) => setFilters((f) => ({ ...f, birth: v, birthMonth: "" }))}
            options={[
              { value: "", label: "تاریخ تولد: همه" },
              { value: "yes", label: "ثبت شده" },
              { value: "no", label: "ثبت نشده" },
            ]}
          />
          <Select
            value={filters.birthMonth}
            onChange={(v) => setFilters((f) => ({ ...f, birthMonth: v }))}
            options={[
              { value: "", label: "ماه تولد: همه" },
              ...JALALI_MONTH_OPTIONS.map((m) => ({
                value: String(m.value),
                label: `متولد ${m.title}`,
              })),
            ]}
          />
          <Select
            value={filters.buyer}
            onChange={(v) => setFilters((f) => ({ ...f, buyer: v }))}
            options={[
              { value: "", label: "خرید: همه" },
              { value: "yes", label: "خرید داشته" },
              { value: "no", label: "بدون خرید" },
            ]}
          />

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 text-xs font-black hover:bg-red-100 transition-all"
            >
              حذف فیلترها
            </button>
          )}
        </div>
      </div>

      {/* لیست */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-bold text-gray-400">
            در حال بارگذاری...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-bold text-gray-500">عضوی یافت نشد</p>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="mt-3 text-xs font-black text-primary-600"
              >
                حذف فیلترها
              </button>
            )}
          </div>
        ) : (
          <>
            {/* دسکتاپ */}
            <table className="w-full text-right hidden md:table">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-[11px] font-black text-gray-400">
                  <th className="px-6 py-3">مشتری</th>
                  <th className="px-3 py-3">منبع</th>
                  <th className="px-3 py-3">پیامک</th>
                  <th className="px-3 py-3">تولد</th>
                  <th className="px-3 py-3 text-center">خرید</th>
                  <th className="px-3 py-3">عضویت</th>
                  <th className="px-6 py-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <p className="text-xs font-black text-gray-900 dark:text-white">
                        {[m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || "بدون نام"}
                        {m.isBlocked && (
                          <span className="mr-2 text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
                            مسدود
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] font-bold text-gray-400 tabular-nums" dir="ltr">
                        {m.user.phone}
                      </p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                          SOURCE_STYLE[m.source] ?? SOURCE_STYLE.IMPORT
                        }`}
                      >
                        {SOURCE_FA[m.source] ?? m.source}
                        {m.sourcePlatform ? ` · ${m.sourcePlatform}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`text-[10px] font-black ${
                          m.smsConsent ? "text-emerald-500" : "text-gray-300 dark:text-gray-600"
                        }`}
                      >
                        {m.smsConsent ? "دارد" : "ندارد"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-[11px] font-bold text-gray-500">
                        {m.birthDate ? formatJalaliShort(new Date(m.birthDate)) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums">
                        {toFa(m.orderCount)}
                      </p>
                      {m.orderCount > 0 && (
                        <p className="text-[10px] font-bold text-gray-400 tabular-nums">
                          {toFa(m.totalSpent)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-[11px] font-bold text-gray-400">
                        {formatJalaliShort(new Date(m.joinedAt))}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-left">
                      <button
                        onClick={() => setEditing(m)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[11px] font-black text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white transition-all"
                      >
                        ویرایش
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* موبایل */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setEditing(m)}
                  className="w-full p-4 text-right hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-gray-900 dark:text-white">
                      {[m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || "بدون نام"}
                    </p>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded ${
                        SOURCE_STYLE[m.source] ?? SOURCE_STYLE.IMPORT
                      }`}
                    >
                      {SOURCE_FA[m.source]}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-gray-400 mt-1 tabular-nums" dir="ltr">
                    {m.user.phone}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-gray-400">
                    <span>{toFa(m.orderCount)} خرید</span>
                    <span className={m.smsConsent ? "text-emerald-500" : ""}>
                      پیامک: {m.smsConsent ? "دارد" : "ندارد"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* صفحه‌بندی */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold text-gray-500">
              {toFa((page - 1) * PAGE_SIZE + 1)}–{toFa(Math.min(page * PAGE_SIZE, total))} از{" "}
              {toFa(total)}
            </span>
            <div className="flex items-center gap-2">
              <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} dir="prev" />
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 px-2">
                {toFa(page)} / {toFa(totalPages)}
              </span>
              <PageBtn
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                dir="next"
              />
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditModal
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── مودال ویرایش ──────────────────────────────────────────────────

function EditModal({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const birth = member.birthDate ? toJalali(new Date(member.birthDate)) : null;

  const [form, setForm] = useState({
    firstName: member.user.firstName ?? "",
    lastName: member.user.lastName ?? "",
    birthYear: birth ? String(birth.year) : "",
    birthMonth: birth ? String(birth.month) : "",
    birthDay: birth ? String(birth.day) : "",
    note: member.note ?? "",
    tags: member.tags.join("، "),
    pointsDelta: "",
    pointsNote: "",
  });
  const [smsConsent, setSmsConsent] = useState(member.smsConsent);
  const [isBlocked, setIsBlocked] = useState(member.isBlocked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/club/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          smsConsent,
          isBlocked,
          note: form.note,
          tags: form.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
          birthYear: form.birthYear || null,
          birthMonth: form.birthMonth || null,
          birthDay: form.birthDay || null,
          clearBirthDate: !form.birthYear && !!member.birthDate,
          pointsDelta: form.pointsDelta ? Number(form.pointsDelta) : undefined,
          pointsNote: form.pointsNote || undefined,
          recomputeStats: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "ذخیره نشد");
        return;
      }
      onSaved();
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-700 p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              ویرایش عضو
            </h3>
            <p className="text-[11px] font-bold text-gray-400 mt-1 tabular-nums" dir="ltr">
              {member.user.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-red-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-xs font-bold text-center">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="نام"
            value={form.firstName}
            onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
          />
          <Input
            label="نام خانوادگی"
            value={form.lastName}
            onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2">
            تاریخ تولد (شمسی)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              inputMode="numeric"
              placeholder="سال"
              maxLength={4}
              value={form.birthYear}
              onChange={(e) =>
                setForm((f) => ({ ...f, birthYear: e.target.value.replace(/\D/g, "") }))
              }
              className={inputCls}
            />
            <select
              value={form.birthMonth}
              onChange={(e) => setForm((f) => ({ ...f, birthMonth: e.target.value }))}
              className={inputCls}
            >
              <option value="">ماه</option>
              {JALALI_MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.title}
                </option>
              ))}
            </select>
            <input
              inputMode="numeric"
              placeholder="روز"
              maxLength={2}
              value={form.birthDay}
              onChange={(e) =>
                setForm((f) => ({ ...f, birthDay: e.target.value.replace(/\D/g, "") }))
              }
              className={inputCls}
            />
          </div>
        </div>

        <Toggle
          label="رضایت دریافت پیامک تبلیغاتی"
          checked={smsConsent}
          onChange={setSmsConsent}
        />
        <Toggle
          label="مسدود کردن ارسال پیامک به این عضو"
          checked={isBlocked}
          onChange={setIsBlocked}
          danger
        />

        <Input
          label="برچسب‌ها (با ویرگول جدا کنید)"
          value={form.tags}
          onChange={(v) => setForm((f) => ({ ...f, tags: v }))}
        />

        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2">
            یادداشت داخلی
          </label>
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={`${inputCls} text-right resize-none`}
          />
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-[10px] font-black text-gray-500 mb-2">
            تغییر دستی امتیاز
            <span className="font-bold text-gray-400 mr-1.5">
              — عدد منفی برای کسر
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              inputMode="numeric"
              placeholder="مثلاً ۵۰"
              value={form.pointsDelta}
              onChange={(e) =>
                setForm((f) => ({ ...f, pointsDelta: e.target.value.replace(/[^\d-]/g, "") }))
              }
              className={inputCls}
            />
            <input
              placeholder="دلیل"
              value={form.pointsNote}
              onChange={(e) => setForm((f) => ({ ...f, pointsNote: e.target.value }))}
              className={`${inputCls} col-span-2 text-right`}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 transition-all disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl font-black text-sm hover:bg-gray-200 transition-all"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── اجزای کوچک ────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-center outline-none focus:border-primary-500 dark:text-white transition-all";

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-500 mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} text-right`}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  danger,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
    >
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 text-right">
        {label}
      </span>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked
            ? danger
              ? "bg-red-500"
              : "bg-emerald-500"
            : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
            checked ? "right-1" : "right-6"
          }`}
        />
      </span>
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[11px] font-black text-gray-600 dark:text-gray-300 outline-none focus:border-primary-500 transition-all"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-[10px] font-bold text-gray-400">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
          {toFa(value)}
        </span>
        {hint && (
          <span
            className={`text-[11px] font-black ${
              tone === "warn" ? "text-amber-500" : "text-gray-400"
            }`}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

function PageBtn({
  onClick,
  disabled,
  dir,
}: {
  onClick: () => void;
  disabled: boolean;
  dir: "prev" | "next";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={dir === "prev" ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
        />
      </svg>
    </button>
  );
}