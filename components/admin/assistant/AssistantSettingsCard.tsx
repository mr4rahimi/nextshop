"use client";

/**
 * کارت «راهنمای هوشمند» در تنظیمات هوش مصنوعی — docs/plans/admin-assistant.md بخش ۷
 *
 * ذخیره‌ی جدا از بقیه‌ی صفحه دارد چون جدول خودش را دارد (`AssistantSetting`).
 * مدیر فقط شمارش و هزینه‌ی هر کارمند را می‌بیند، نه متن گفتگو (تصمیم ۴).
 */

import { useEffect, useState } from "react";
import { ASSISTANT_MODELS } from "@/lib/assistant/constants";

interface Setting {
  enabled: boolean;
  model: string;
  maxTokens: number;
  dailyLimit: number;
  extraGuide: string;
  updatedByName: string | null;
}

interface StaffRow {
  userId: string;
  name: string;
  roleTitle: string | null;
  dailyLimit: number | null;
  today: number;
  month: number;
  monthCost: number;
}

const card = "bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5";
const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all";

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function AssistantSettingsCard() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [feedback, setFeedback] = useState({ up: 0, down: 0 });
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (d: { setting: Setting; staff: StaffRow[]; feedback: { up: number; down: number } }) => {
    setSetting(d.setting);
    setStaff(d.staff);
    setFeedback(d.feedback);
    setLimits(Object.fromEntries(d.staff.map((s) => [s.userId, s.dailyLimit === null ? "" : String(s.dailyLimit)])));
  };

  useEffect(() => {
    fetch("/api/admin/ai-settings/assistant")
      .then((r) => r.json())
      .then((d) => (d.ok ? apply(d) : setMsg({ ok: false, text: d.error ?? "خواندن تنظیمات ناموفق بود." })))
      .catch(() => setMsg({ ok: false, text: "خواندن تنظیمات راهنمای هوشمند ناموفق بود." }));
  }, []);

  async function save() {
    if (!setting) return;
    setSaving(true);
    setMsg(null);
    try {
      const d = await (
        await fetch("/api/admin/ai-settings/assistant", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setting,
            users: staff.map((s) => ({ userId: s.userId, dailyLimit: limits[s.userId]?.trim() === "" ? null : Number(limits[s.userId]) })),
          }),
        })
      ).json();
      if (!d.ok) throw new Error(d.error);
      apply(d);
      setMsg({ ok: true, text: "✓ ذخیره شد" });
    } catch (e) {
      setMsg({ ok: false, text: `ذخیره ناموفق: ${e instanceof Error ? e.message : "خطا"}` });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!setting) return;
    setTesting(true);
    setMsg(null);
    try {
      const d = await (
        await fetch("/api/admin/ai-settings/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: setting.model }),
        })
      ).json();
      setMsg(
        !d.ok
          ? { ok: false, text: d.error }
          : d.toolCallOk
            ? { ok: true, text: `✓ مدل ابزار را درست صدا زد (${fa(d.seconds)} ثانیه).` }
            : { ok: false, text: "مدل جواب داد ولی ابزار را درست صدا نزد؛ دستیار با این مدل داده‌ای نمی‌بیند. مدل دیگری انتخاب کنید." },
      );
    } catch {
      setMsg({ ok: false, text: "تست ناموفق بود." });
    } finally {
      setTesting(false);
    }
  }

  if (!setting) {
    return (
      <div className={card}>
        {msg ? <p className="text-sm text-red-500">{msg.text}</p> : <div className="h-24 animate-pulse rounded-xl bg-gray-50 dark:bg-white/5" />}
      </div>
    );
  }

  const knownModel = ASSISTANT_MODELS.some((m) => m.value === setting.model);
  const monthCost = staff.reduce((s, r) => s + r.monthCost, 0);

  return (
    <div className={card + " space-y-4"}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-black text-gray-900 dark:text-white">راهنمای هوشمند پنل</h2>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-5">
            دکمه‌ی ✨ بالای پنل: کارمندان درباره‌ی طرز کار پنل و کارهای خودشان می‌پرسند. هر کس فقط داده‌ای را می‌بیند که در پنل دسترسی دارد.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={setting.enabled} onChange={(e) => setSetting({ ...setting, enabled: e.target.checked })} />
          روشن برای این فروشگاه
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5 sm:col-span-3">
          <label className="block text-xs font-black text-gray-700 dark:text-gray-300">مدل</label>
          <p className="text-[10px] text-gray-400 leading-5">مدل باید بتواند «ابزار» صدا بزند، وگرنه هیچ داده‌ای نمی‌بیند. بعد از عوض کردن، «تست مدل» را بزنید.</p>
          <select
            value={knownModel ? setting.model : "__other"}
            onChange={(e) => setSetting({ ...setting, model: e.target.value === "__other" ? "" : e.target.value })}
            className={inputClass}
            dir="ltr"
          >
            {ASSISTANT_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            <option value="__other">مدل دیگر (نام دقیق در GapGPT)…</option>
          </select>
          {!knownModel && (
            <input
              value={setting.model}
              onChange={(e) => setSetting({ ...setting, model: e.target.value.trim() })}
              className={inputClass + " mt-2 font-mono text-xs"}
              dir="ltr"
              placeholder="gpt-5-mini"
            />
          )}
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-black text-gray-700 dark:text-gray-300">سقف پرسش روزانه‌ی هر کارمند</label>
          <input type="number" min={0} max={1000} value={setting.dailyLimit}
            onChange={(e) => setSetting({ ...setting, dailyLimit: Number(e.target.value) })} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-black text-gray-700 dark:text-gray-300">سقف طول پاسخ (توکن)</label>
          <input type="number" min={500} max={8000} step={500} value={setting.maxTokens}
            onChange={(e) => setSetting({ ...setting, maxTokens: Number(e.target.value) })} className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-black text-gray-700 dark:text-gray-300">قاعده‌های داخلی فروشگاه (اختیاری)</label>
        <p className="text-[10px] text-gray-400 leading-5">
          دستیار این‌ها را می‌داند، مثلاً «ارسال رایگان برای سفارش بالای ۲ میلیون است» یا «مقاله‌ها با لحن رسمی نوشته شوند».
        </p>
        <textarea value={setting.extraGuide} onChange={(e) => setSetting({ ...setting, extraGuide: e.target.value })}
          rows={3} maxLength={2000} className={inputClass + " leading-6"} />
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-white/[0.06] p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-black text-gray-800 dark:text-gray-200">کارمندان</p>
          <p className="text-[11px] text-gray-400">
            ۳۰ روز اخیر: ≈ {monthCost.toLocaleString("fa-IR", { maximumFractionDigits: 2 })} دلار · 👍 {fa(feedback.up)} · 👎 {fa(feedback.down)}
          </p>
        </div>
        <p className="text-[10px] text-gray-400 leading-5">
          سقف اختصاصی را خالی بگذارید تا همان سقف عمومی بماند. صفر یعنی دستیار برای آن کارمند خاموش است. متن گفتگوها اینجا نمایش داده نمی‌شود.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400">
                <th className="py-1.5 text-right font-bold">نام</th>
                <th className="py-1.5 text-right font-bold">سقف اختصاصی</th>
                <th className="py-1.5 text-right font-bold">امروز</th>
                <th className="py-1.5 text-right font-bold">۳۰ روز</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.userId} className="border-t border-gray-100 dark:border-white/[0.06]">
                  <td className="py-1.5 text-gray-800 dark:text-gray-200">
                    {s.name}
                    {s.roleTitle && <span className="text-gray-400"> · {s.roleTitle}</span>}
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number" min={0} max={1000}
                      value={limits[s.userId] ?? ""}
                      onChange={(e) => setLimits({ ...limits, [s.userId]: e.target.value })}
                      placeholder={fa(setting.dailyLimit)}
                      className={inputClass + " w-24 py-1"}
                    />
                  </td>
                  <td className="py-1.5 text-gray-600 dark:text-gray-400">{fa(s.today)}</td>
                  <td className="py-1.5 text-gray-600 dark:text-gray-400">{fa(s.month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={save} disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow shadow-blue-500/20 disabled:opacity-50 transition-all">
          {saving ? "در حال ذخیره..." : "ذخیره‌ی راهنمای هوشمند"}
        </button>
        <button type="button" onClick={test} disabled={testing || !setting.model}
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all">
          {testing ? "در حال تست..." : "تست مدل"}
        </button>
        {msg && <span className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</span>}
        {setting.updatedByName && <span className="text-[10px] text-gray-400">آخرین تغییر: {setting.updatedByName}</span>}
      </div>
    </div>
  );
}
