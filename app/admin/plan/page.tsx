"use client";

/**
 * «بسته‌ی من» — بسته‌ی گردانوس، انقضا، امکانات و ثبت لایسنس تازه.
 * docs/plans/licensing.md
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { Badge, Card, ErrorText, PageHeader, SectionTitle, Stat, btn, inputCls } from "@/components/admin/accounting/ui";
import { FEATURE_LABELS, type FeatureKey } from "@/lib/plan/features";
import { formatJalali } from "@/lib/club/jalali";

interface PlanInfo {
  status: "none" | "active" | "grace" | "expired" | "invalid";
  error: string | null;
  plan: { name: string; business: string; domain: string; issuedAt: string; expiresAt: string | null } | null;
  daysLeft: number | null;
  graceLeft: number | null;
  seats: number;
  activeAdmins: number;
  features: { key: FeatureKey; label: string; description: string; included: boolean }[];
}

const PANEL_URL = "https://panel.gardanos.ir";
const fa = (n: number) => n.toLocaleString("fa-IR");

const STATUS: Record<PlanInfo["status"], { label: string; tone: "green" | "amber" | "red" | "blue" }> = {
  none: { label: "همه‌ی امکانات", tone: "blue" },
  active: { label: "فعال", tone: "green" },
  grace: { label: "مهلت تمدید", tone: "amber" },
  expired: { label: "منقضی", tone: "red" },
  invalid: { label: "نامعتبر", tone: "red" },
};

export default function PlanPage() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/plan").then((r) => (r.ok ? r.json() : null)).then(setInfo).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- پارامتر آدرس فقط بعد از mount در دسترس است
    setLocked(new URLSearchParams(window.location.search).get("locked"));
  }, [load]);

  async function save() {
    setSaving(true);
    setErr(null);
    setDone(false);
    const r = await fetch("/api/admin/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) return setErr(d.error ?? "ثبت نشد");
    setDone(true);
    setToken("");
    load();
  }

  const st = info ? STATUS[info.status] : null;
  const lockedLabel = locked ? FEATURE_LABELS[locked as FeatureKey] ?? locked : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-6">
      <PageHeader
        title="بسته‌ی من"
        help="plan"
        desc="بسته‌ی گردانوس این فروشگاه، تاریخ تمدید و امکاناتی که در آن است."
        actions={
          <a href={PANEL_URL} target="_blank" rel="noreferrer" className={btn.primary}>
            تمدید یا ارتقا در پنل گردانوس
          </a>
        }
      />

      {lockedLabel && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          «{lockedLabel}» در بسته‌ی فعلی شما نیست. برای استفاده از آن، بسته را در پنل گردانوس ارتقا دهید و لایسنس تازه را پایین همین صفحه ثبت کنید.
        </div>
      )}

      {info && st && (
        <>
          {info.error && <ErrorText>{info.error}</ErrorText>}
          {info.status === "grace" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              بسته‌ی شما منقضی شده. {fa(info.graceLeft ?? 0)} روز تا محدود شدن پنل مانده؛ فروشگاه شما در هر حال باز می‌ماند.
            </div>
          )}
          {info.status === "expired" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              مهلت تمدید تمام شده و پنل فقط بخش‌های پایه را باز می‌کند. فروشگاه شما باز است و هیچ داده‌ای پاک نشده؛ با تمدید همه‌چیز برمی‌گردد.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="بسته" value={info.plan?.name ?? "کامل"} />
            <Stat label="وضعیت" value={<Badge tone={st.tone}>{st.label}</Badge>} />
            <Stat
              label="تمدید بعدی"
              value={info.plan?.expiresAt ? formatJalali(new Date(info.plan.expiresAt)) : "بی‌انقضا"}
              sub={info.daysLeft !== null && info.daysLeft > 0 ? `${fa(info.daysLeft)} روز مانده` : undefined}
            />
            <Stat
              label="کاربران پنل"
              value={info.seats ? `${fa(info.activeAdmins)} از ${fa(info.seats)}` : "نامحدود"}
            />
          </div>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="امکانات" />
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {info.features.map((f) => (
                <li
                  key={f.key}
                  className={`flex items-start gap-2.5 rounded-xl border border-[var(--adm-border)] p-3 ${f.included ? "" : "opacity-60"}`}
                >
                  {f.included ? (
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                  )}
                  <span>
                    <span className="block text-sm font-bold text-gray-900 dark:text-white">{f.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{f.description}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              فروشگاه، سفارش‌ها، محصولات، محتوا، سئو، پیامک و کد تخفیف در همه‌ی بسته‌ها هست.
            </p>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="ثبت لایسنس تازه" />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              بعد از تمدید یا ارتقا، متن لایسنس را از پنل گردانوس کپی کنید و اینجا بچسبانید.
            </p>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={3}
              dir="ltr"
              className={`${inputCls} mt-3 font-mono text-xs`}
              placeholder="GL1.…"
            />
            {err && <ErrorText>{err}</ErrorText>}
            {done && <p className="mt-2 text-xs font-bold text-emerald-600">لایسنس ثبت شد.</p>}
            <button onClick={save} disabled={saving || !token.trim()} className={`${btn.dark} mt-3`}>
              {saving ? "در حال ثبت…" : "ثبت لایسنس"}
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
