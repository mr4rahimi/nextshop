"use client";

/**
 * لینک کوتاه — فهرست، ساخت/ویرایش و آمار.
 *
 * کد پس از ساخت عوض نمی‌شود؛ مقصد، UTM، انقضا و روشن/خاموش بله.
 * لینک‌های پشت QR پویا اینجا نیستند — از بخش کیوآر کد مدیریت می‌شوند.
 *
 * مستندات: docs/features/tools.md بخش ۱
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Copy, Pencil, Plus, QrCode, Search, Trash2 } from "lucide-react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { TARGET_HINT, toTehranDateValue } from "@/lib/tools/common";
import { DEVICE_LABEL } from "@/lib/tools/visitor";
import type { ShortLinkDto } from "@/lib/tools/short-links";
import { Badge, Card, Empty, ErrorText, Field, PageHeader, Segmented, Sheet, Stat, api, btn, inputCls } from "../accounting/ui";
import { useToolsAccess } from "./ToolsShell";

const fa = (n: number) => n.toLocaleString("fa-IR");

interface Form {
  id: string | null;
  code: string;
  title: string;
  targetUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  isActive: boolean;
  expiresOn: string;
}

const emptyForm: Form = {
  id: null, code: "", title: "", targetUrl: "", utmSource: "", utmMedium: "", utmCampaign: "", isActive: true, expiresOn: "",
};

interface Stats {
  link: ShortLinkDto;
  days: number;
  inRange: number;
  daily: { day: string; count: number }[];
  devices: { key: string; count: number }[];
  os: { key: string; count: number }[];
  referrers: { key: string; count: number }[];
  orders: { count: number; total: string } | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export default function LinksClient() {
  const { canManage } = useToolsAccess();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: ShortLinkDto[]; total: number; pageSize: number } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statsOf, setStatsOf] = useState<ShortLinkDto | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (q.trim()) p.set("q", q.trim());
    api<{ items: ShortLinkDto[]; total: number; pageSize: number }>(`/api/admin/tools/links?${p}`).then(setData).catch(() => setData({ items: [], total: 0, pageSize: 30 }));
  }, [page, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openEdit(l: ShortLinkDto) {
    setErr(null);
    setForm({
      id: l.id, code: l.code, title: l.title, targetUrl: l.targetUrl, utmSource: l.utmSource ?? "", utmMedium: l.utmMedium ?? "",
      utmCampaign: l.utmCampaign ?? "", isActive: l.isActive, expiresOn: toTehranDateValue(l.expiresAt),
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setErr(null);
    try {
      const { id, code, ...rest } = form;
      if (id) await api(`/api/admin/tools/links/${id}`, { method: "PATCH", json: rest });
      else await api("/api/admin/tools/links", { method: "POST", json: { ...rest, code } });
      setForm(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: ShortLinkDto) {
    if (!confirm(`لینک /s/${l.code} حذف شود؟\nاگر چاپ یا پخش شده، دیگر باز نمی‌شود. این نامک هم دوباره قابل استفاده نیست.`)) return;
    await api(`/api/admin/tools/links/${l.id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  function doCopy(l: ShortLinkDto) {
    copy(l.shortUrl);
    setCopied(l.id);
    setTimeout(() => setCopied(null), 1500);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="لینک کوتاه"
        help="toolsLinks"
        desc="لینک کوتاه روی دامنه‌ی فروشگاه، با مقصد قابل تغییر و آمار کلیک. ربات‌های پیش‌نمایش تلگرام و واتساپ جدا شمرده می‌شوند."
        actions={
          canManage ? (
            <button className={btn.primary} onClick={() => { setErr(null); setForm({ ...emptyForm }); }}>
              <Plus className="h-4 w-4" aria-hidden />
              لینک تازه
            </button>
          ) : undefined
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input className={`${inputCls} pr-9`} placeholder="جستجو در عنوان، کد یا مقصد" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>

      <Card>
        {!data ? (
          <p className="p-4 text-xs text-gray-400">در حال بارگذاری…</p>
        ) : data.items.length === 0 ? (
          <Empty title={q ? "چیزی پیدا نشد" : "هنوز لینکی ساخته نشده"} desc="برای پست اینستاگرام، پیامک یا بنر یک لینک کوتاه بسازید تا ببینید چند نفر را آورد." />
        ) : (
          <ul className="divide-y divide-[var(--adm-border)]">
            {data.items.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-bold">{l.title}</p>
                    {!l.isActive && <Badge tone="red">خاموش</Badge>}
                    {l.expired && <Badge tone="amber">منقضی</Badge>}
                    {l.utmCampaign && <Badge tone="blue">{l.utmCampaign}</Badge>}
                  </div>
                  <button onClick={() => doCopy(l)} className="mt-0.5 flex items-center gap-1 text-xs font-bold text-blue-600" dir="ltr">
                    <Copy className="h-3 w-3" aria-hidden />
                    {copied === l.id ? "کپی شد ✓" : l.shortUrl.replace(/^https?:\/\//, "")}
                  </button>
                  <p className="mt-0.5 truncate text-[11px] text-gray-400" dir="ltr">
                    → {l.targetUrl}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:w-auto">
                  <div className="text-center">
                    <p className="text-base font-black tabular-nums">{fa(l.clickCount)}</p>
                    <p className="text-[10px] text-gray-400">کلیک</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button className={btn.small} onClick={() => setStatsOf(l)} aria-label="آمار">
                      <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <Link className={btn.small} href={`/admin/tools/qr?url=${encodeURIComponent(l.shortUrl)}`} aria-label="QR این لینک" title="QR ثابت از همین لینک کوتاه">
                      <QrCode className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    {canManage && (
                      <>
                        <button className={btn.small} onClick={() => openEdit(l)} aria-label="ویرایش">
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button className={btn.small} onClick={() => remove(l)} aria-label="حذف">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className={btn.small} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</button>
          <span className="text-xs text-gray-500">{fa(page)} از {fa(pages)}</span>
          <button className={btn.small} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>بعدی</button>
        </div>
      )}

      <Sheet
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "ویرایش لینک کوتاه" : "لینک کوتاه تازه"}
        help="toolsLinks"
        footer={
          <div className="flex gap-2">
            <button className={`${btn.primary} flex-1`} disabled={saving} onClick={save}>
              {saving ? "در حال ذخیره…" : "ذخیره"}
            </button>
            <button className={btn.soft} onClick={() => setForm(null)}>انصراف</button>
          </div>
        }
      >
        {form && (
          <div className="space-y-3">
            <Field label="مقصد" hint={TARGET_HINT}>
              <input className={inputCls} dir="ltr" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} placeholder="https://… یا /products/…" />
            </Field>
            <Field label="عنوان (برای فهرست)">
              <input className={inputCls} value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً پست اینستاگرام تخفیف پاییز" />
            </Field>
            <Field
              label="نامک"
              hint={form.id ? "نامک پس از ساخت عوض نمی‌شود — ممکن است چاپ شده باشد." : "خالی = کد تصادفی ۵ حرفی. فقط حروف کوچک لاتین، عدد و خط تیره. پس از ساخت و حتی حذف، آزاد نمی‌شود."}
            >
              <div className="flex items-center gap-1" dir="ltr">
                <span className="text-xs text-gray-400">/s/</span>
                <input
                  className={inputCls}
                  dir="ltr"
                  disabled={!!form.id}
                  value={form.code}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  placeholder="banner"
                />
              </div>
            </Field>
            <details className="rounded-xl border border-[var(--adm-border)] p-3">
              <summary className="cursor-pointer text-xs font-bold text-gray-600 dark:text-gray-300">UTM — برای دیدن سفارش‌ها در گزارش منبع ورود</summary>
              <p className="mt-2 text-[11px] leading-5 text-gray-400">
                هنگام باز شدن به آدرس مقصد اضافه می‌شوند (اگر مقصد خودش نداشته باشد). وقتی مقصد خود فروشگاه است، سفارش‌هایی که با همین UTM ثبت شوند در آمار همین لینک شمرده می‌شوند.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Field label="source">
                  <input className={inputCls} dir="ltr" value={form.utmSource} onChange={(e) => setForm({ ...form, utmSource: e.target.value })} placeholder="instagram" />
                </Field>
                <Field label="medium">
                  <input className={inputCls} dir="ltr" value={form.utmMedium} onChange={(e) => setForm({ ...form, utmMedium: e.target.value })} placeholder="social" />
                </Field>
                <Field label="campaign">
                  <input className={inputCls} dir="ltr" value={form.utmCampaign} onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })} placeholder="autumn-sale" />
                </Field>
              </div>
            </details>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="تاریخ انقضا (اختیاری)" hint="پایان همان روز؛ بعدش لینک باز نمی‌شود.">
                <JalaliDatePicker value={form.expiresOn} onChange={(v) => setForm({ ...form, expiresOn: v })} />
              </Field>
              <Field label="وضعیت">
                <Segmented
                  value={form.isActive ? "on" : "off"}
                  onChange={(v) => setForm({ ...form, isActive: v === "on" })}
                  options={[{ value: "on", label: "روشن" }, { value: "off", label: "خاموش" }]}
                />
              </Field>
            </div>
            <ErrorText>{err}</ErrorText>
          </div>
        )}
      </Sheet>

      <StatsSheet link={statsOf} onClose={() => setStatsOf(null)} />
    </div>
  );
}

function StatsSheet({ link, onClose }: { link: ShortLinkDto | null; onClose: () => void }) {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const key = link ? `${link.id}:${days}` : "";
  const [loaded, setLoaded] = useState<{ key: string; data: Stats } | null>(null);
  const s = loaded?.key === key ? loaded.data : null;

  useEffect(() => {
    if (!key) return;
    const [id, d] = key.split(":");
    api<Stats>(`/api/admin/tools/links/${id}?days=${d}`).then((data) => setLoaded({ key, data })).catch(() => {});
  }, [key]);

  const max = s ? Math.max(1, ...s.daily.map((x) => x.count)) : 1;

  return (
    <Sheet open={!!link} onClose={onClose} title={link ? `آمار «${link.title}»` : ""} wide>
      <div className="space-y-4">
        <Segmented value={days} onChange={setDays} options={[{ value: "7", label: "۷ روز" }, { value: "30", label: "۳۰ روز" }, { value: "90", label: "۹۰ روز" }]} />
        {!s ? (
          <p className="text-xs text-gray-400">در حال بارگذاری…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="کلیک در بازه" value={fa(s.inRange)} />
              <Stat label="کل کلیک" value={fa(s.link.clickCount)} sub={`آخرین: ${fmtDate(s.link.lastClickedAt)}`} />
              <Stat label="پیش‌نمایش ربات" value={fa(s.link.botCount)} sub="تلگرام، واتساپ و …" />
              {s.orders ? (
                <Stat label="سفارش با همین UTM" value={fa(s.orders.count)} sub={`${Number(s.orders.total).toLocaleString("fa-IR")} تومان`} tone="green" />
              ) : (
                <Stat label="سفارش" value="—" sub="بدون UTM شمرده نمی‌شود" />
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-gray-500">کلیک روزانه</p>
              <div className="flex h-28 items-end gap-[2px] rounded-xl bg-gray-50 p-2 dark:bg-white/5" dir="ltr">
                {s.daily.map((x) => (
                  <div key={x.day} className="group relative flex-1" title={`${new Date(x.day).toLocaleDateString("fa-IR")}: ${fa(x.count)}`}>
                    <div className="w-full rounded-t bg-blue-500/80" style={{ height: `${(x.count / max) * 96}px`, minHeight: x.count ? 2 : 0 }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Breakdown title="دستگاه" rows={s.devices.map((r) => ({ ...r, key: DEVICE_LABEL[r.key] ?? r.key }))} />
              <Breakdown title="سیستم‌عامل" rows={s.os} />
              <Breakdown title="ارجاع‌دهنده" rows={s.referrers} />
            </div>
            <p className="text-[11px] leading-5 text-gray-400">
              کسی که لینک یا QR را می‌بیند و بعد حضوری یا تلفنی خرید می‌کند ردی نمی‌گذارد؛ این آمار فقط مسیر آنلاین را می‌شمارد.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { key: string; count: number }[] }) {
  const total = rows.reduce((a, r) => a + r.count, 0) || 1;
  return (
    <div className="rounded-xl border border-[var(--adm-border)] p-3">
      <p className="mb-2 text-xs font-bold text-gray-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">—</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((r) => (
            <li key={r.key} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate" dir="auto">{r.key}</span>
                <span className="tabular-nums text-gray-500">{fa(r.count)}</span>
              </div>
              <div className="mt-0.5 h-1 rounded bg-gray-100 dark:bg-white/5">
                <div className="h-1 rounded bg-blue-500" style={{ width: `${(r.count / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
