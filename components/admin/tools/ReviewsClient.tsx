"use client";

/**
 * درخواست ثبت نظر — تنظیمات سکوها، پیامک، زمان‌بندی و گزارش.
 * docs/features/tools.md بخش ۴
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, QrCode, Send } from "lucide-react";
import type { ReviewSettings } from "@/lib/tools/reviews";
import { Badge, Card, ErrorText, Field, PageHeader, SectionTitle, Segmented, Stat, api, btn, inputCls } from "../accounting/ui";

interface Data {
  settings: ReviewSettings;
  sms: { ready: boolean; reason: string | null };
  publicUrl: string;
  canManage: boolean;
  stats: {
    days: number;
    status: Record<string, number>;
    pendingNow: number;
    opened: number;
    publicClicks: number;
    clicks: Record<string, number>;
    recent: {
      id: string; phone: string; name: string | null; orderNumber: string; status: string; reason: string | null;
      dueAt: string; sentAt: string | null; openedAt: string | null; clicks: number;
    }[];
  };
}

const PLATFORMS = [
  { key: "NESHAN", label: "نشان", field: "neshanUrl", hint: "در اپ نشان، مکان را باز کنید ← اشتراک‌گذاری ← کپی لینک" },
  { key: "BALAD", label: "بلد", field: "baladUrl", hint: "در اپ یا سایت بلد، صفحه‌ی مکان ← اشتراک‌گذاری" },
  { key: "GOOGLE", label: "گوگل‌مپ", field: "googleUrl", hint: "در Google Business Profile ← «درخواست نظر» ← لینک" },
] as const;

const STATUS: Record<string, { label: string; tone: "green" | "red" | "amber" | "gray" | "blue" }> = {
  PENDING: { label: "در صف", tone: "blue" },
  SENT: { label: "ارسال شد", tone: "green" },
  FAILED: { label: "ناموفق", tone: "red" },
  SKIPPED: { label: "کنار گذاشته شد", tone: "gray" },
};

const fa = (n: number) => n.toLocaleString("fa-IR");
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function ReviewsClient() {
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<ReviewSettings | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api<Data>("/api/admin/tools/reviews").then((x) => { setD(x); setS(x.settings); }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

  if (!d || !s) return msg ? <ErrorText>{msg.text}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const set = (p: Partial<ReviewSettings>) => setS({ ...s, ...p });
  const configured = PLATFORMS.filter((p) => s[p.field].trim());
  const nothingToShow = configured.length === 0 && !s.askProducts;
  const domain = d.publicUrl.replace(/^https?:\/\//, "").replace(/\/r\/shop$/, "");
  const patternText =
    s.linkMode === "VARIABLE"
      ? "%name% عزیز، از خریدتان ممنونیم. نظر شما درباره‌ی خرید برای ما مهم است:\n%link%"
      : `%name% عزیز، از خریدتان ممنونیم. نظر شما درباره‌ی خرید برای ما مهم است:\n${domain}/r/shop`;

  function move(i: number, dir: -1 | 1) {
    const o = [...s!.platformOrder];
    const j = i + dir;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    set({ platformOrder: o });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ settings: ReviewSettings }>("/api/admin/tools/reviews", { method: "PUT", json: s });
      setS(r.settings);
      setMsg({ ok: true, text: "✓ ذخیره شد" });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ذخیره نشد" });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTestMsg(null);
    try {
      await api("/api/admin/tools/reviews", { method: "POST", json: { phone: testPhone } });
      setTestMsg({ ok: true, text: "✓ فرستاده شد — گوشی را ببینید" });
    } catch (e) {
      setTestMsg({ ok: false, text: e instanceof Error ? e.message : "ارسال نشد" });
    }
  }

  const st = d.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="درخواست ثبت نظر"
        help="toolsReviews"
        desc="بعد از تحویل سفارش، پیامکی با لینک ثبت نظر در نشان، بلد، گوگل‌مپ و روی محصولاتی که خریده."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ارسال‌شده (۳۰ روز)" value={fa(st.status.SENT ?? 0)} tone="green" />
        <Stat label="باز شده" value={fa(st.opened)} sub={st.status.SENT ? `${Math.round((st.opened / st.status.SENT) * 100).toLocaleString("fa-IR")}٪ از ارسال‌شده‌ها` : undefined} />
        <Stat
          label="کلیک روی سکوها"
          value={fa(Object.values(st.clicks).reduce((a, b) => a + b, 0))}
          sub={[["NESHAN", "نشان"], ["BALAD", "بلد"], ["GOOGLE", "گوگل"], ["SITE", "سایت"]].filter(([k]) => st.clicks[k]).map(([k, l]) => `${l} ${fa(st.clicks[k])}`).join(" · ") || undefined}
        />
        <Stat label="در صف ارسال" value={fa(st.pendingNow)} tone="blue" sub={`لینک عمومی: ${fa(st.publicClicks)} کلیک`} />
      </div>

      <Card className="space-y-4 p-4 sm:p-5">
        <fieldset disabled={!d.canManage} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">ارسال خودکار</p>
              <p className="mt-0.5 text-[11px] leading-5 text-gray-400">
                فقط سفارش‌هایی که <b>بعد از روشن کردن</b> تحویل شوند پیامک می‌گیرند — مشتری‌های قدیمی نه.
              </p>
            </div>
            <Segmented value={s.isEnabled ? "on" : "off"} onChange={(v) => set({ isEnabled: v === "on" })} options={[{ value: "on", label: "روشن" }, { value: "off", label: "خاموش" }]} />
          </div>
          {s.isEnabled && !d.sms.ready && <ErrorText>پیامک ارسال نمی‌شود: {d.sms.reason}. از «پنل پیامک» تنظیمش کنید.</ErrorText>}
          {s.isEnabled && !s.patternCode && <ErrorText>کد پترن خالی است — بدون آن هیچ پیامکی نمی‌رود.</ErrorText>}
          {nothingToShow && <ErrorText>نه آدرس سکویی ثبت شده و نه نظر روی محصولات روشن است؛ صفحه‌ی لینک چیزی برای نشان دادن ندارد.</ErrorText>}

          <SectionTitle title="سکوهای نقشه" />
          <div className="space-y-3">
            {s.platformOrder.map((key, i) => {
              const p = PLATFORMS.find((x) => x.key === key)!;
              return (
                <div key={key} className="flex items-start gap-2">
                  <div className="flex flex-col pt-6">
                    <button className="text-gray-400 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="بالا">
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button className="text-gray-400 disabled:opacity-30" disabled={i === s.platformOrder.length - 1} onClick={() => move(i, 1)} aria-label="پایین">
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <Field label={`آدرس صفحه‌ی مکان در ${p.label} (اختیاری)`} hint={p.hint} className="flex-1">
                    <input className={inputCls} dir="ltr" placeholder="https://…" value={s[p.field]} onChange={(e) => set({ [p.field]: e.target.value } as Partial<ReviewSettings>)} />
                  </Field>
                </div>
              );
            })}
          </div>
          <Field label="نظر روی محصولات سایت" hint="محصولات همان سفارش با دکمه‌ی «ثبت نظر» که مستقیم به زبانه‌ی نظرات صفحه‌ی محصول می‌رود.">
            <Segmented value={s.askProducts ? "on" : "off"} onChange={(v) => set({ askProducts: v === "on" })} options={[{ value: "on", label: "نشان داده شود" }, { value: "off", label: "نه" }]} />
          </Field>

          <SectionTitle title="پیامک" />
          <Field label="روش لینک">
            <Segmented
              value={s.linkMode}
              onChange={(linkMode) => set({ linkMode })}
              options={[{ value: "VARIABLE", label: "لینک اختصاصی (متغیر link)" }, { value: "FIXED", label: "لینک عمومی ثابت در متن" }]}
            />
          </Field>
          <p className="text-[11px] leading-5 text-gray-400">
            {s.linkMode === "VARIABLE"
              ? "هر مشتری لینک خودش را می‌گیرد؛ معلوم است چه کسی باز کرد و کدام سکو را زد، و محصولات همان سفارش نشان داده می‌شوند. اگر سامانه‌ی پیامک «لینک در متغیر» را تأیید نکرد، روش ثابت را انتخاب کنید."
              : "لینک عمومی داخل خود متن پترن است و فقط نام مشتری متغیر است. باز شدن و کلیک به تک‌مشتری نسبت داده نمی‌شود و محصولات سفارش نشان داده نمی‌شوند."}
          </p>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
            <p className="mb-1 text-[11px] font-bold text-gray-500">متن پیشنهادی برای ثبت پترن در ایران پیامک</p>
            <pre className="whitespace-pre-wrap font-[inherit] text-xs leading-6">{patternText}</pre>
            <button className={`${btn.small} mt-2`} onClick={() => { navigator.clipboard?.writeText(patternText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "کپی شد ✓" : "کپی متن"}
            </button>
            <p className="mt-2 text-[11px] leading-5 text-gray-400">متن خنثی بماند: نظرخواستن فقط از مشتری راضی (review gating) خلاف سیاست گوگل است.</p>
          </div>
          <Field label="کد پترن">
            <input className={inputCls} dir="ltr" value={s.patternCode} maxLength={60} onChange={(e) => set({ patternCode: e.target.value })} />
          </Field>

          <SectionTitle title="زمان‌بندی" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="چه وقت «تحویل» حساب شود">
              <Segmented
                value={s.triggerStatus}
                onChange={(triggerStatus) => set({ triggerStatus })}
                options={[{ value: "DELIVERED", label: "تحویل داده شد" }, { value: "COMPLETED", label: "تکمیل شد" }]}
              />
            </Field>
            <Field label="چند ساعت بعد از تحویل" hint="۰ تا ۱۶۸ ساعت">
              <input type="number" min={0} max={168} className={inputCls} value={s.delayHours} onChange={(e) => set({ delayHours: Number(e.target.value) })} />
            </Field>
            <Field label="بازه‌ی مجاز ارسال (ساعت تهران)">
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={23} className={inputCls} value={s.sendFrom} onChange={(e) => set({ sendFrom: Number(e.target.value) })} />
                <span className="text-gray-400">تا</span>
                <input type="number" min={1} max={24} className={inputCls} value={s.sendTo} onChange={(e) => set({ sendTo: Number(e.target.value) })} />
              </div>
            </Field>
            <Field label="هر شماره حداکثر یک‌بار در چند روز">
              <input type="number" min={1} max={365} className={inputCls} value={s.cooldownDays} onChange={(e) => set({ cooldownDays: Number(e.target.value) })} />
            </Field>
          </div>

          <SectionTitle title="متن صفحه‌ی لینک" />
          <div className="grid gap-3">
            <Field label="عنوان">
              <input className={inputCls} value={s.pageTitle} maxLength={120} placeholder="نظر شما برای ما مهم است" onChange={(e) => set({ pageTitle: e.target.value })} />
            </Field>
            <Field label="متن">
              <textarea className={`${inputCls} min-h-[70px]`} value={s.pageMessage} maxLength={500} placeholder="ممنون که از ما خرید کردید…" onChange={(e) => set({ pageMessage: e.target.value })} />
            </Field>
          </div>
        </fieldset>

        {d.canManage && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--adm-border)] pt-4">
            <button className={btn.primary} disabled={saving} onClick={save}>
              {saving ? "در حال ذخیره…" : "ذخیره تنظیمات"}
            </button>
            {msg && <span className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-black">لینک عمومی</p>
          <p className="text-[11px] leading-5 text-gray-400">برای استند پیشخوان، کارت داخل بسته، بیو اینستاگرام و بلوک «ثبت نظر» لندینگ. فقط سکوهای نقشه را نشان می‌دهد.</p>
          <p className="text-sm font-bold text-blue-600" dir="ltr">{d.publicUrl.replace(/^https?:\/\//, "")}</p>
          <div className="flex gap-2">
            <button className={btn.small} onClick={() => navigator.clipboard?.writeText(d.publicUrl)}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              کپی
            </button>
            <Link className={btn.small} href={`/admin/tools/qr?url=${encodeURIComponent(d.publicUrl)}`}>
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              ساخت QR
            </Link>
          </div>
        </Card>
        {d.canManage && (
          <Card className="space-y-2 p-4">
            <p className="text-sm font-black">پیامک آزمایشی</p>
            <p className="text-[11px] leading-5 text-gray-400">با پترن ذخیره‌شده و لینک عمومی به یک شماره — درخواستی ثبت نمی‌شود.</p>
            <div className="flex gap-2">
              <input className={inputCls} dir="ltr" placeholder="09121234567" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
              <button className={btn.dark} onClick={test}>
                <Send className="h-4 w-4" aria-hidden />
                ارسال
              </button>
            </div>
            {testMsg && <p className={`text-xs font-bold ${testMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{testMsg.text}</p>}
          </Card>
        )}
      </div>

      <section>
        <SectionTitle title="آخرین درخواست‌ها" />
        <Card className="overflow-x-auto">
          {st.recent.length === 0 ? (
            <p className="p-4 text-xs text-gray-400">هنوز درخواستی ساخته نشده. بعد از روشن کردن، با تحویل اولین سفارش اینجا دیده می‌شود.</p>
          ) : (
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-right text-gray-500">
                  <th className="p-2.5 font-bold">سفارش</th>
                  <th className="p-2.5 font-bold">مشتری</th>
                  <th className="p-2.5 font-bold">وضعیت</th>
                  <th className="p-2.5 font-bold">زمان</th>
                  <th className="p-2.5 font-bold">باز شد</th>
                  <th className="p-2.5 font-bold">کلیک</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {st.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2.5 tabular-nums">{r.orderNumber}</td>
                    <td className="p-2.5">
                      {r.name ?? "—"} <span className="text-gray-400" dir="ltr">{r.phone}</span>
                    </td>
                    <td className="p-2.5">
                      <Badge tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</Badge>
                      {r.reason && <p className="mt-0.5 text-[10px] text-gray-400">{r.reason}</p>}
                    </td>
                    <td className="p-2.5 text-gray-500">{r.status === "PENDING" ? `نوبت: ${fmt(r.dueAt)}` : fmt(r.sentAt)}</td>
                    <td className="p-2.5 text-gray-500">{fmt(r.openedAt)}</td>
                    <td className="p-2.5 tabular-nums">{fa(r.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}
