"use client";

/**
 * یادآوری سبد رهاشده — تنظیمات پیامک و کد تخفیف، گزارش، و سبدهای باز همین حالا.
 * docs/plans/store-tools-2.md بخش ۱
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, PhoneCall, Send } from "lucide-react";
import type { CartRecoverySettings } from "@/lib/tools/cart-recovery";
import { Badge, Card, ErrorText, Field, PageHeader, SectionTitle, Segmented, Stat, api, btn, inputCls } from "../accounting/ui";

interface Data {
  settings: CartRecoverySettings;
  sms: { ready: boolean; reason: string | null };
  cartUrl: string;
  canManage: boolean;
  stats: {
    days: number;
    status: Record<string, number>;
    sent: number;
    opened: number;
    recoveredTotal: number;
    couponsIssued: number;
    couponsUsed: number;
    pendingNow: number;
    recent: {
      id: string; phone: string; name: string | null; status: string; reason: string | null; cartTotal: number; items: number;
      createdAt: string; sentAt: string | null; openedAt: string | null; couponCode: string | null;
      recoveredTotal: number | null; orderNumber: string | null;
    }[];
  };
  openCarts: {
    cartId: string; name: string | null; phone: string; items: number; qty: number; total: number; titles: string[]; activityAt: string;
  }[];
}

const STATUS: Record<string, { label: string; tone: "green" | "red" | "amber" | "gray" | "blue" }> = {
  PENDING: { label: "در صف", tone: "blue" },
  SENT: { label: "ارسال شد", tone: "amber" },
  RECOVERED: { label: "خرید کرد", tone: "green" },
  FAILED: { label: "ناموفق", tone: "red" },
  SKIPPED: { label: "کنار گذاشته شد", tone: "gray" },
};

const fa = (n: number) => n.toLocaleString("fa-IR");
const toman = (n: number) => `${fa(n)} تومان`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const pct = (a: number, b: number) => (b ? `${fa(Math.round((a / b) * 100))}٪` : "—");

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${fa(m)} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 48) return `${fa(h)} ساعت پیش`;
  return `${fa(Math.round(h / 24))} روز پیش`;
}

export default function CartRecoveryClient() {
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<CartRecoverySettings | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api<Data>("/api/admin/tools/cart-recovery").then((x) => { setD(x); setS(x.settings); }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

  if (!d || !s) return msg ? <ErrorText>{msg.text}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const set = (p: Partial<CartRecoverySettings>) => setS({ ...s, ...p });
  const domainCart = d.cartUrl.replace(/^https?:\/\//, "");
  const link = s.linkMode === "VARIABLE" ? "%link%" : domainCart;
  const patternText = s.couponEnabled
    ? `%name% عزیز، چند کالا در سبد خریدتان منتظر شماست. با کد %code% تا ${fa(s.couponValidHours)} ساعت تخفیف دارید:\n${link}\nلغو۱۱`
    : `%name% عزیز، چند کالا در سبد خریدتان منتظر شماست. برای تکمیل خرید:\n${link}\nلغو۱۱`;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ settings: CartRecoverySettings }>("/api/admin/tools/cart-recovery", { method: "PUT", json: s });
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
      await api("/api/admin/tools/cart-recovery", { method: "POST", json: { phone: testPhone } });
      setTestMsg({ ok: true, text: "✓ فرستاده شد — گوشی را ببینید" });
    } catch (e) {
      setTestMsg({ ok: false, text: e instanceof Error ? e.message : "ارسال نشد" });
    }
  }

  const st = d.stats;
  const recovered = st.status.RECOVERED ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="یادآوری سبد رهاشده"
        help="toolsCartRecovery"
        desc="به مشتری‌ای که کالا در سبد گذاشته و خرید نکرده، پیامکی با لینک بازگشت به سبد و در صورت تمایل یک کد تخفیف شخصی می‌رود."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ارسال‌شده (۳۰ روز)" value={fa(st.sent)} tone="blue" sub={st.pendingNow ? `${fa(st.pendingNow)} در صف` : undefined} />
        <Stat label="لینک را باز کرد" value={fa(st.opened)} sub={`${pct(st.opened, st.sent)} از ارسال‌شده‌ها`} />
        <Stat label="بعد از پیامک خرید کرد" value={fa(recovered)} tone="green" sub={`${pct(recovered, st.sent)} · ${toman(st.recoveredTotal)}`} />
        <Stat
          label="کد تخفیف استفاده‌شده"
          value={fa(st.couponsUsed)}
          tone="amber"
          sub={st.couponsIssued ? `از ${fa(st.couponsIssued)} کد صادرشده` : "کدی صادر نشده"}
        />
      </div>

      <Card className="space-y-4 p-4 sm:p-5">
        <fieldset disabled={!d.canManage} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">ارسال خودکار</p>
              <p className="mt-0.5 text-[11px] leading-5 text-gray-400">
                فقط سبدهایی که <b>بعد از روشن کردن</b> تغییر کنند یادآوری می‌گیرند. سبد مهمان (بدون ورود) شماره ندارد و پوشش داده نمی‌شود.
              </p>
            </div>
            <Segmented value={s.isEnabled ? "on" : "off"} onChange={(v) => set({ isEnabled: v === "on" })} options={[{ value: "on", label: "روشن" }, { value: "off", label: "خاموش" }]} />
          </div>
          {s.isEnabled && !d.sms.ready && <ErrorText>پیامک ارسال نمی‌شود: {d.sms.reason}. از «پنل پیامک» تنظیمش کنید.</ErrorText>}
          {s.isEnabled && !s.patternCode && <ErrorText>کد پترن خالی است — بدون آن هیچ پیامکی نمی‌رود.</ErrorText>}

          <SectionTitle title="چه سبدی رهاشده است" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="چند دقیقه بی‌تغییر بماند" hint="۳۰ دقیقه تا ۳ روز — پیش‌فرض ۲ ساعت">
              <input type="number" min={30} max={4320} className={inputCls} value={s.delayMinutes} onChange={(e) => set({ delayMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="حداقل مبلغ سبد (تومان)" hint="۰ یعنی هر سبدی">
              <input type="number" min={0} className={inputCls} value={s.minCartTotal} onChange={(e) => set({ minCartTotal: Number(e.target.value) })} />
            </Field>
            <Field label="بازه‌ی مجاز ارسال (ساعت تهران)" hint="بیرون از بازه در صف می‌ماند">
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={23} className={inputCls} value={s.sendFrom} onChange={(e) => set({ sendFrom: Number(e.target.value) })} />
                <span className="text-gray-400">تا</span>
                <input type="number" min={1} max={24} className={inputCls} value={s.sendTo} onChange={(e) => set({ sendTo: Number(e.target.value) })} />
              </div>
            </Field>
            <Field label="هر شماره حداکثر یک‌بار در چند روز">
              <input type="number" min={1} max={90} className={inputCls} value={s.cooldownDays} onChange={(e) => set({ cooldownDays: Number(e.target.value) })} />
            </Field>
          </div>

          <SectionTitle title="کد تخفیف" />
          <Field label="کد تخفیف شخصی در پیامک" hint="برای هر پیامک یک کد تازه ساخته می‌شود که فقط همان مشتری، فقط یک‌بار و تا مهلت تعیین‌شده می‌تواند استفاده کند.">
            <Segmented value={s.couponEnabled ? "on" : "off"} onChange={(v) => set({ couponEnabled: v === "on" })} options={[{ value: "off", label: "بدون تخفیف" }, { value: "on", label: "با کد تخفیف" }]} />
          </Field>
          {s.couponEnabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نوع تخفیف">
                <Segmented value={s.couponType} onChange={(couponType) => set({ couponType })} options={[{ value: "PERCENT", label: "درصدی" }, { value: "FIXED", label: "مبلغ ثابت" }]} />
              </Field>
              <Field label={s.couponType === "PERCENT" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}>
                <input type="number" min={1} max={s.couponType === "PERCENT" ? 100 : undefined} className={inputCls} value={s.couponValue} onChange={(e) => set({ couponValue: Number(e.target.value) })} />
              </Field>
              {s.couponType === "PERCENT" && (
                <Field label="سقف تخفیف (تومان)" hint="۰ یعنی بی‌سقف">
                  <input type="number" min={0} className={inputCls} value={s.couponMaxDiscount} onChange={(e) => set({ couponMaxDiscount: Number(e.target.value) })} />
                </Field>
              )}
              <Field label="مهلت استفاده (ساعت از ارسال)">
                <input type="number" min={1} max={720} className={inputCls} value={s.couponValidHours} onChange={(e) => set({ couponValidHours: Number(e.target.value) })} />
              </Field>
            </div>
          )}
          {s.couponEnabled && (
            <p className="text-[11px] leading-5 text-gray-400">
              اگر مشتری‌ها یاد بگیرند که رها کردن سبد تخفیف می‌آورد، عمداً صبر می‌کنند. تخفیف کم و مهلت کوتاه بهتر است؛ «هر شماره یک‌بار در چند روز» هم جلویش را می‌گیرد.
            </p>
          )}

          <SectionTitle title="پیامک" />
          <Field label="روش لینک">
            <Segmented
              value={s.linkMode}
              onChange={(linkMode) => set({ linkMode })}
              options={[{ value: "VARIABLE", label: "لینک اختصاصی (متغیر link)" }, { value: "FIXED", label: "لینک ثابت سبد در متن" }]}
            />
          </Field>
          <p className="text-[11px] leading-5 text-gray-400">
            {s.linkMode === "VARIABLE"
              ? "هر مشتری لینک خودش را می‌گیرد: کالاهای سبدش را حتی روی گوشی‌ای که وارد نشده می‌بیند و با یک دکمه به سبد برمی‌گرداند، و معلوم است چه کسی لینک را باز کرد."
              : "لینک صفحه‌ی سبد داخل خود متن پترن است. مشتری باید روی همان گوشی وارد حسابش باشد تا سبدش را ببیند، و باز شدن لینک شمرده نمی‌شود."}
          </p>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
            <p className="mb-1 text-[11px] font-bold text-gray-500">متن پیشنهادی برای ثبت پترن در ایران پیامک</p>
            <pre className="whitespace-pre-wrap font-[inherit] text-xs leading-6">{patternText}</pre>
            <button className={`${btn.small} mt-2`} onClick={() => { navigator.clipboard?.writeText(patternText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "کپی شد ✓" : "کپی متن"}
            </button>
            <p className="mt-2 text-[11px] leading-5 text-gray-400">
              متغیرها: name{s.linkMode === "VARIABLE" ? "، link" : ""}{s.couponEnabled ? "، code" : ""}. با روشن یا خاموش کردن تخفیف، پترن هم باید عوض شود.
            </p>
          </div>
          <Field label="کد پترن">
            <input className={inputCls} dir="ltr" value={s.patternCode} maxLength={60} onChange={(e) => set({ patternCode: e.target.value })} />
          </Field>
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

      {d.canManage && (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-black">پیامک آزمایشی</p>
          <p className="text-[11px] leading-5 text-gray-400">
            با پترن ذخیره‌شده، لینک صفحه‌ی سبد{s.couponEnabled ? " و کد نمونه‌ی CRTEST (کد واقعی نیست)" : ""} — یادآوری‌ای ثبت نمی‌شود.
          </p>
          <div className="flex max-w-md gap-2">
            <input className={inputCls} dir="ltr" placeholder="09121234567" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            <button className={btn.dark} onClick={test}>
              <Send className="h-4 w-4" aria-hidden />
              ارسال
            </button>
          </div>
          {testMsg && <p className={`text-xs font-bold ${testMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{testMsg.text}</p>}
        </Card>
      )}

      <section>
        <SectionTitle title="سبدهای باز همین حالا" />
        <p className="-mt-1 mb-2 text-[11px] leading-5 text-gray-400">
          مشتری‌های واردشده‌ای که کالا در سبد دارند و هنوز سفارش نداده‌اند — تازه‌ترین اول. حتی وقتی ارسال خودکار خاموش است، تیم فروش می‌تواند تلفنی پیگیری کند.
        </p>
        <Card className="overflow-x-auto">
          {d.openCarts.length === 0 ? (
            <p className="p-4 text-xs text-gray-400">الان سبد بازی نیست.</p>
          ) : (
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-right text-gray-500">
                  <th className="p-2.5 font-bold">مشتری</th>
                  <th className="p-2.5 font-bold">کالاها</th>
                  <th className="p-2.5 font-bold">مبلغ</th>
                  <th className="p-2.5 font-bold">آخرین تغییر</th>
                  <th className="p-2.5 font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {d.openCarts.map((c) => (
                  <tr key={c.cartId}>
                    <td className="p-2.5">
                      {c.name ?? "—"} <span className="text-gray-400" dir="ltr">{c.phone}</span>
                    </td>
                    <td className="max-w-[260px] p-2.5">
                      <p className="truncate">{c.titles.join("، ")}{c.items > c.titles.length ? ` و ${fa(c.items - c.titles.length)} کالای دیگر` : ""}</p>
                      <p className="text-[10px] text-gray-400">{fa(c.qty)} عدد</p>
                    </td>
                    <td className="p-2.5 tabular-nums">{toman(c.total)}</td>
                    <td className="p-2.5 text-gray-500">{ago(c.activityAt)}</td>
                    <td className="p-2.5">
                      <div className="flex gap-1.5">
                        <a className={btn.small} href={`tel:${c.phone}`}>
                          <PhoneCall className="h-3.5 w-3.5" aria-hidden />
                          تماس
                        </a>
                        <Link className={btn.small} href={`/admin/club/members?q=${encodeURIComponent(c.phone)}`}>پرونده</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle title="آخرین یادآوری‌ها" />
        <p className="-mt-1 mb-2 text-[11px] leading-5 text-gray-400">
          «خرید کرد» یعنی تا ۷ روز بعد از پیامک سفارش ثبت کرده — بعضی‌ها بدون پیامک هم برمی‌گشتند، پس این عدد سقف اثر پیامک است نه دقیقاً خود آن.
        </p>
        <Card className="overflow-x-auto">
          {st.recent.length === 0 ? (
            <p className="p-4 text-xs text-gray-400">هنوز یادآوری‌ای ساخته نشده. بعد از روشن کردن، اولین سبد رهاشده اینجا دیده می‌شود.</p>
          ) : (
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="text-right text-gray-500">
                  <th className="p-2.5 font-bold">مشتری</th>
                  <th className="p-2.5 font-bold">سبد</th>
                  <th className="p-2.5 font-bold">وضعیت</th>
                  <th className="p-2.5 font-bold">ارسال</th>
                  <th className="p-2.5 font-bold">باز شد</th>
                  <th className="p-2.5 font-bold">کد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {st.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2.5">
                      {r.name ?? "—"} <span className="text-gray-400" dir="ltr">{r.phone}</span>
                    </td>
                    <td className="p-2.5 tabular-nums">
                      {toman(r.cartTotal)} <span className="text-gray-400">· {fa(r.items)} کالا</span>
                    </td>
                    <td className="p-2.5">
                      <Badge tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</Badge>
                      {r.reason && <p className="mt-0.5 text-[10px] text-gray-400">{r.reason}</p>}
                      {r.status === "RECOVERED" && (
                        <p className="mt-0.5 text-[10px] text-emerald-600">
                          {r.orderNumber ? `سفارش ${r.orderNumber} · ` : ""}{toman(r.recoveredTotal ?? 0)}
                        </p>
                      )}
                    </td>
                    <td className="p-2.5 text-gray-500">{r.status === "PENDING" ? "در صف" : fmt(r.sentAt)}</td>
                    <td className="p-2.5 text-gray-500">{fmt(r.openedAt)}</td>
                    <td className="p-2.5 tabular-nums" dir="ltr">{r.couponCode ?? "—"}</td>
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
