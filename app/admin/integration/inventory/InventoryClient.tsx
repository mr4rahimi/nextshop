"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Card, api, btn, inputCls } from "@/components/admin/accounting/ui";

type Source = "internal" | "hesaban" | "site";

interface LinkRow {
  platformCode: string;
  platformName: string;
  externalId: string;
  externalTitle: string | null;
  shopProduct: { id: string; title: string; mainImage: string | null; stock: number } | null;
}

interface Item {
  id: string;
  stock: number;
  syncStockEnabled: boolean;
  lastStockSyncAt: string | null;
  purchasePrice: number | null;
  purchasePriceSource: "HESABAN" | "MANUAL";
  hasVariants: boolean;
  links: LinkRow[];
}

interface Resp {
  total: number;
  page: number;
  perPage: number;
  source: Source;
  items: Item[];
}

const fa = (n: number) => n.toLocaleString("fa-IR");

const SOURCE_NOTE: Record<Source, { title: string; body: string; action: string }> = {
  site: {
    title: "موجودی از خود سایت",
    body: "حسابداری وصل نیست؛ موجودی محصول سایت مرجع است. موجودی و قیمت خرید را همین‌جا وارد کنید تا به سایت و همه‌ی بازارگاه‌های نگاشت‌شده برسد.",
    action: "ارسال دوباره‌ی همه‌ی موجودی‌ها به بازارگاه‌ها",
  },
  internal: {
    title: "موجودی از حسابداری داخلی",
    body: "موجودی سایت از انبارهای فروش حسابداری می‌آید (فاکتور خرید، اول دوره، انبارگردانی) و خودکار به بازارگاه‌ها ارسال می‌شود. اینجا فقط می‌بینید و مدیریت هر محصول را روشن و خاموش می‌کنید.",
    action: "ارسال دوباره‌ی همه‌ی موجودی‌ها به بازارگاه‌ها",
  },
  hesaban: {
    title: "موجودی از حسابان وب",
    body: "موجودی و قیمت خرید از حسابان خوانده و به سایت و بازارگاه‌ها ارسال می‌شود. موجودی را در حسابان تغییر دهید؛ تغییر در سایت با دریافت بعدی بازنویسی می‌شود.",
    action: "دریافت موجودی از حسابان",
  },
};

/** موجودی محصولات نگاشت‌شده — docs/integrations/settings-and-guide.md */
export default function InventoryClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const sp = new URLSearchParams({ page: String(page), perPage: "30" });
    if (q.trim()) sp.set("q", q.trim());
    api<Resp>(`/api/integration/inventory?${sp}`).then(setData).catch((e) => setMsg(e.message));
  }, [page, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    setBusy(id);
    setMsg(null);
    try {
      await api("/api/integration/inventory", { method: "PATCH", json: { mappingId: id, ...body } });
      setMsg(ok);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(null);
    }
  }

  async function resync() {
    setBusy("resync");
    setMsg(null);
    try {
      const r = await api<{ jobs?: number; alreadyRunning?: boolean }>("/api/integration/inventory/resync", { method: "POST", json: {} });
      setMsg(r.alreadyRunning ? "یک همگام‌سازی از قبل در صف است" : `در صف قرار گرفت (${fa(r.jobs ?? 1)} سرویس) — چند دقیقه‌ی دیگر انجام می‌شود`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  const source = data?.source ?? "site";
  const note = SOURCE_NOTE[source];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-gray-900 dark:text-white">{note.title}</p>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            {note.body}{" "}
            <Link href="/admin/integration/guide" className="font-bold text-teal-600">راهنما</Link>
          </p>
        </div>
        <button type="button" onClick={resync} disabled={busy === "resync"} className={btn.soft}>
          <RefreshCw className={`h-4 w-4 ${busy === "resync" ? "animate-spin" : ""}`} aria-hidden />
          {note.action}
        </button>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="جستجوی نام محصول یا شناسه‌ی بازارگاه…"
            className={`${inputCls} pr-9`}
          />
        </div>
        {data && <p className="text-xs text-gray-400">{fa(data.total)} محصول نگاشت‌شده</p>}
      </div>

      {msg && <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{msg}</p>}

      <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
        {!data ? (
          <p className="py-12 text-center text-sm text-gray-400">در حال بارگذاری…</p>
        ) : data.items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {q ? "چیزی پیدا نشد" : (
              <>
                هنوز محصولی نگاشت نشده.{" "}
                <Link href="/admin/integration/mapping" className="font-bold text-teal-600">نگاشت محصولات</Link>
              </>
            )}
          </div>
        ) : (
          // کلید با عددها: بعد از ذخیره و بارگذاری دوباره، خانه‌ها مقدار تازه را می‌گیرند
          data.items.map((m) => (
            <Row
              key={`${m.id}:${m.links.find((l) => l.platformCode === "shop")?.shopProduct?.stock ?? m.stock}:${m.purchasePrice ?? ""}`}
              m={m}
              source={source}
              busy={busy === m.id}
              onPatch={patch}
            />
          ))
        )}
      </Card>

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

function Row({
  m,
  source,
  busy,
  onPatch,
}: {
  m: Item;
  source: Source;
  busy: boolean;
  onPatch: (id: string, body: Record<string, unknown>, ok: string) => void;
}) {
  const shop = m.links.find((l) => l.platformCode === "shop");
  const title = shop?.shopProduct?.title ?? shop?.externalTitle ?? m.links[0]?.externalTitle ?? "(بی‌عنوان)";
  const siteStock = shop?.shopProduct?.stock;
  const editable = source === "site" && !m.hasVariants;
  const [stock, setStock] = useState(String(siteStock ?? m.stock));
  const [price, setPrice] = useState(m.purchasePrice != null ? String(m.purchasePrice) : "");


  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-48 flex-1">
        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
          {shop ? <Link href={`/admin/products/${shop.externalId}`} className="hover:text-teal-600">{title}</Link> : title}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {m.links.map((l) => (
            <span key={l.platformCode} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/5">
              {l.platformName}
            </span>
          ))}
          {m.hasVariants && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600">تنوع‌دار — موجودی در صفحه‌ی محصول</span>}
          {!shop && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">بی محصول سایت</span>}
        </div>
      </div>

      {editable ? (
        <>
          <label className="w-24">
            <span className="text-[10px] font-bold text-gray-400">موجودی</span>
            <input
              type="number"
              min={0}
              value={stock}
              disabled={busy}
              onChange={(e) => setStock(e.target.value)}
              onBlur={() => Number(stock) !== (siteStock ?? m.stock) && stock !== "" && onPatch(m.id, { stock: Number(stock) }, "موجودی ذخیره و ارسال شد")}
              className={`${inputCls} py-1.5 text-center`}
            />
          </label>
          <label className="w-32">
            <span className="text-[10px] font-bold text-gray-400">قیمت خرید (تومان)</span>
            <input
              type="number"
              min={0}
              value={price}
              disabled={busy}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => {
                const next = price === "" ? null : Number(price);
                if (next !== m.purchasePrice) onPatch(m.id, { purchasePrice: next }, "قیمت خرید ذخیره و قیمت بازارگاه‌ها ارسال شد");
              }}
              className={`${inputCls} py-1.5 text-center`}
            />
          </label>
        </>
      ) : (
        <div className="w-24 text-center">
          <p className="text-lg font-black text-gray-900 dark:text-white">{fa(siteStock ?? m.stock)}</p>
          <p className="text-[10px] text-gray-400">موجودی</p>
        </div>
      )}

      <label className="flex flex-shrink-0 cursor-pointer items-center gap-2" title="خاموش = موجودی این محصول به بازارگاه‌ها ارسال نمی‌شود">
        <input
          type="checkbox"
          checked={m.syncStockEnabled}
          disabled={busy}
          onChange={() => onPatch(m.id, { syncStockEnabled: !m.syncStockEnabled }, m.syncStockEnabled ? "مدیریت موجودی خاموش شد" : "مدیریت موجودی روشن شد")}
          className="h-4 w-4 accent-teal-600"
        />
        <span className="text-xs font-bold text-gray-500">همگام</span>
      </label>
    </div>
  );
}
