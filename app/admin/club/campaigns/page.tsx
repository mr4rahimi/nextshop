"use client";

import { useCallback, useEffect, useState } from "react";
import { JALALI_MONTH_OPTIONS } from "@/lib/club/jalali";

interface Campaign {
  id: string;
  title: string;
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "DONE" | "CANCELED";
  segmentLabel: string;
  scheduledAt: string | null;
  startedAt: string | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  template: { title: string; key: string; mode: string; kind: string };
}

interface Template {
  id: string;
  title: string;
  mode: string;
  kind: string;
  isActive: boolean;
}

interface Segment {
  sources?: string[];
  birthMonth?: number;
  minOrders?: number;
  maxOrders?: number;
  minSpent?: string;
  inactiveDays?: number;
  activeWithinDays?: number;
  memberSinceDays?: number;
}

interface Summary {
  total: number;
  consented: number;
  withoutConsent: number;
  optedOut: number;
  reachable: number;
}

const STATUS: Record<Campaign["status"], { label: string; cls: string }> = {
  DRAFT: { label: "پیش‌نویس", cls: "bg-gray-500/10 text-gray-500" },
  SCHEDULED: { label: "زمان‌بندی‌شده", cls: "bg-blue-500/10 text-blue-600" },
  RUNNING: { label: "در حال ارسال", cls: "bg-amber-500/10 text-amber-600" },
  PAUSED: { label: "متوقف", cls: "bg-orange-500/10 text-orange-600" },
  DONE: { label: "تمام‌شده", cls: "bg-emerald-500/10 text-emerald-600" },
  CANCELED: { label: "لغو شده", cls: "bg-red-500/10 text-red-600" },
};

const SOURCES = [
  { value: "ONLINE", label: "سایت" },
  { value: "IN_STORE", label: "حضوری" },
  { value: "MARKETPLACE", label: "مارکت‌پلیس" },
  { value: "CALLER_ID", label: "شماره‌گیر" },
  { value: "IMPORT", label: "ورود فایل" },
];

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [lineReady, setLineReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, tRes] = await Promise.all([
      fetch("/api/admin/club/campaigns"),
      fetch("/api/admin/club/templates"),
    ]);
    const c = await cRes.json();
    const t = await tRes.json();

    setItems(c.campaigns ?? []);
    setLineReady(c.marketingLineReady ?? false);
    setTemplates((t.templates ?? []).filter((x: Template) => x.mode === "TEXT"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(c: Campaign, action: "start" | "pause" | "cancel") {
    if (action === "start") {
      if (!confirm(`ارسال کمپین «${c.title}» به ${toFa(c.totalCount)} نفر آغاز شود؟`)) return;
    }
    if (action === "cancel" && !confirm("کمپین لغو شود؟")) return;

    const res = await fetch(`/api/admin/club/campaigns/${c.id}/${action}`, {
      method: "POST",
    });
    const d = await res.json();

    setMsg(
      res.ok
        ? {
            text:
              d.note ??
              (action === "start"
                ? `${toFa(d.recipients)} گیرنده در ${toFa(d.batches)} دسته وارد صف شد`
                : "انجام شد"),
            ok: true,
          }
        : { text: d.error ?? "عملیات ناموفق", ok: false }
    );
    load();
  }

  async function remove(c: Campaign) {
    if (!confirm(`کمپین «${c.title}» حذف شود؟`)) return;
    const res = await fetch(`/api/admin/club/campaigns/${c.id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) setMsg({ text: d.error, ok: false });
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">کمپین‌های پیامکی</h1>
          <p className="text-sm text-gray-500 mt-1">{toFa(items.length)} کمپین</p>
        </div>
        <button
          onClick={() => setBuilding(true)}
          disabled={templates.length === 0}
          className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-black hover:bg-primary-700 transition-all disabled:opacity-40"
        >
          کمپین جدید
        </button>
      </div>

      {msg && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold text-center ${
            msg.ok
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
              : "bg-red-50 dark:bg-red-900/20 text-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}

      {!lineReady && (
        <div className="px-4 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
            خط تبلیغاتی ثبت نشده است. می‌توانید کمپین بسازید و تعداد گیرنده را ببینید،
            ولی ارسال تا ثبت خط تبلیغاتی در{" "}
            <a href="/admin/club/settings" className="underline font-black">
              تنظیمات باشگاه
            </a>{" "}
            ممکن نیست.
          </p>
        </div>
      )}

      {templates.length === 0 && !loading && (
        <div className="px-4 py-3.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-2xl">
          <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
            قالب متن آزادی وجود ندارد. ابتدا از{" "}
            <a href="/admin/club/templates" className="underline font-black">
              صفحه قالب‌ها
            </a>{" "}
            یک قالب با حالت «متن آزاد» بسازید و فعالش کنید.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm font-bold text-gray-500">هنوز کمپینی ساخته نشده</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const st = STATUS[c.status];
            const progress =
              c.totalCount > 0
                ? Math.round(((c.sentCount + c.skippedCount + c.failedCount) / c.totalCount) * 100)
                : 0;

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white">
                        {c.title}
                      </h3>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">
                      قالب: {c.template.title} · {c.segmentLabel}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold">
                      <span className="text-gray-500">{toFa(c.totalCount)} گیرنده</span>
                      {c.sentCount > 0 && (
                        <span className="text-emerald-500">{toFa(c.sentCount)} ارسال</span>
                      )}
                      {c.skippedCount > 0 && (
                        <span className="text-gray-400">{toFa(c.skippedCount)} رد</span>
                      )}
                      {c.failedCount > 0 && (
                        <span className="text-red-500">{toFa(c.failedCount)} ناموفق</span>
                      )}
                    </div>

                    {(c.status === "RUNNING" || c.status === "PAUSED" || c.status === "DONE") && (
                      <div className="mt-2.5 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {(c.status === "DRAFT" || c.status === "SCHEDULED" || c.status === "PAUSED") && (
                      <button
                        onClick={() => act(c, "start")}
                        className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-[11px] font-black hover:bg-primary-700 transition-all"
                      >
                        شروع ارسال
                      </button>
                    )}
                    {c.status === "RUNNING" && (
                      <button
                        onClick={() => act(c, "pause")}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-black transition-all"
                      >
                        توقف
                      </button>
                    )}
                    {c.status !== "DONE" && c.status !== "CANCELED" && (
                      <button
                        onClick={() => act(c, "cancel")}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[11px] font-black text-gray-500 hover:text-red-500 transition-all"
                      >
                        لغو
                      </button>
                    )}
                    {(c.status === "DRAFT" || c.status === "CANCELED") && (
                      <button
                        onClick={() => remove(c)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-black text-gray-400 hover:text-red-500 transition-all"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {building && (
        <CampaignBuilder
          templates={templates}
          onClose={() => setBuilding(false)}
          onSaved={() => {
            setBuilding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── سازنده کمپین ───────────────────────────────────────────────────

function CampaignBuilder({
  templates,
  onClose,
  onSaved,
}: {
  templates: Template[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [segment, setSegment] = useState<Segment>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [parts, setParts] = useState(0);
  const [totalParts, setTotalParts] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // پیش‌نمایش با تأخیر تا هر تغییر یک درخواست نزند
  useEffect(() => {
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetch("/api/admin/club/campaigns", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segment, templateId }),
        });
        const d = await res.json();
        setSummary(d.summary);
        setPreview(d.preview);
        setParts(d.parts ?? 0);
        setTotalParts(d.totalParts ?? 0);
      } finally {
        setPreviewing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [segment, templateId]);

  function setSeg<K extends keyof Segment>(k: K, v: Segment[K]) {
    setSegment((s) => {
      const next = { ...s };
      if (v === undefined || v === "" || v === null) delete next[k];
      else next[k] = v;
      return next;
    });
  }

  function toggleSource(value: string) {
    const current = segment.sources ?? [];
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    setSeg("sources", next.length > 0 ? next : undefined);
  }

  async function save() {
    if (!title.trim()) {
      setError("عنوان کمپین را وارد کنید");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/club/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, templateId, segment }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "ساخت کمپین ناموفق بود");
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
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-700 p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900 dark:text-white">کمپین جدید</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-red-500"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-xs font-bold text-center">
            {error}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">عنوان کمپین</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="تخفیف نوروز ۱۴۰۵"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">قالب پیام</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={inputCls}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.isActive ? "" : "(غیرفعال)"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* بخش‌بندی */}
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
          <h4 className="text-xs font-black text-gray-900 dark:text-white">
            چه کسانی این پیام را دریافت کنند؟
          </h4>

          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">منبع عضویت</label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => {
                const active = segment.sources?.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleSource(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                      active
                        ? "bg-primary-600 text-white"
                        : "bg-white dark:bg-white/5 text-gray-500 border border-gray-200 dark:border-white/10"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] font-bold text-gray-400 mt-1.5">
              انتخاب نکردن یعنی همه منابع
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="حداقل تعداد خرید"
              value={segment.minOrders}
              onChange={(v) => setSeg("minOrders", v)}
            />
            <NumField
              label="حداکثر تعداد خرید"
              value={segment.maxOrders}
              onChange={(v) => setSeg("maxOrders", v)}
              hint="۰ یعنی فقط کسانی که هرگز نخریده‌اند"
            />
            <NumField
              label="بدون خرید در (روز)"
              value={segment.inactiveDays}
              onChange={(v) => setSeg("inactiveDays", v)}
              hint="مشتریان خوابیده"
            />
            <NumField
              label="خرید در (روز) اخیر"
              value={segment.activeWithinDays}
              onChange={(v) => setSeg("activeWithinDays", v)}
              hint="مشتریان فعال"
            />
            <NumField
              label="عضویت بیش از (روز)"
              value={segment.memberSinceDays}
              onChange={(v) => setSeg("memberSinceDays", v)}
            />
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2">ماه تولد</label>
              <select
                value={segment.birthMonth ?? ""}
                onChange={(e) =>
                  setSeg("birthMonth", e.target.value ? Number(e.target.value) : undefined)
                }
                className={inputCls}
              >
                <option value="">همه</option>
                {JALALI_MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">
              حداقل مجموع خرید (تومان)
            </label>
            <input
              inputMode="numeric"
              value={segment.minSpent ?? ""}
              onChange={(e) =>
                setSeg("minSpent", e.target.value.replace(/\D/g, "") || undefined)
              }
              placeholder="مثلاً 5000000"
              dir="ltr"
              className={inputCls}
            />
          </div>
        </div>

        {/* خلاصه مخاطبان */}
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black text-gray-900 dark:text-white">مخاطبان</h4>
            {previewing && (
              <span className="text-[10px] font-bold text-gray-400">در حال محاسبه...</span>
            )}
          </div>

          {summary ? (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Metric label="در این بخش" value={summary.total} />
                <Metric
                  label="بدون رضایت"
                  value={summary.withoutConsent}
                  tone={summary.withoutConsent > 0 ? "warn" : undefined}
                />
                <Metric label="دریافت می‌کنند" value={summary.reachable} tone="ok" />
              </div>

              {summary.reachable === 0 && summary.total > 0 && (
                <p className="mt-3 text-[11px] font-bold text-amber-600 leading-relaxed">
                  هیچ‌کس در این بخش رضایت دریافت پیامک تبلیغاتی نداده است. قبل از کمپین
                  باید رضایتشان را بگیرید.
                </p>
              )}

              {parts > 0 && summary.reachable > 0 && (
                <p className="mt-3 text-[11px] font-bold text-gray-500">
                  هر پیام {toFa(parts)} بخش · مجموع {toFa(totalParts)} بخش پیامک
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] font-bold text-gray-400">در حال بارگذاری...</p>
          )}
        </div>

        {/* پیش‌نمایش متن */}
        {preview && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
            <p className="text-[10px] font-black text-gray-500 mb-2">پیش‌نمایش پیام</p>
            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {preview}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 transition-all disabled:opacity-50"
          >
            {saving ? "در حال ساخت..." : "ذخیره به‌عنوان پیش‌نویس"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl font-black text-sm"
          >
            انصراف
          </button>
        </div>

        <p className="text-[10px] font-bold text-gray-400 text-center">
          کمپین به‌صورت پیش‌نویس ذخیره می‌شود. ارسال با دکمه «شروع ارسال» در فهرست انجام می‌شود.
        </p>
      </div>
    </div>
  );
}

// ─── اجزای کوچک ────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-primary-500 dark:text-white transition-all";

function NumField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-500 mb-2">{label}</label>
      <input
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          onChange(raw === "" ? undefined : Number(raw));
        }}
        dir="ltr"
        className={inputCls}
      />
      {hint && <p className="text-[10px] font-bold text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-gray-900 dark:text-white";

  return (
    <div>
      <p className={`text-2xl font-black tabular-nums ${color}`}>{toFa(value)}</p>
      <p className="text-[10px] font-bold text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}