"use client";

/**
 * پاپ‌آپ سایت — فهرست با آمار، ویرایشگر با پیش‌نمایش موبایل/دسکتاپ و شماره‌های ثبت‌شده.
 * docs/features/tools.md بخش ۹
 */

import { useCallback, useEffect, useState } from "react";
import { Download, ImagePlus, Monitor, Pencil, Plus, Smartphone, Trash2, Users } from "lucide-react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import PopupView from "@/components/tools/PopupView";
import type { PopupAdmin } from "@/lib/tools/popups";
import type { PopupContent } from "@/lib/tools/popup-rules";
import { Badge, Card, Empty, ErrorText, Field, PageHeader, Segmented, Sheet, api, btn, inputCls } from "../accounting/ui";
import { useToolsAccess } from "./ToolsShell";

const fa = (n: number) => n.toLocaleString("fa-IR");
const pct = (a: number, b: number) => (b ? `${fa(Math.round((a / b) * 1000) / 10)}٪` : "—");

const TRIGGER_LABEL = { DELAY: "بعد از چند ثانیه", SCROLL: "بعد از اسکرول", EXIT: "هنگام خروج (دسکتاپ)" } as const;
const PAGES_LABEL = { ALL: "همه‌ی صفحه‌ها", HOME: "فقط صفحه‌ی اصلی", PRODUCT: "صفحه‌های محصول", CATEGORY: "صفحه‌های دسته", CUSTOM: "صفحه‌های مشخص" } as const;
const FREQ_LABEL = { SESSION: "یک‌بار در هر بازدید", DAY: "حداکثر روزی یک‌بار", WEEK: "حداکثر هفته‌ای یک‌بار", ONCE: "فقط یک‌بار برای همیشه" } as const;
const DEFAULT_CONSENT = "با دریافت پیامک تخفیف‌ها و جشنواره‌ها موافقم";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(d.error ?? "آپلود نشد");
  return d.url as string;
}

export default function PopupsClient() {
  const { canManage } = useToolsAccess();
  const [items, setItems] = useState<PopupAdmin[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<PopupAdmin | null>(null);
  const [leadsOf, setLeadsOf] = useState<PopupAdmin | null>(null);

  const load = useCallback(() => {
    api<{ items: PopupAdmin[] }>("/api/admin/tools/popups").then((x) => setItems(x.items)).catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  async function create(kind: "ANNOUNCE" | "LEAD") {
    try {
      const p = await api<PopupAdmin>("/api/admin/tools/popups", {
        method: "POST",
        json: kind === "LEAD"
          ? { name: "جمع‌کردن شماره", kind, content: { heading: "۱۰٪ تخفیف اولین خرید", body: "شماره‌تان را بگذارید تا کد تخفیف را همین‌جا ببینید.", buttonText: "دریافت کد", successText: "کد تخفیف شما:", consentText: DEFAULT_CONSENT } }
          : { name: "اعلان تازه", kind, content: { heading: "", body: "", buttonText: "" } },
      });
      setEditing(p);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "ساخته نشد");
    }
  }

  async function remove(p: PopupAdmin) {
    if (!confirm(`پاپ‌آپ «${p.name}» حذف شود؟ آمار و شماره‌هایش هم دیگر دیده نمی‌شود.`)) return;
    await api(`/api/admin/tools/popups/${p.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="پاپ‌آپ"
        help="toolsPopups"
        desc="پیام یا فرم جمع‌کردن شماره که بعد از چند ثانیه، با اسکرول یا هنگام خروج روی صفحه‌های سایت باز می‌شود — با آمار نمایش، کلیک و ثبت."
        actions={
          canManage ? (
            <div className="flex gap-2">
              <button className={btn.soft} onClick={() => create("LEAD")}>
                <Users className="h-4 w-4" aria-hidden />
                جمع‌کردن شماره
              </button>
              <button className={btn.primary} onClick={() => create("ANNOUNCE")}>
                <Plus className="h-4 w-4" aria-hidden />
                پاپ‌آپ اعلان
              </button>
            </div>
          ) : undefined
        }
      />

      {err && <ErrorText>{err}</ErrorText>}
      {items === null && !err && <p className="text-xs text-gray-400">در حال بارگذاری…</p>}
      {items?.length === 0 && (
        <Empty title="هنوز پاپ‌آپی نساخته‌اید" desc="برای اعلان حراج، معرفی محصول تازه یا گرفتن شماره با کد تخفیف خوش‌آمد." />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items?.map((p) => (
          <Card key={p.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{p.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-400">{p.content.heading || "بدون عنوان"}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Badge tone={p.kind === "LEAD" ? "amber" : "blue"}>{p.kind === "LEAD" ? "شماره" : "اعلان"}</Badge>
                <Badge tone={p.isActive ? "green" : "gray"}>{p.isActive ? "روشن" : "خاموش"}</Badge>
              </div>
            </div>
            <p className="text-[11px] leading-5 text-gray-500">
              {TRIGGER_LABEL[p.trigger]}{p.trigger === "DELAY" ? ` (${fa(p.triggerValue)} ثانیه)` : p.trigger === "SCROLL" ? ` (${fa(p.triggerValue)}٪)` : ""} · {PAGES_LABEL[p.pages]} · {FREQ_LABEL[p.frequency]}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                <p className="text-[10px] text-gray-400">نمایش</p>
                <p className="font-black tabular-nums">{fa(p.viewCount)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                <p className="text-[10px] text-gray-400">{p.kind === "LEAD" ? "ثبت شماره" : "کلیک"}</p>
                <p className="font-black tabular-nums">{fa(p.kind === "LEAD" ? p.leadCount : p.clickCount)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                <p className="text-[10px] text-gray-400">نرخ</p>
                <p className="font-black tabular-nums">{pct(p.kind === "LEAD" ? p.leadCount : p.clickCount, p.viewCount)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button className={btn.small} onClick={() => setEditing(p)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {canManage ? "ویرایش" : "مشاهده"}
              </button>
              {p.kind === "LEAD" && (
                <button className={btn.small} onClick={() => setLeadsOf(p)}>
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  شماره‌ها
                </button>
              )}
              {canManage && (
                <button className={`${btn.small} text-red-600`} onClick={() => remove(p)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  حذف
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {editing && <PopupEditor key={editing.id} popup={editing} canManage={canManage} onClose={() => setEditing(null)} onSaved={load} />}
      {leadsOf && <LeadsSheet popup={leadsOf} onClose={() => setLeadsOf(null)} />}
    </div>
  );
}

function PopupEditor({ popup, canManage, onClose, onSaved }: { popup: PopupAdmin; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState<PopupAdmin>(popup);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = (x: Partial<PopupAdmin>) => setP((s) => ({ ...s, ...x }));
  const setC = (x: Partial<PopupContent>) => setP((s) => ({ ...s, content: { ...s.content, ...x } }));
  const lead = p.kind === "LEAD";

  async function save(activate?: boolean) {
    setSaving(true);
    setMsg(null);
    const body = { ...p, isActive: activate ?? p.isActive };
    try {
      const r = await api<{ ok: boolean; popup?: PopupAdmin; error?: string }>(`/api/admin/tools/popups/${p.id}`, { method: "PUT", json: body });
      if (!r.ok || !r.popup) {
        setMsg({ ok: false, text: r.error ?? "ذخیره نشد" });
        return;
      }
      setP(r.popup);
      setMsg({ ok: true, text: r.popup.isActive ? "✓ ذخیره شد و روی سایت روشن است (تا یک دقیقه طول می‌کشد)" : "✓ ذخیره شد" });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ذخیره نشد" });
    } finally {
      setSaving(false);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try {
      setC({ imageUrl: await uploadImage(f) });
    } catch (e) {
      alert(e instanceof Error ? e.message : "آپلود نشد");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={p.name}
      help="toolsPopups"
      footer={
        canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn.primary} disabled={saving} onClick={() => save()}>{saving ? "…" : "ذخیره"}</button>
            {p.isActive ? (
              <button className={btn.soft} disabled={saving} onClick={() => save(false)}>خاموش کردن</button>
            ) : (
              <button className={btn.dark} disabled={saving} onClick={() => save(true)}>ذخیره و روشن کردن</button>
            )}
            {msg && <span className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <fieldset disabled={!canManage} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام داخلی">
              <input className={inputCls} value={p.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="نوع">
              <Segmented value={p.kind} onChange={(kind) => set({ kind })} options={[{ value: "ANNOUNCE", label: "اعلان" }, { value: "LEAD", label: "جمع‌کردن شماره" }]} />
            </Field>
          </div>

          <Field label="عنوان">
            <input className={inputCls} value={p.content.heading} maxLength={120} onChange={(e) => setC({ heading: e.target.value })} />
          </Field>
          <Field label="متن">
            <textarea className={`${inputCls} min-h-[70px]`} value={p.content.body} maxLength={600} onChange={(e) => setC({ body: e.target.value })} />
          </Field>
          <Field label="عکس (اختیاری)" hint="در موبایل کوچک کنار متن، در دسکتاپ بالای پاپ‌آپ">
            <div className="flex items-center gap-2">
              <input className={inputCls} dir="ltr" placeholder="/uploads/… یا https://…" value={p.content.imageUrl} onChange={(e) => setC({ imageUrl: e.target.value })} />
              <label className={`${btn.small} cursor-pointer`}>
                <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                {uploading ? "…" : "آپلود"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
            </div>
          </Field>

          {lead ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="متن دکمه‌ی ثبت">
                  <input className={inputCls} value={p.content.buttonText} maxLength={40} placeholder="دریافت کد" onChange={(e) => setC({ buttonText: e.target.value })} />
                </Field>
                <Field label="کد تخفیف (اختیاری)" hint="از «باشگاه ← کدهای تخفیف»؛ یک کد عمومی بسازید و اینجا بنویسید">
                  <input className={inputCls} dir="ltr" value={p.content.couponCode} maxLength={40} placeholder="WELCOME10" onChange={(e) => setC({ couponCode: e.target.value.toUpperCase() })} />
                </Field>
              </div>
              <Field label="متن بعد از ثبت">
                <input className={inputCls} value={p.content.successText} maxLength={300} placeholder="کد تخفیف شما:" onChange={(e) => setC({ successText: e.target.value })} />
              </Field>
              <Field label="متن تیک رضایت پیامک" hint="خالی = تیک نشان داده نمی‌شود و شماره فقط برای همین کد ثبت می‌شود. بدون تیک، پیامک تبلیغاتی نفرستید.">
                <input className={inputCls} value={p.content.consentText} maxLength={200} onChange={(e) => setC({ consentText: e.target.value })} />
              </Field>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="متن دکمه (اختیاری)">
                <input className={inputCls} value={p.content.buttonText} maxLength={40} onChange={(e) => setC({ buttonText: e.target.value })} />
              </Field>
              <Field label="لینک دکمه" hint="مسیر سایت مثل /products/… یا https://">
                <input className={inputCls} dir="ltr" value={p.content.buttonUrl} onChange={(e) => setC({ buttonUrl: e.target.value })} />
              </Field>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="کی باز شود">
              <select className={inputCls} value={p.trigger} onChange={(e) => { const trigger = e.target.value as PopupAdmin["trigger"]; set({ trigger, triggerValue: trigger === "SCROLL" ? 40 : 8 }); }}>
                {Object.entries(TRIGGER_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            {p.trigger !== "EXIT" ? (
              <Field label={p.trigger === "DELAY" ? "چند ثانیه بعد از باز شدن صفحه" : "چند درصد اسکرول"}>
                <input type="number" className={inputCls} min={p.trigger === "DELAY" ? 0 : 5} max={p.trigger === "DELAY" ? 600 : 100} value={p.triggerValue} onChange={(e) => set({ triggerValue: Number(e.target.value) })} />
              </Field>
            ) : (
              <p className="self-end pb-2 text-[11px] leading-5 text-gray-400">وقتی موس به بالای صفحه برود. در موبایل این پاپ‌آپ نشان داده نمی‌شود.</p>
            )}
            <Field label="کدام صفحه‌ها" hint="روی سبد، تسویه و حساب کاربری هرگز نشان داده نمی‌شود">
              <select className={inputCls} value={p.pages} onChange={(e) => set({ pages: e.target.value as PopupAdmin["pages"] })}>
                {Object.entries(PAGES_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="دستگاه">
              <Segmented value={p.device} onChange={(device) => set({ device })} options={[{ value: "ALL", label: "همه" }, { value: "MOBILE", label: "موبایل" }, { value: "DESKTOP", label: "دسکتاپ" }]} />
            </Field>
          </div>
          {p.pages === "CUSTOM" && (
            <Field label="مسیرها (هر خط یکی)" hint="هر صفحه‌ای که آدرسش با این شروع شود، مثل /products/iphone یا /categories/mobile">
              <textarea className={`${inputCls} min-h-[70px]`} dir="ltr" value={p.paths.join("\n")} onChange={(e) => set({ paths: e.target.value.split("\n") })} />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="دفعات نمایش به هر بازدیدکننده" hint="ویرایش متن، پاپ‌آپ را دوباره به همه نشان می‌دهد">
              <select className={inputCls} value={p.frequency} onChange={(e) => set({ frequency: e.target.value as PopupAdmin["frequency"] })}>
                {Object.entries(FREQ_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="جای نمایش">
              <Segmented value={p.position} onChange={(position) => set({ position })} options={[{ value: "AUTO", label: "خودکار" }, { value: "CENTER", label: "وسط" }, { value: "BOTTOM", label: "پایین" }]} />
            </Field>
            <Field label="شروع نمایش (اختیاری)">
              <JalaliDatePicker mode="datetime" value={p.startsAt} onChange={(startsAt) => set({ startsAt })} className={inputCls} />
            </Field>
            <Field label="پایان نمایش (اختیاری)">
              <JalaliDatePicker mode="datetime" value={p.endsAt} onChange={(endsAt) => set({ endsAt })} className={inputCls} />
            </Field>
            <Field label="رنگ اصلی">
              <div className="flex items-center gap-2">
                <input type="color" value={p.accent} onChange={(e) => set({ accent: e.target.value })} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-[var(--adm-border)] bg-transparent" />
                <input className={inputCls} dir="ltr" value={p.accent} onChange={(e) => set({ accent: e.target.value })} />
              </div>
            </Field>
            <Field label="اولویت" hint="اگر چند پاپ‌آپ هم‌زمان مناسب صفحه باشند، بیشترین اولویت نشان داده می‌شود">
              <input type="number" className={inputCls} min={-100} max={100} value={p.priority} onChange={(e) => set({ priority: Number(e.target.value) })} />
            </Field>
          </div>
        </fieldset>

        <div className="space-y-2 md:sticky md:top-0 md:self-start">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500">پیش‌نمایش</p>
            <div className="flex gap-1">
              <button className={`rounded-lg p-1.5 ${device === "mobile" ? "bg-gray-200 dark:bg-white/10" : "text-gray-400"}`} onClick={() => setDevice("mobile")} aria-label="موبایل">
                <Smartphone className="h-4 w-4" aria-hidden />
              </button>
              <button className={`rounded-lg p-1.5 ${device === "desktop" ? "bg-gray-200 dark:bg-white/10" : "text-gray-400"}`} onClick={() => setDevice("desktop")} aria-label="دسکتاپ">
                <Monitor className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          <div className={`flex min-h-[360px] rounded-2xl bg-gray-200/70 p-3 dark:bg-white/5 ${device === "mobile" && (p.position === "AUTO" || p.position === "BOTTOM") ? "items-end" : p.position === "BOTTOM" ? "items-end" : "items-center"} justify-center`}>
            <PopupView
              key={`${p.kind}-${device}`}
              preview
              kind={p.kind}
              content={p.content}
              accent={/^#[0-9a-fA-F]{6}$/.test(p.accent) ? p.accent : "#2563eb"}
              position={p.position}
              isMobile={device === "mobile"}
              onClose={() => {}}
              onLead={async () => ({ ok: true, couponCode: p.content.couponCode || null, successText: p.content.successText })}
            />
          </div>
          <p className="text-[11px] leading-5 text-gray-400">در پیش‌نمایش می‌شود شماره زد تا حالت بعد از ثبت دیده شود؛ چیزی ذخیره نمی‌شود.</p>
        </div>
      </div>
    </Sheet>
  );
}

function LeadsSheet({ popup, onClose }: { popup: PopupAdmin; onClose: () => void }) {
  const [leads, setLeads] = useState<{ id: string; phone: string; consent: boolean; createdAt: string }[] | null>(null);
  useEffect(() => {
    api<{ leads: { id: string; phone: string; consent: boolean; createdAt: string }[] }>(`/api/admin/tools/popups/${popup.id}`)
      .then((x) => setLeads(x.leads))
      .catch(() => setLeads([]));
  }, [popup.id]);

  function download() {
    if (!leads) return;
    const csv = "﻿موبایل,رضایت پیامک,زمان\n" + leads.map((l) => `${l.phone},${l.consent ? "بله" : "خیر"},${new Date(l.createdAt).toLocaleString("fa-IR")}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `popup-leads-${popup.id}.csv`;
    a.click();
  }

  return (
    <Sheet open onClose={onClose} title={`شماره‌های «${popup.name}»`} footer={leads?.length ? (
      <button className={btn.soft} onClick={download}>
        <Download className="h-4 w-4" aria-hidden />
        دانلود CSV
      </button>
    ) : undefined}>
      <p className="mb-3 text-[11px] leading-5 text-gray-400">
        فقط به شماره‌هایی که «رضایت پیامک» دارند پیامک تبلیغاتی بفرستید. اگر باشگاه مشتریان روشن باشد، این شماره‌ها در اعضای باشگاه هم هستند.
      </p>
      {leads === null ? (
        <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : leads.length === 0 ? (
        <p className="text-xs text-gray-400">هنوز شماره‌ای ثبت نشده.</p>
      ) : (
        <ul className="divide-y divide-[var(--adm-border)] text-xs">
          {leads.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2">
              <span dir="ltr" className="tabular-nums">{l.phone}</span>
              <span className="flex items-center gap-2">
                {l.consent ? <Badge tone="green">رضایت پیامک</Badge> : <Badge tone="gray">بدون رضایت</Badge>}
                <span className="text-gray-400">{new Date(l.createdAt).toLocaleDateString("fa-IR")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
