"use client";

/**
 * فهرست لندینگ‌ها — docs/features/tools.md بخش ۳.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import type { LandingDto } from "@/lib/tools/landings";
import { Badge, Card, Empty, ErrorText, Field, PageHeader, Sheet, api, btn, inputCls } from "../accounting/ui";
import { useToolsAccess } from "./ToolsShell";

type Row = Omit<LandingDto, "blocks"> & { blockCount: number };

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function LandingsClient() {
  const router = useRouter();
  const { canManage } = useToolsAccess();
  const [items, setItems] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState<{ title: string; slug: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ items: Row[] }>("/api/admin/tools/landings").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  async function create() {
    if (!creating) return;
    setSaving(true);
    setErr(null);
    try {
      const l = await api<LandingDto>("/api/admin/tools/landings", { method: "POST", json: creating });
      router.push(`/admin/tools/landings/${l.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ساخته نشد");
      setSaving(false);
    }
  }

  async function remove(l: Row) {
    if (!confirm(`لندینگ «${l.title}» حذف شود؟\nآدرس /l/${l.slug} دیگر باز نمی‌شود و این نامک هم آزاد نمی‌شود.`)) return;
    await api(`/api/admin/tools/landings/${l.id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="لندینگ‌ساز"
        help="toolsLandings"
        desc="صفحه‌ی تک‌ستونه‌ی موبایل برای بیو اینستاگرام، QR بنر یا کمپین — با دکمه، محصول، فرم تماس و ساعت کاری."
        actions={
          canManage ? (
            <button className={btn.primary} onClick={() => { setErr(null); setCreating({ title: "", slug: "" }); }}>
              <Plus className="h-4 w-4" aria-hidden />
              لندینگ تازه
            </button>
          ) : undefined
        }
      />

      <Card>
        {items === null ? (
          <p className="p-4 text-xs text-gray-400">در حال بارگذاری…</p>
        ) : items.length === 0 ? (
          <Empty title="هنوز لندینگی ساخته نشده" desc="مثلاً یک صفحه برای لینک بیو اینستاگرام: لوگو، چند دکمه به دسته‌های پرفروش، محصولات ویژه و شماره‌ی تماس." />
        ) : (
          <ul className="divide-y divide-[var(--adm-border)]">
            {items.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/admin/tools/landings/${l.id}`} className="truncate text-sm font-bold hover:text-blue-600">
                      {l.title}
                    </Link>
                    {l.status === "PUBLISHED" ? <Badge tone="green">منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
                    {l.hasUnpublished && <Badge tone="amber">تغییر منتشرنشده</Badge>}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(l.url); setCopied(l.id); setTimeout(() => setCopied(null), 1500); }}
                    className="mt-0.5 flex items-center gap-1 text-xs font-bold text-blue-600"
                    dir="ltr"
                  >
                    <Copy className="h-3 w-3" aria-hidden />
                    {copied === l.id ? "کپی شد ✓" : l.url.replace(/^https?:\/\//, "")}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-base font-black tabular-nums">{fa(l.viewCount)}</p>
                    <p className="text-[10px] text-gray-400">بازدید</p>
                  </div>
                  <div className="flex gap-1.5">
                    {l.status === "PUBLISHED" && (
                      <a className={btn.small} href={l.url} target="_blank" rel="noopener" aria-label="باز کردن">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    )}
                    <Link className={btn.small} href={`/admin/tools/qr?url=${encodeURIComponent(l.url)}`} aria-label="QR" title="ساخت QR برای این لندینگ">
                      <QrCode className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    <Link className={btn.small} href={`/admin/tools/landings/${l.id}`} aria-label="ویرایش">
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    {canManage && (
                      <button className={btn.small} onClick={() => remove(l)} aria-label="حذف">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet
        open={!!creating}
        onClose={() => setCreating(null)}
        title="لندینگ تازه"
        footer={
          <div className="flex gap-2">
            <button className={`${btn.primary} flex-1`} disabled={saving} onClick={create}>
              {saving ? "در حال ساخت…" : "ساختن و رفتن به ویرایشگر"}
            </button>
            <button className={btn.soft} onClick={() => setCreating(null)}>انصراف</button>
          </div>
        }
      >
        {creating && (
          <div className="space-y-3">
            <Field label="عنوان" hint="عنوان صفحه در مرورگر و پیش‌نمایش لینک؛ بعداً هم قابل تغییر است.">
              <input className={inputCls} value={creating.title} maxLength={120} onChange={(e) => setCreating({ ...creating, title: e.target.value })} placeholder="مثلاً لینک بیو اینستاگرام" />
            </Field>
            <Field label="نامک (اختیاری)" hint="خالی = از روی عنوان. تا اولین انتشار قابل تغییر است و بعد قفل می‌شود.">
              <div className="flex items-center gap-1" dir="ltr">
                <span className="text-xs text-gray-400">/l/</span>
                <input
                  className={inputCls}
                  dir="ltr"
                  value={creating.slug}
                  maxLength={40}
                  onChange={(e) => setCreating({ ...creating, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  placeholder="insta"
                />
              </div>
            </Field>
            <p className="text-[11px] leading-5 text-gray-400">نام، لوگو، تلفن و شبکه‌های اجتماعی از تنظیمات فروشگاه پیش‌فرض می‌شوند.</p>
            <ErrorText>{err}</ErrorText>
          </div>
        )}
      </Sheet>
    </div>
  );
}
