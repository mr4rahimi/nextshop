"use client";

/**
 * «موجود شد خبرم کن» — تنظیمات پیامک، پرتقاضاترین کالاهای ناموجود و آخرین درخواست‌ها.
 * docs/features/tools.md بخش ۷
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, Send } from "lucide-react";
import type { StockAlertSettings } from "@/lib/tools/stock-alerts";
import { Badge, Card, ErrorText, Field, PageHeader, SectionTitle, Segmented, Stat, api, btn, inputCls } from "../accounting/ui";

interface Data {
  settings: StockAlertSettings;
  sms: { ready: boolean; reason: string | null };
  canManage: boolean;
  stats: {
    days: number;
    waiting: number;
    sent: number;
    clicked: number;
    purchased: number;
    failed: number;
    demand: { productId: string; title: string; waiting: number; since: string | null; inStock: boolean; stock: number }[];
    recent: {
      id: string; phone: string; status: string; reason: string | null; productId: string; productTitle: string;
      createdAt: string; notifiedAt: string | null; clickedAt: string | null;
    }[];
  };
}

const STATUS: Record<string, { label: string; tone: "green" | "red" | "amber" | "gray" | "blue" }> = {
  WAITING: { label: "منتظر", tone: "blue" },
  SENT: { label: "خبر داده شد", tone: "green" },
  FAILED: { label: "ناموفق", tone: "red" },
  CANCELLED: { label: "لغو", tone: "gray" },
};

const fa = (n: number) => n.toLocaleString("fa-IR");
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const pct = (a: number, b: number) => (b ? `${fa(Math.round((a / b) * 100))}٪` : "—");

export default function StockAlertsClient() {
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<StockAlertSettings | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api<Data>("/api/admin/tools/stock-alerts").then((x) => { setD(x); setS(x.settings); }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

  if (!d || !s) return msg ? <ErrorText>{msg.text}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const set = (p: Partial<StockAlertSettings>) => setS({ ...s, ...p });
  const patternText =
    s.linkMode === "VARIABLE"
      ? "سلام، «%product%» که منتظرش بودید موجود شد:\n%link%"
      : "سلام، «%product%» که منتظرش بودید موجود شد. برای سفارش به سایت سر بزنید.";

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ settings: StockAlertSettings }>("/api/admin/tools/stock-alerts", { method: "PUT", json: s });
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
      await api("/api/admin/tools/stock-alerts", { method: "POST", json: { phone: testPhone } });
      setTestMsg({ ok: true, text: "✓ فرستاده شد — گوشی را ببینید" });
    } catch (e) {
      setTestMsg({ ok: false, text: e instanceof Error ? e.message : "ارسال نشد" });
    }
  }

  async function cancel(id: string) {
    if (!confirm("این درخواست لغو شود؟ مشتری دیگر پیامک نمی‌گیرد.")) return;
    try {
      await api("/api/admin/tools/stock-alerts", { method: "POST", json: { cancelId: id } });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "لغو نشد");
    }
  }

  const st = d.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="موجود شد خبرم کن"
        help="toolsStockAlerts"
        desc="روی صفحه‌ی کالای ناموجود، مشتری شماره‌اش را می‌گذارد و وقتی کالا موجود شد پیامک می‌گیرد. تعداد منتظرها نشان می‌دهد چه چیزی را دوباره بخرید."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="منتظر موجود شدن" value={fa(st.waiting)} tone="blue" sub={`${fa(st.demand.length)} کالا`} />
        <Stat label="خبر داده شد (۳۰ روز)" value={fa(st.sent)} tone="green" sub={st.failed ? `${fa(st.failed)} ناموفق` : undefined} />
        <Stat label="لینک را باز کرد" value={fa(st.clicked)} sub={`${pct(st.clicked, st.sent)} از پیامک‌ها`} />
        <Stat label="همان کالا را خرید" value={fa(st.purchased)} tone="amber" sub={`${pct(st.purchased, st.sent)} · تا ۷ روز بعد از پیامک`} />
      </div>

      <section>
        <SectionTitle title="پرتقاضاترین کالاهای ناموجود" />
        <p className="-mt-1 mb-2 text-[11px] leading-5 text-gray-400">
          کالاهایی که بیشترین مشتری منتظرشان است — راهنمای خرید از تأمین‌کننده. همین که موجودی کالا بیشتر از صفر شود، پیامک‌ها در اولین نوبت ارسال (هر ۵ دقیقه) می‌روند.
        </p>
        <Card className="overflow-x-auto">
          {st.demand.length === 0 ? (
            <p className="p-4 text-xs text-gray-400">فعلاً کسی منتظر کالایی نیست.</p>
          ) : (
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-right text-gray-500">
                  <th className="p-2.5 font-bold">کالا</th>
                  <th className="p-2.5 font-bold">منتظر</th>
                  <th className="p-2.5 font-bold">از</th>
                  <th className="p-2.5 font-bold">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {st.demand.map((x) => (
                  <tr key={x.productId}>
                    <td className="p-2.5">
                      <Link href={`/admin/products/${x.productId}`} className="font-bold hover:text-blue-600">{x.title}</Link>
                    </td>
                    <td className="p-2.5 font-black tabular-nums">{fa(x.waiting)}</td>
                    <td className="p-2.5 text-gray-500">{fmt(x.since)}</td>
                    <td className="p-2.5">
                      {x.inStock ? <Badge tone="green">موجود شد — در نوبت ارسال</Badge> : <Badge tone="gray">ناموجود</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <Card className="space-y-4 p-4 sm:p-5">
        <fieldset disabled={!d.canManage} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">فرم و ارسال خودکار</p>
              <p className="mt-0.5 text-[11px] leading-5 text-gray-400">
                با روشن کردن، روی صفحه‌ی کالاهایی که موجودی‌شان صفر است فرم «موجود شد خبرم کن» جای دکمه‌ی خرید را می‌گیرد.
              </p>
            </div>
            <Segmented value={s.isEnabled ? "on" : "off"} onChange={(v) => set({ isEnabled: v === "on" })} options={[{ value: "on", label: "روشن" }, { value: "off", label: "خاموش" }]} />
          </div>
          {s.isEnabled && !d.sms.ready && <ErrorText>پیامک ارسال نمی‌شود: {d.sms.reason}. درخواست‌ها ثبت می‌شوند ولی تا تنظیم پیامک کسی خبردار نمی‌شود.</ErrorText>}
          {s.isEnabled && !s.patternCode && <ErrorText>کد پترن خالی است — درخواست‌ها ثبت می‌شوند ولی پیامکی نمی‌رود.</ErrorText>}

          <Field label="لینک در پیامک">
            <Segmented
              value={s.linkMode}
              onChange={(linkMode) => set({ linkMode })}
              options={[{ value: "VARIABLE", label: "لینک کوتاه کالا (متغیر link)" }, { value: "NONE", label: "بدون لینک" }]}
            />
          </Field>
          <p className="text-[11px] leading-5 text-gray-400">
            {s.linkMode === "VARIABLE"
              ? "لینکی کوتاه مثل 9dm.ir/n/ab3k7x که مستقیم صفحه‌ی همان کالا را باز می‌کند و کلیکش شمرده می‌شود."
              : "فقط نام کالا فرستاده می‌شود؛ اگر سامانه‌ی پیامک «لینک در متغیر» را تأیید نکرد."}
          </p>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
            <p className="mb-1 text-[11px] font-bold text-gray-500">متن پیشنهادی برای ثبت پترن در ایران پیامک</p>
            <pre className="whitespace-pre-wrap font-[inherit] text-xs leading-6">{patternText}</pre>
            <button className={`${btn.small} mt-2`} onClick={() => { navigator.clipboard?.writeText(patternText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "کپی شد ✓" : "کپی متن"}
            </button>
            <p className="mt-2 text-[11px] leading-5 text-gray-400">نام کالا اگر بلندتر از ۴۰ نویسه باشد کوتاه می‌شود.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="کد پترن">
              <input className={inputCls} dir="ltr" value={s.patternCode} maxLength={60} onChange={(e) => set({ patternCode: e.target.value })} />
            </Field>
            <Field label="بازه‌ی مجاز ارسال (ساعت تهران)" hint="بیرون از بازه، پیامک تا باز شدن بازه صبر می‌کند">
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={23} className={inputCls} value={s.sendFrom} onChange={(e) => set({ sendFrom: Number(e.target.value) })} />
                <span className="text-gray-400">تا</span>
                <input type="number" min={1} max={24} className={inputCls} value={s.sendTo} onChange={(e) => set({ sendTo: Number(e.target.value) })} />
              </div>
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

      {d.canManage && (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-black">پیامک آزمایشی</p>
          <p className="text-[11px] leading-5 text-gray-400">با پترن ذخیره‌شده، نام «کالای آزمایشی» و لینک صفحه‌ی اصلی سایت.</p>
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
        <SectionTitle title="آخرین درخواست‌ها" />
        <Card className="overflow-x-auto">
          {st.recent.length === 0 ? (
            <p className="p-4 text-xs text-gray-400">هنوز درخواستی ثبت نشده.</p>
          ) : (
            <table className="w-full min-w-[680px] text-xs">
              <thead>
                <tr className="text-right text-gray-500">
                  <th className="p-2.5 font-bold">کالا</th>
                  <th className="p-2.5 font-bold">موبایل</th>
                  <th className="p-2.5 font-bold">ثبت</th>
                  <th className="p-2.5 font-bold">وضعیت</th>
                  <th className="p-2.5 font-bold">کلیک</th>
                  <th className="p-2.5 font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {st.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-[240px] truncate p-2.5">{r.productTitle}</td>
                    <td className="p-2.5 text-gray-500" dir="ltr">{r.phone}</td>
                    <td className="p-2.5 text-gray-500">{fmt(r.createdAt)}</td>
                    <td className="p-2.5">
                      <Badge tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</Badge>
                      {r.notifiedAt && <span className="mr-1 text-[10px] text-gray-400">{fmt(r.notifiedAt)}</span>}
                      {r.reason && <p className="mt-0.5 text-[10px] text-gray-400">{r.reason}</p>}
                    </td>
                    <td className="p-2.5 text-gray-500">{fmt(r.clickedAt)}</td>
                    <td className="p-2.5">
                      {d.canManage && r.status === "WAITING" && (
                        <button className="text-[11px] font-bold text-red-500 hover:text-red-700" onClick={() => cancel(r.id)}>لغو</button>
                      )}
                    </td>
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
