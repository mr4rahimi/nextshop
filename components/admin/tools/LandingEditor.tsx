"use client";

/**
 * ویرایشگر لندینگ — بلوک‌ها، ظاهر، تنظیمات، پیش‌نمایش زنده و انتشار.
 *
 * - بلوک‌ها و رنگ‌ها **پیش‌نویس**‌اند و ۱٫۲ ثانیه بعد از آخرین تغییر خودکار
 *   ذخیره می‌شوند؛ صفحه‌ی عمومی تا «انتشار» عوض نمی‌شود.
 * - عنوان، نامک و سئو با دکمه‌ی خودشان مستقیم ذخیره می‌شوند.
 * - پیش‌نمایش همان `LandingPageView` صفحه‌ی عمومی است.
 *
 * مستندات: docs/features/tools.md بخش ۳
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUp, ChevronDown, ExternalLink, ImagePlus, Plus, Search, Trash2, X,
} from "lucide-react";
import {
  BLOCK_META, BLOCK_ORDER, BUTTON_ICONS, SOCIALS, WEEKDAYS, defaultBlock,
  type Block, type BlockType, type LandingTheme,
} from "@/lib/tools/landing-blocks";
import type { LandingDto, LandingProduct } from "@/lib/tools/landings";
import LandingPageView from "@/components/tools/LandingPageView";
import HelpButton from "@/components/admin/worklist/HelpButton";
import { Badge, Card, ErrorText, Field, Segmented, api, btn, inputCls } from "../accounting/ui";
import { useToolsAccess } from "./ToolsShell";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(d.error ?? "آپلود نشد");
  return d.url as string;
}

export default function LandingEditor({ id }: { id: string }) {
  const { canManage } = useToolsAccess();
  const [l, setL] = useState<LandingDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<LandingTheme>({ primary: "#2563eb", background: "#f4f6fb" });
  const [save, setSave] = useState<SaveState>("idle");
  const [tab, setTab] = useState<"blocks" | "settings">("blocks");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Record<string, LandingProduct>>({});
  const [platforms, setPlatforms] = useState<{ key: string; label: string; url: string }[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const loaded = useRef(false);
  /** اولین اجرای ذخیره‌ی خودکار همان داده‌ی بارگذاری‌شده است — ذخیره لازم ندارد */
  const skipFirst = useRef(true);

  useEffect(() => {
    api<LandingDto>(`/api/admin/tools/landings/${id}`)
      .then((d) => {
        setL(d);
        setBlocks(d.blocks);
        setTheme(d.theme);
        loaded.current = true;
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "بارگذاری نشد"));
    api<{ settings: { platformOrder: string[]; neshanUrl: string; baladUrl: string; googleUrl: string } }>("/api/admin/tools/reviews")
      .then(({ settings: s }) => {
        const url: Record<string, string> = { NESHAN: s.neshanUrl, BALAD: s.baladUrl, GOOGLE: s.googleUrl };
        const label: Record<string, string> = { NESHAN: "نشان", BALAD: "بلد", GOOGLE: "گوگل‌مپ" };
        setPlatforms(s.platformOrder.filter((k) => url[k]).map((k) => ({ key: k, label: label[k], url: "#" })));
      })
      .catch(() => {});
  }, [id]);

  // ذخیره‌ی خودکار پیش‌نویس
  useEffect(() => {
    if (!loaded.current || !canManage) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setSave("dirty");
    const t = setTimeout(async () => {
      setSave("saving");
      try {
        const d = await api<LandingDto>(`/api/admin/tools/landings/${id}`, { method: "PATCH", json: { blocks, theme } });
        setL(d);
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [blocks, theme, id, canManage]);

  // محصولات انتخاب‌شده برای پیش‌نمایش
  const productIds = blocks.flatMap((b) => (b.type === "products" ? b.productIds : []));
  const missing = productIds.filter((p) => !products[p]);
  const missingKey = missing.join(",");
  useEffect(() => {
    if (!missingKey) return;
    api<{ items: LandingProduct[] }>(`/api/admin/tools/products?ids=${missingKey}`)
      .then((r) => setProducts((p) => ({ ...p, ...Object.fromEntries(r.items.map((x) => [x.id, x])) })))
      .catch(() => {});
  }, [missingKey]);

  const update = useCallback((bid: string, patch: Partial<Block>) => {
    setBlocks((bs) => bs.map((b) => (b.id === bid ? ({ ...b, ...patch } as Block) : b)));
  }, []);

  function move(i: number, dir: -1 | 1) {
    setBlocks((bs) => {
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addBlock(type: BlockType) {
    const b = defaultBlock(type);
    setBlocks((bs) => [...bs, b]);
    setOpen(b.id);
    setAdding(false);
  }

  async function publish() {
    setBusy(true);
    setPublishErrors([]);
    try {
      // اول آخرین پیش‌نویس، بعد انتشار
      await api(`/api/admin/tools/landings/${id}`, { method: "PATCH", json: { blocks, theme } });
      const r = await fetch(`/api/admin/tools/landings/${id}/publish`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 422) setPublishErrors(d.errors ?? [d.error]);
      else if (!r.ok) setPublishErrors([d.error ?? "منتشر نشد"]);
      else {
        setL(d);
        setSave("saved");
      }
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!confirm("انتشار لغو شود؟ صفحه‌ی عمومی تا انتشار دوباره ۴۰۴ می‌شود؛ پیش‌نویس می‌ماند.")) return;
    setBusy(true);
    try {
      setL(await api<LandingDto>(`/api/admin/tools/landings/${id}/publish`, { method: "DELETE" }));
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) return <ErrorText>{loadErr}</ErrorText>;
  if (!l) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const saveLabel: Record<SaveState, string> = {
    idle: "",
    dirty: "تغییر ذخیره‌نشده…",
    saving: "در حال ذخیره…",
    saved: "پیش‌نویس ذخیره شد ✓",
    error: "ذخیره نشد — دوباره تلاش می‌شود با تغییر بعدی",
  };

  const preview = (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2rem] border-[6px] border-gray-900 bg-white shadow-xl dark:border-gray-700">
      <div className="h-[680px] overflow-y-auto" style={{ background: theme.background }}>
        <LandingPageView slug={l.slug} blocks={blocks} theme={theme} products={products} reviewPlatforms={platforms} preview />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* نوار بالا */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/tools/landings" className={btn.small}>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          لندینگ‌ها
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-black">{l.title}</h1>
        <HelpButton topic="toolsLandings" />
        {l.status === "PUBLISHED" ? <Badge tone="green">منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
        {l.hasUnpublished && <Badge tone="amber">تغییر منتشرنشده</Badge>}
        <span className={`text-[11px] font-bold ${save === "error" ? "text-red-600" : "text-gray-400"}`}>{saveLabel[save]}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <button className={btn.primary} disabled={busy} onClick={publish}>
            {l.status === "PUBLISHED" ? "انتشار تغییرات" : "انتشار"}
          </button>
        )}
        {canManage && l.status === "PUBLISHED" && (
          <button className={btn.soft} disabled={busy} onClick={unpublish}>
            لغو انتشار
          </button>
        )}
        {l.status === "PUBLISHED" && (
          <a className={btn.soft} href={l.url} target="_blank" rel="noopener">
            <ExternalLink className="h-4 w-4" aria-hidden />
            <span dir="ltr">{l.url.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        <button className={`${btn.soft} lg:hidden`} onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? "بستن پیش‌نمایش" : "پیش‌نمایش"}
        </button>
      </div>

      {publishErrors.length > 0 && (
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
          <p className="mb-1 font-bold">پیش از انتشار این‌ها را درست کنید:</p>
          <ul className="list-inside list-disc space-y-0.5">
            {publishErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {showPreview && <div className="lg:hidden">{preview}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <Segmented value={tab} onChange={setTab} options={[{ value: "blocks", label: "بلوک‌ها و رنگ" }, { value: "settings", label: "نامک و سئو" }]} />

          {tab === "blocks" ? (
            <>
              <Card className="grid grid-cols-2 gap-3 p-4">
                <Field label="رنگ اصلی (دکمه‌ها)">
                  <ColorPick value={theme.primary} onChange={(primary) => setTheme((t) => ({ ...t, primary }))} disabled={!canManage} />
                </Field>
                <Field label="رنگ زمینه">
                  <ColorPick value={theme.background} onChange={(background) => setTheme((t) => ({ ...t, background }))} disabled={!canManage} />
                </Field>
              </Card>

              {blocks.map((b, i) => (
                <Card key={b.id} className="overflow-hidden">
                  <div className="flex items-center gap-1 px-3 py-2">
                    <button className="flex min-w-0 flex-1 items-center gap-2 text-right" onClick={() => setOpen(open === b.id ? null : b.id)}>
                      <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition ${open === b.id ? "rotate-180" : ""}`} aria-hidden />
                      <span className="text-sm font-bold">{BLOCK_META[b.type].label}</span>
                      <span className="truncate text-[11px] text-gray-400">{blockSummary(b)}</span>
                    </button>
                    {canManage && (
                      <>
                        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-[var(--adm-hover)] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="بالا">
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-[var(--adm-hover)] disabled:opacity-30" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label="پایین">
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                          onClick={() => confirm(`بلوک «${BLOCK_META[b.type].label}» حذف شود؟`) && setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                  {open === b.id && (
                    <fieldset disabled={!canManage} className="border-t border-[var(--adm-border)] p-4">
                      <BlockForm block={b} onChange={(p) => update(b.id, p)} products={products} onProducts={(m) => setProducts((x) => ({ ...x, ...m }))} />
                    </fieldset>
                  )}
                </Card>
              ))}

              {canManage &&
                (adding ? (
                  <Card className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500">افزودن بلوک</p>
                      <button onClick={() => setAdding(false)} aria-label="بستن">
                        <X className="h-4 w-4 text-gray-400" aria-hidden />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {BLOCK_ORDER.map((t) => (
                        <button key={t} onClick={() => addBlock(t)} className="rounded-xl border border-[var(--adm-border)] p-2.5 text-right transition hover:border-blue-400">
                          <p className="text-sm font-bold">{BLOCK_META[t].label}</p>
                          <p className="text-[11px] leading-5 text-gray-400">{BLOCK_META[t].hint}</p>
                        </button>
                      ))}
                    </div>
                  </Card>
                ) : (
                  <button className={`${btn.soft} w-full`} onClick={() => setAdding(true)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    افزودن بلوک
                  </button>
                ))}
            </>
          ) : (
            <SettingsForm l={l} onSaved={setL} canManage={canManage} />
          )}
        </div>

        <div className="hidden lg:sticky lg:top-4 lg:block lg:self-start">{preview}</div>
      </div>
    </div>
  );
}

function blockSummary(b: Block): string {
  switch (b.type) {
    case "header": return b.name;
    case "buttons": return b.items.map((x) => x.label).filter(Boolean).join("، ");
    case "products": return `${b.productIds.length.toLocaleString("fa-IR")} محصول`;
    case "image": return `${b.images.length.toLocaleString("fa-IR")} عکس`;
    case "text": case "faq": case "callback": case "review": return b.title;
    case "address": return b.address;
    default: return "";
  }
}

// ─── فرم هر بلوک ─────────────────────────────────────────────────────────

function BlockForm({
  block: b, onChange, products, onProducts,
}: {
  block: Block;
  onChange: (p: Partial<Block>) => void;
  products: Record<string, LandingProduct>;
  onProducts: (m: Record<string, LandingProduct>) => void;
}) {
  switch (b.type) {
    case "header":
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageField label="لوگو" value={b.logo} onChange={(logo) => onChange({ logo })} />
            <ImageField label="عکس کاور (اختیاری)" value={b.cover} onChange={(cover) => onChange({ cover })} />
          </div>
          <Field label="نام">
            <input className={inputCls} value={b.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
          <Field label="شعار">
            <input className={inputCls} value={b.tagline} maxLength={200} onChange={(e) => onChange({ tagline: e.target.value })} />
          </Field>
        </div>
      );

    case "buttons":
      return (
        <div className="space-y-3">
          {b.items.map((it, j) => (
            <div key={j} className="space-y-2 rounded-xl border border-[var(--adm-border)] p-3">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="برچسب"
                  value={it.label}
                  maxLength={60}
                  onChange={(e) => onChange({ items: b.items.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })}
                />
                <select
                  className={`${inputCls} w-32`}
                  value={it.icon}
                  onChange={(e) => onChange({ items: b.items.map((x, k) => (k === j ? { ...x, icon: e.target.value as typeof it.icon } : x)) })}
                >
                  {BUTTON_ICONS.map((ic) => <option key={ic.key} value={ic.key}>{ic.label}</option>)}
                </select>
                <button className="px-1 text-red-400" onClick={() => onChange({ items: b.items.filter((_, k) => k !== j) })} aria-label="حذف دکمه">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <input
                className={inputCls}
                dir="ltr"
                placeholder="/category/… یا https://… یا tel:0912…"
                value={it.url}
                onChange={(e) => onChange({ items: b.items.map((x, k) => (k === j ? { ...x, url: e.target.value } : x)) })}
              />
            </div>
          ))}
          <button className={btn.small} onClick={() => onChange({ items: [...b.items, { label: "", url: "", icon: "link" }] })}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            دکمه
          </button>
          <p className="text-[11px] leading-5 text-gray-400">مسیرهای خود فروشگاه را با / شروع کنید، مثل /products/… — دکمه‌ی تماس بدون شماره منتشر نمی‌شود.</p>
        </div>
      );

    case "social":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <Field key={s.key} label={s.label}>
              <input
                className={inputCls}
                dir="ltr"
                placeholder={s.placeholder}
                value={b.links[s.key] ?? ""}
                onChange={(e) => {
                  const links = { ...b.links, [s.key]: e.target.value };
                  if (!e.target.value) delete links[s.key];
                  onChange({ links });
                }}
              />
            </Field>
          ))}
        </div>
      );

    case "text":
      return (
        <div className="space-y-3">
          <Field label="عنوان (اختیاری)">
            <input className={inputCls} value={b.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="متن" hint="خط خالی = پاراگراف تازه">
            <textarea className={`${inputCls} min-h-[120px]`} value={b.body} maxLength={3000} onChange={(e) => onChange({ body: e.target.value })} />
          </Field>
        </div>
      );

    case "image":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {b.images.map((src, j) => (
              <div key={j} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full rounded-xl border border-[var(--adm-border)] object-cover" />
                <button
                  className="absolute left-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  onClick={() => onChange({ images: b.images.filter((_, k) => k !== j) })}
                  aria-label="حذف عکس"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            ))}
            <UploadTile onUploaded={(url) => onChange({ images: [...b.images, url] })} />
          </div>
          <Field label="زیرنویس (اختیاری)">
            <input className={inputCls} value={b.caption} maxLength={200} onChange={(e) => onChange({ caption: e.target.value })} />
          </Field>
        </div>
      );

    case "products":
      return (
        <div className="space-y-3">
          <Field label="عنوان">
            <input className={inputCls} value={b.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <ProductPicker
            ids={b.productIds}
            products={products}
            onProducts={onProducts}
            onChange={(productIds) => onChange({ productIds })}
          />
        </div>
      );

    case "callback":
      return (
        <div className="space-y-3">
          <Field label="عنوان">
            <input className={inputCls} value={b.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="توضیح">
            <textarea className={`${inputCls} min-h-[70px]`} value={b.text} maxLength={400} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <p className="text-[11px] leading-5 text-gray-400">درخواست‌ها در «تنظیمات › درخواست‌های تماس» با یادداشت «از لندینگ …» می‌نشینند.</p>
        </div>
      );

    case "address":
      return (
        <div className="space-y-3">
          <Field label="آدرس">
            <textarea className={`${inputCls} min-h-[60px]`} value={b.address} maxLength={400} onChange={(e) => onChange({ address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="عرض جغرافیایی">
              <input className={inputCls} dir="ltr" placeholder="35.6997" value={b.lat} onChange={(e) => onChange({ lat: e.target.value.trim() })} />
            </Field>
            <Field label="طول جغرافیایی">
              <input className={inputCls} dir="ltr" placeholder="51.3380" value={b.lng} onChange={(e) => onChange({ lng: e.target.value.trim() })} />
            </Field>
          </div>
          <p className="text-[11px] leading-5 text-gray-400">مختصات را از گوگل‌مپ (کلیک راست روی نقطه) بردارید؛ دکمه‌های نشان، بلد و گوگل‌مپ خودکار ساخته می‌شوند.</p>
        </div>
      );

    case "hours":
      return (
        <div className="space-y-2">
          {b.days.map((d, j) => (
            <div key={j} className="flex items-center gap-2 text-sm">
              <label className="flex w-28 items-center gap-2">
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => onChange({ days: b.days.map((x, k) => (k === j ? { ...x, open: e.target.checked } : x)) })}
                />
                {WEEKDAYS[j]}
              </label>
              {d.open ? (
                <>
                  <input type="time" className={`${inputCls} w-28`} value={d.from} onChange={(e) => onChange({ days: b.days.map((x, k) => (k === j ? { ...x, from: e.target.value } : x)) })} />
                  <span className="text-gray-400">تا</span>
                  <input type="time" className={`${inputCls} w-28`} value={d.to} onChange={(e) => onChange({ days: b.days.map((x, k) => (k === j ? { ...x, to: e.target.value } : x)) })} />
                </>
              ) : (
                <span className="text-xs text-gray-400">تعطیل</span>
              )}
            </div>
          ))}
          <Field label="یادداشت (اختیاری)" className="pt-2">
            <input className={inputCls} value={b.note} maxLength={200} onChange={(e) => onChange({ note: e.target.value })} placeholder="مثلاً روزهای تعطیل رسمی بسته‌ایم" />
          </Field>
        </div>
      );

    case "faq":
      return (
        <div className="space-y-3">
          <Field label="عنوان">
            <input className={inputCls} value={b.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          {b.items.map((x, j) => (
            <div key={j} className="space-y-2 rounded-xl border border-[var(--adm-border)] p-3">
              <div className="flex gap-2">
                <input className={inputCls} placeholder="پرسش" value={x.q} maxLength={200} onChange={(e) => onChange({ items: b.items.map((y, k) => (k === j ? { ...y, q: e.target.value } : y)) })} />
                <button className="px-1 text-red-400" onClick={() => onChange({ items: b.items.filter((_, k) => k !== j) })} aria-label="حذف">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <textarea className={`${inputCls} min-h-[60px]`} placeholder="پاسخ" value={x.a} maxLength={1500} onChange={(e) => onChange({ items: b.items.map((y, k) => (k === j ? { ...y, a: e.target.value } : y)) })} />
            </div>
          ))}
          <button className={btn.small} onClick={() => onChange({ items: [...b.items, { q: "", a: "" }] })}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            پرسش
          </button>
        </div>
      );

    case "review":
      return (
        <div className="space-y-3">
          <Field label="عنوان">
            <input className={inputCls} value={b.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="متن">
            <input className={inputCls} value={b.text} maxLength={300} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <p className="text-[11px] leading-5 text-gray-400">
            دکمه‌ها از <Link href="/admin/tools/reviews" className="text-blue-600">تنظیمات درخواست ثبت نظر</Link> می‌آیند؛ تغییر آدرس‌ها بدون انتشار دوباره اعمال می‌شود. متن خنثی بماند — نه «اگر راضی بودید».
          </p>
        </div>
      );
  }
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-12 w-12 rounded-lg border border-[var(--adm-border)] object-contain" />
        ) : (
          <span className="h-12 w-12 rounded-lg border border-dashed border-[var(--adm-border-strong)]" />
        )}
        <button type="button" className={btn.small} disabled={busy} onClick={() => ref.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          {busy ? "…" : value ? "عوض کردن" : "آپلود"}
        </button>
        {value && (
          <button type="button" className={btn.small} onClick={() => onChange("")}>
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setErr(null);
            try {
              onChange(await uploadImage(f));
            } catch (x) {
              setErr(x instanceof Error ? x.message : "آپلود نشد");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </div>
      {err && <p className="mt-1 text-[11px] font-bold text-red-600">{err}</p>}
    </Field>
  );
}

function UploadTile({ onUploaded }: { onUploaded: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[var(--adm-border-strong)] text-gray-400"
      disabled={busy}
    >
      {busy ? "…" : <ImagePlus className="h-6 w-6" aria-hidden />}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onUploaded(await uploadImage(f));
          } catch (x) {
            alert(x instanceof Error ? x.message : "آپلود نشد");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </button>
  );
}

function ProductPicker({
  ids, products, onProducts, onChange,
}: {
  ids: string[];
  products: Record<string, LandingProduct>;
  onProducts: (m: Record<string, LandingProduct>) => void;
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LandingProduct[]>([]);

  const searching = q.trim().length >= 2;
  const shown = searching ? results : [];

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      api<{ items: LandingProduct[] }>(`/api/admin/tools/products?q=${encodeURIComponent(q.trim())}`).then((r) => setResults(r.items)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <ul className="space-y-1.5">
          {ids.map((pid, j) => (
            <li key={pid} className="flex items-center gap-2 rounded-xl border border-[var(--adm-border)] p-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{products[pid]?.title ?? "محصول ناموجود یا غیرفعال"}</span>
              <button className="text-gray-400 disabled:opacity-30" disabled={j === 0} onClick={() => { const n = [...ids]; [n[j - 1], n[j]] = [n[j], n[j - 1]]; onChange(n); }} aria-label="بالا">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button className="text-red-400" onClick={() => onChange(ids.filter((x) => x !== pid))} aria-label="حذف">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input className={`${inputCls} pr-9`} placeholder="جستجوی محصول برای افزودن" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-xl border border-[var(--adm-border)]">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                className="flex w-full items-center gap-2 p-2 text-right text-sm hover:bg-[var(--adm-hover)] disabled:opacity-40"
                disabled={ids.includes(p.id) || ids.length >= 12}
                onClick={() => {
                  onProducts({ [p.id]: p });
                  onChange([...ids, p.id]);
                }}
              >
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-8 w-8 rounded object-contain" />
                )}
                <span className="flex-1 truncate">{p.title}</span>
                {ids.includes(p.id) && <span className="text-[10px] text-gray-400">افزوده شد</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-gray-400">حداکثر ۱۲ محصول؛ قیمت و موجودی همیشه زنده از فروشگاه خوانده می‌شود.</p>
    </div>
  );
}

function ColorPick({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--adm-border)] bg-transparent" />
      <span className="text-xs tabular-nums text-gray-500" dir="ltr">{value}</span>
    </div>
  );
}

// ─── تنظیمات ─────────────────────────────────────────────────────────────

function SettingsForm({ l, onSaved, canManage }: { l: LandingDto; onSaved: (l: LandingDto) => void; canManage: boolean }) {
  const [f, setF] = useState({
    title: l.title, slug: l.slug, metaTitle: l.metaTitle, metaDescription: l.metaDescription, ogImage: l.ogImage, noindex: l.noindex,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      onSaved(await api<LandingDto>(`/api/admin/tools/landings/${l.id}`, { method: "PATCH", json: f }));
      setMsg({ ok: true, text: "✓ ذخیره شد" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ذخیره نشد" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <fieldset disabled={!canManage} className="space-y-3">
        <Field label="عنوان">
          <input className={inputCls} value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="نامک" hint={l.slugLocked ? "بعد از اولین انتشار قفل است — ممکن است لینکش پخش شده باشد." : "تا اولین انتشار قابل تغییر است."}>
          <div className="flex items-center gap-1" dir="ltr">
            <span className="text-xs text-gray-400">/l/</span>
            <input
              className={inputCls}
              dir="ltr"
              disabled={l.slugLocked}
              value={f.slug}
              maxLength={40}
              onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
            />
          </div>
        </Field>
        <Field label="عنوان سئو / پیش‌نمایش لینک">
          <input className={inputCls} value={f.metaTitle} maxLength={120} onChange={(e) => setF({ ...f, metaTitle: e.target.value })} />
        </Field>
        <Field label="توضیح متا">
          <textarea className={`${inputCls} min-h-[70px]`} value={f.metaDescription} maxLength={300} onChange={(e) => setF({ ...f, metaDescription: e.target.value })} />
        </Field>
        <ImageField label="تصویر پیش‌نمایش در تلگرام و واتساپ" value={f.ogImage} onChange={(ogImage) => setF({ ...f, ogImage })} />
        <Field
          label="نمایش در گوگل"
          hint="پیش‌فرض بسته است: لندینگ تبلیغاتی نباید با صفحات اصلی فروشگاه در نتایج جستجو رقابت کند."
        >
          <Segmented
            value={f.noindex ? "no" : "yes"}
            onChange={(v) => setF({ ...f, noindex: v === "no" })}
            options={[{ value: "no", label: "ایندکس نشود" }, { value: "yes", label: "ایندکس شود" }]}
          />
        </Field>
      </fieldset>
      {canManage && (
        <div className="flex items-center gap-2">
          <button className={btn.primary} disabled={saving} onClick={save}>
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
          {msg && <span className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      )}
      <p className="text-[11px] leading-5 text-gray-400">این تنظیمات مستقیم ذخیره می‌شوند و انتشار لازم ندارند.</p>
    </Card>
  );
}
