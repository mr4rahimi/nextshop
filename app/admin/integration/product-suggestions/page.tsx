"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Search, Sparkles, Store, Wand2 } from "lucide-react";
import { Card, PageHeader, api, btn, inputCls } from "@/components/admin/accounting/ui";

/**
 * قرار دادن محصول در بازارگاه — docs/integrations/settings-and-guide.md
 *
 * برای هر بازارگاه: محصولات فعال سایت که هنوز آنجا نگاشت ندارند. بازارگاهی که
 * ساخت محصول از بیرون را می‌پذیرد (فعلاً باسلام) «ساخت خودکار» دارد؛ بقیه
 * راهنمای قرار دادن دستی در پنل فروشندگی خودشان و «دریافت محصولات» برای نگاشت.
 */

interface Market {
  code: string;
  name: string;
  method: "auto" | "manual";
  connected: boolean;
  panelUrl: string | null;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  sku: string | null;
  gtin13: string | null;
  price: number;
  salePrice: number | null;
  stock: number;
  mainImage: string | null;
  shortDescription: string | null;
}

interface Resp {
  platforms: Market[];
  platform: string | null;
  counts: { active: number; linked: number } | null;
  total: number;
  page?: number;
  perPage?: number;
  items: Product[];
}

const fa = (n: number) => n.toLocaleString("fa-IR");

function specText(p: Product): string {
  const price = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return [
    `نام: ${p.title}`,
    `قیمت سایت: ${fa(price)} تومان`,
    `موجودی: ${fa(p.stock)}`,
    p.sku ? `کد کالا (SKU): ${p.sku}` : null,
    p.gtin13 ? `بارکد: ${p.gtin13}` : null,
    p.shortDescription ? `توضیح: ${p.shortDescription.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}` : null,
    `صفحه‌ی محصول و عکس‌ها: ${origin}/products/${p.slug}`,
  ].filter(Boolean).join("\n");
}

export default function ListingPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [inStock, setInStock] = useState(true);
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    const sp = new URLSearchParams({ page: String(page), stock: inStock ? "1" : "0" });
    if (platform) sp.set("platform", platform);
    if (q.trim()) sp.set("q", q.trim());
    api<Resp>(`/api/integration/listing?${sp}`)
      .then((d) => {
        setData(d);
        if (!platform && d.platform) setPlatform(d.platform);
      })
      .catch((e) => setMsg(e.message));
  }, [platform, q, inStock, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function fetchProducts(code: string) {
    setMsg(null);
    try {
      const r = await api<{ alreadyRunning?: boolean }>("/api/integration/listing", { method: "POST", json: { platform: code } });
      setMsg(r.alreadyRunning ? "دریافت محصولات از قبل در صف است." : "دریافت محصولات در صف قرار گرفت؛ چند دقیقه‌ی دیگر محصولات تازه نگاشت یا پیشنهاد می‌شوند.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "انجام نشد");
    }
  }

  async function copy(p: Product) {
    try {
      await navigator.clipboard.writeText(specText(p));
      setCopied(p.id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setMsg("کپی نشد؛ مرورگر اجازه نداد");
    }
  }

  const market = data?.platforms.find((m) => m.code === (platform ?? data?.platform));
  const pages = data?.perPage ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="قرار دادن محصول در بازارگاه"
        help="integrationProductSuggestions"
        desc="کدام محصول سایت هنوز در کدام بازارگاه نیست، و راه قرار دادنش: ساخت خودکار یا ساخت در پنل خود بازارگاه."
      />

      {data && data.platforms.length === 0 && (
        <Card className="p-6 text-center text-sm text-gray-500">
          هیچ بازارگاهی روشن نیست. از <Link href="/admin/integration/settings" className="font-bold text-teal-600">تنظیمات</Link> بازارگاه‌هایتان را روشن کنید.
        </Card>
      )}

      {data && data.platforms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.platforms.map((m) => {
            const on = m.code === market?.code;
            return (
              <button
                key={m.code}
                type="button"
                onClick={() => {
                  setPlatform(m.code);
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition ${
                  on ? "border-teal-400 bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300" : "border-[var(--adm-border)] bg-[var(--adm-surface)] text-gray-700 dark:text-gray-200"
                }`}
              >
                {m.name}
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${m.method === "auto" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-gray-500/10 text-gray-500"}`}>
                  {m.method === "auto" ? "خودکار" : "دستی"}
                </span>
                {!m.connected && <span className="text-[10px] text-amber-600">وصل نیست</span>}
              </button>
            );
          })}
        </div>
      )}

      {market && (
        <Card className="p-5">
          {!market.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-gray-700 dark:text-gray-200">{market.name} هنوز وصل نیست. اول اتصالش را برقرار کنید.</p>
              <Link href={`/admin/integration/connections/${market.code}`} className={btn.primary}>وصل کردن {market.name}</Link>
            </div>
          ) : market.method === "auto" ? (
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <Wand2 className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900 dark:text-white">ساخت خودکار در {market.name}</p>
                <p className="mt-1 text-xs leading-6 text-gray-500">
                  محصولات سایت را با عکس، توضیح، قیمت، موجودی و تنوع‌ها یک‌جا در {market.name} بسازید. نگاشت هر محصول و تنوع خودکار ثبت می‌شود و از آن به بعد موجودی و قیمتش همگام می‌ماند.
                </p>
              </div>
              <Link href={`/admin/integration/create-products?platform=${market.code}`} className={btn.primary}>
                <Sparkles className="h-4 w-4" aria-hidden />
                ساخت خودکار محصولات
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <Store className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-900 dark:text-white">قرار دادن دستی در {market.name}</p>
                  <p className="mt-1 text-xs leading-6 text-gray-500">
                    {market.name} ساخت محصول از بیرون را نمی‌پذیرد؛ محصول را در پنل فروشندگی خود {market.name} بسازید و بعد اینجا نگاشتش کنید.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {market.panelUrl && (
                    <a href={market.panelUrl} target="_blank" rel="noopener noreferrer" className={btn.soft}>
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      پنل فروشندگی
                    </a>
                  )}
                  <button type="button" onClick={() => fetchProducts(market.code)} className={btn.primary}>
                    <Download className="h-4 w-4" aria-hidden />
                    دریافت محصولات {market.name}
                  </button>
                </div>
              </div>
              <ol className="mt-4 grid gap-2 text-xs leading-6 text-gray-600 sm:grid-cols-3 dark:text-gray-300">
                <li className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><b>۱.</b> روی «کپی مشخصات» هر محصول بزنید و در پنل {market.name} محصول را بسازید. <b>کد کالا یا بارکد را همان کد سایت بگذارید</b> تا نگاشت خودکار شود.</li>
                <li className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><b>۲.</b> بعد از تأیید محصول در {market.name}، «دریافت محصولات» را بزنید.</li>
                <li className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><b>۳.</b> محصول با کد یا بارکد یکسان خودکار نگاشت می‌شود؛ بقیه در <Link href="/admin/integration/mapping/suggestions" className="font-bold text-teal-600">پیشنهادهای نگاشت</Link> منتظر تأیید شما می‌مانند.</li>
              </ol>
              {!market.panelUrl && (
                <p className="mt-2 text-[11px] text-gray-400">آدرس پنل فروشندگی را در <Link href="/admin/integration/settings" className="font-bold text-teal-600">تنظیمات</Link> وارد کنید تا دکمه‌ی «پنل فروشندگی» اینجا بیاید.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {data?.counts && market && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-60 flex-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{fa(data.counts.linked)} از {fa(data.counts.active)} محصول فعال سایت در {market.name} هست</span>
              <span>{fa(data.counts.active ? Math.round((data.counts.linked / data.counts.active) * 100) : 0)}٪</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${data.counts.active ? Math.min(100, (data.counts.linked / data.counts.active) * 100) : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {market && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="جستجوی نام، کد یا بارکد…"
              className={`${inputCls} pr-9`}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={inStock} onChange={(e) => { setInStock(e.target.checked); setPage(1); }} className="h-4 w-4 accent-teal-600" />
            فقط موجودها
          </label>
          {data && <span className="text-xs text-gray-400">{fa(data.total)} محصول هنوز در {market.name} نیست</span>}
        </div>
      )}

      {msg && <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{msg}</p>}

      {market && data && (
        <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
          {data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">همه‌ی محصولات {inStock ? "موجود " : ""}سایت در {market.name} هستند 🎉</p>
          ) : (
            data.items.map((p) => {
              const price = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {p.mainImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- تصویر کوچک فهرست
                    <img src={p.mainImage} alt="" className="h-11 w-11 flex-shrink-0 rounded-xl object-cover" loading="lazy" />
                  ) : (
                    <span className="h-11 w-11 flex-shrink-0 rounded-xl bg-gray-100 dark:bg-white/5" />
                  )}
                  <div className="min-w-48 flex-1">
                    <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-bold text-gray-900 hover:text-teal-600 dark:text-white">{p.title}</Link>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {fa(price)} تومان · موجودی {fa(p.stock)}
                      {p.sku ? ` · کد ${p.sku}` : ""}
                      {p.gtin13 ? ` · بارکد ${p.gtin13}` : ""}
                    </p>
                  </div>
                  {market.method === "auto" && market.connected ? (
                    <Link href={`/admin/integration/create-products?platform=${market.code}`} className={btn.small}>
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      ساخت در {market.name}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => copy(p)} className={btn.small}>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {copied === p.id ? "کپی شد" : "کپی مشخصات"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btn.small}>قبلی</button>
          <span className="text-xs text-gray-500">صفحه‌ی {fa(page)} از {fa(pages)}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className={btn.small}>بعدی</button>
        </div>
      )}
    </div>
  );
}
