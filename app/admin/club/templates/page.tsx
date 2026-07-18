"use client";

import { useCallback, useEffect, useState } from "react";
import { TEMPLATE_VARIABLES, previewTemplate, countSmsParts } from "@/lib/club/sms/render";

interface Template {
  id: string;
  key: string;
  title: string;
  kind: "TRANSACTIONAL" | "MARKETING";
  mode: "PATTERN" | "TEXT";
  patternCode: string | null;
  body: string | null;
  isActive: boolean;
  variables: string[];
  parts: number | null;
  stats: { sent: number; skipped: number; failed: number };
}

const EMPTY = {
  key: "",
  title: "",
  kind: "MARKETING" as const,
  mode: "TEXT" as const,
  patternCode: "",
  body: "",
  isActive: true,
};

function toFa(n: number) {
  return n.toLocaleString("fa-IR");
}

export default function ClubTemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/club/templates");
    const d = await res.json();
    setItems(d.templates ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(t: Template) {
    setItems((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, isActive: !x.isActive } : x))
    );
    await fetch(`/api/admin/club/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
  }

  const patternTemplates = items.filter((t) => t.mode === "PATTERN");
  const textTemplates = items.filter((t) => t.mode === "TEXT");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">قالب‌های پیامک</h1>
          <p className="text-sm text-gray-500 mt-1">
            {toFa(items.length)} قالب — {toFa(patternTemplates.length)} پترن،{" "}
            {toFa(textTemplates.length)} متن آزاد
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-black hover:bg-primary-700 transition-all"
        >
          قالب جدید
        </button>
      </div>

      {/* راهنمای انتخاب حالت */}
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard
          tone="emerald"
          title="پترن — برای پیام خودکار"
          lines={[
            "بلافاصله و بدون تأیید ارسال می‌شود",
            "متن باید از قبل در پنل پیامک ثبت و تأیید شود",
            "مناسب: کد ورود، وضعیت سفارش، تولد، خوش‌آمد",
          ]}
        />
        <InfoCard
          tone="amber"
          title="متن آزاد — برای کمپین"
          lines={[
            "متن را همین‌جا می‌نویسید، بدون نیاز به ثبت قبلی",
            "هر ارسال نیاز به تأیید اپراتور دارد و با تأخیر می‌رود",
            "نیازمند خط تبلیغاتی",
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm font-bold text-gray-500">هنوز قالبی ساخته نشده</p>
          <button
            onClick={() => setEditing("new")}
            className="mt-4 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-black"
          >
            ساخت اولین قالب
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                      {t.title}
                    </h3>
                    <Badge tone={t.mode === "PATTERN" ? "emerald" : "amber"}>
                      {t.mode === "PATTERN" ? "پترن" : "متن آزاد"}
                    </Badge>
                    <Badge tone={t.kind === "TRANSACTIONAL" ? "blue" : "purple"}>
                      {t.kind === "TRANSACTIONAL" ? "خدماتی" : "تبلیغاتی"}
                    </Badge>
                    {!t.isActive && <Badge tone="gray">غیرفعال</Badge>}
                  </div>

                  <p className="text-[10px] font-bold text-gray-400 mt-1 tabular-nums" dir="ltr">
                    {t.key}
                    {t.patternCode ? ` · ${t.patternCode}` : ""}
                  </p>

                  {t.body && (
                    <p className="text-[11px] font-bold text-gray-500 mt-2 leading-relaxed line-clamp-2">
                      {t.body}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2.5 text-[10px] font-bold text-gray-400">
                    {t.parts !== null && <span>{toFa(t.parts)} بخش</span>}
                    {t.stats.sent > 0 && (
                      <span className="text-emerald-500">{toFa(t.stats.sent)} ارسال</span>
                    )}
                    {t.stats.skipped > 0 && <span>{toFa(t.stats.skipped)} رد شده</span>}
                    {t.stats.failed > 0 && (
                      <span className="text-red-500">{toFa(t.stats.failed)} ناموفق</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(t)}
                    className={`relative w-10 h-5.5 h-[22px] rounded-full transition-colors ${
                      t.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                    title={t.isActive ? "غیرفعال کن" : "فعال کن"}
                  >
                    <span
                      className={`absolute top-1 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${
                        t.isActive ? "right-1" : "right-5"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => setEditing(t)}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[11px] font-black text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white transition-all"
                  >
                    ویرایش
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
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

// ─── مودال ──────────────────────────────────────────────────────────

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    template
      ? {
          key: template.key,
          title: template.title,
          kind: template.kind,
          mode: template.mode,
          patternCode: template.patternCode ?? "",
          body: template.body ?? "",
          isActive: template.isActive,
        }
      : { ...EMPTY }
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; ok: boolean } | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const url = template
        ? `/api/admin/club/templates/${template.id}`
        : "/api/admin/club/templates";

      const res = await fetch(url, {
        method: template ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  async function remove() {
    if (!template) return;
    if (!confirm(`قالب «${template.title}» حذف شود؟`)) return;

    const res = await fetch(`/api/admin/club/templates/${template.id}`, {
      method: "DELETE",
    });
    const d = await res.json();

    if (!res.ok) {
      setError(d.error ?? "حذف نشد");
      return;
    }
    onSaved();
  }

  async function sendTest() {
    if (!template) {
      setTestResult({ text: "اول قالب را ذخیره کنید", ok: false });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/club/templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, phone: testPhone }),
      });
      const d = await res.json();

      setTestResult(
        res.ok
          ? { text: d.note ?? `ارسال شد — شناسه ${d.requestId}`, ok: true }
          : { text: d.error ?? "ارسال ناموفق", ok: false }
      );
    } catch {
      setTestResult({ text: "ارتباط با سرور برقرار نشد", ok: false });
    } finally {
      setTesting(false);
    }
  }

  const preview = form.body ? previewTemplate(form.body) : "";
  const parts = form.body ? countSmsParts(preview) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-700 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900 dark:text-white">
            {template ? "ویرایش قالب" : "قالب جدید"}
          </h3>
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

        {/* حالت ارسال */}
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2">حالت ارسال</label>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={form.mode === "PATTERN"}
              onClick={() => set("mode", "PATTERN")}
              title="پترن"
              hint="فوری، نیازمند ثبت در پنل"
            />
            <ModeButton
              active={form.mode === "TEXT"}
              onClick={() => set("mode", "TEXT")}
              title="متن آزاد"
              hint="برای کمپین، با تأیید"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">
              عنوان
            </label>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="مثلاً پیام تولد"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">
              شناسه (انگلیسی)
            </label>
            <input
              value={form.key}
              onChange={(e) => set("key", e.target.value)}
              placeholder="birthday"
              dir="ltr"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2">نوع پیام</label>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={form.kind === "TRANSACTIONAL"}
              onClick={() => set("kind", "TRANSACTIONAL")}
              title="خدماتی"
              hint="خط خدماتی، بدون نیاز به رضایت"
            />
            <ModeButton
              active={form.kind === "MARKETING"}
              onClick={() => set("kind", "MARKETING")}
              title="تبلیغاتی"
              hint="خط تبلیغاتی، نیازمند رضایت"
            />
          </div>
        </div>

        {form.mode === "PATTERN" ? (
          <>
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2">
                کد پترن
              </label>
              <input
                value={form.patternCode}
                onChange={(e) => set("patternCode", e.target.value)}
                placeholder="vO8hzQ0pbS"
                dir="ltr"
                className={inputCls}
              />
              <p className="text-[10px] font-bold text-gray-400 mt-2 leading-relaxed">
                کد را از بخش پترن‌های پنل پیامک بردارید. متن پترن باید نام فروشگاه را
                داشته باشد و لینک سایت در توضیحات پترن ثبت شود، وگرنه تأیید نمی‌شود.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2">
                متن پترن (فقط برای یادآوری خودتان)
              </label>
              <textarea
                rows={3}
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
                placeholder="%name% عزیز، تولدت مبارک! کد تخفیف: %code%"
                className={`${inputCls} resize-none leading-relaxed`}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">
              متن پیام
            </label>
            <textarea
              rows={4}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="سلام {name} عزیز، به مناسبت ... از {store}"
              className={`${inputCls} resize-none leading-relaxed`}
            />

            <div className="flex flex-wrap gap-1.5 mt-2">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => set("body", form.body + `{${v.key}}`)}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-[10px] font-black text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white transition-all"
                >
                  {v.label}
                </button>
              ))}
            </div>

            {preview && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-[10px] font-black text-gray-500 mb-1.5">پیش‌نمایش</p>
                <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {preview}
                </p>
                {parts && (
                  <p className="text-[10px] font-bold text-gray-400 mt-2">
                    {toFa(parts.chars)} کاراکتر · {toFa(parts.parts)} بخش
                    {parts.parts > 2 && (
                      <span className="text-amber-500 mr-1">— هزینه بالا</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ارسال تست */}
        {template && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <label className="block text-[10px] font-black text-gray-500 mb-2">
              ارسال آزمایشی
            </label>
            <div className="flex gap-2">
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="09120000000"
                dir="ltr"
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={sendTest}
                disabled={testing || !testPhone}
                className="px-5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black disabled:opacity-40 transition-all"
              >
                {testing ? "..." : "ارسال"}
              </button>
            </div>
            {testResult && (
              <p
                className={`text-[11px] font-bold mt-2 ${
                  testResult.ok ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {testResult.text}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 transition-all disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
          {template && (
            <button
              onClick={remove}
              className="px-5 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl font-black text-sm hover:bg-red-100 transition-all"
            >
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── اجزای کوچک ────────────────────────────────────────────────────

const inputCls =
  "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-primary-500 dark:text-white transition-all";

function ModeButton({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border text-right transition-all ${
        active
          ? "border-primary-500 bg-primary-500/5"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
      }`}
    >
      <p
        className={`text-xs font-black ${
          active ? "text-primary-600" : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {title}
      </p>
      <p className="text-[10px] font-bold text-gray-400 mt-0.5">{hint}</p>
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "emerald" | "amber" | "blue" | "purple" | "gray";
}) {
  const tones = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    gray: "bg-gray-500/10 text-gray-500",
  };
  return (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${tones[tone]}`}>
      {children}
    </span>
  );
}

function InfoCard({
  tone,
  title,
  lines,
}: {
  tone: "emerald" | "amber";
  title: string;
  lines: string[];
}) {
  const border =
    tone === "emerald"
      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-900/10"
      : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10";
  const text = tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400";

  return (
    <div className={`rounded-2xl border p-4 ${border}`}>
      <p className={`text-xs font-black ${text}`}>{title}</p>
      <ul className="mt-2 space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-[10px] font-bold text-gray-600 dark:text-gray-400 leading-relaxed">
            · {l}
          </li>
        ))}
      </ul>
    </div>
  );
}