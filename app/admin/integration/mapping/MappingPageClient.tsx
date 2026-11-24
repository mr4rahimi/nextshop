"use client";

/**
 * نگاشت محصولات — docs/integrations/mapping-page.md
 *
 * زبانه‌ها: پیشنهادها (همه‌ی سرویس‌ها، تأیید گروهی)، هر سرویس (محصولات دریافت‌شده با
 * وضعیت)، همه‌ی نگاشت‌ها (کارت هر محصول با سرویس‌هایش)، و در حالت حسابداری داخلی
 * «کالای حسابداری» (وصل کردن کالای بی‌محصول به محصول موجود سایت).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Boxes,
  Calculator,
  Check,
  ChevronLeft,
  Download,
  Layers,
  Link2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Card, Chips, Empty, ErrorText, Sheet, Stat, api, btn, inputCls } from "@/components/admin/accounting/ui";

// ── انواع ─────────────────────────────────────────────────────────────

type Source = "internal" | "hesaban" | "site";

interface Platform {
  code: string;
  name: string;
  type: "ACCOUNTING" | "MARKETPLACE";
}

interface ShopBrief {
  id: string;
  title: string;
  stock: number;
  price?: string | number;
  sku?: string | null;
  mainImage?: string | null;
}

interface RemoteRow {
  id: string;
  platformCode: string;
  platformProductId: string;
  title: string;
  sku: string | null;
  stock: number | null;
  price: number | string | null;
  mappingStatus: "mapped" | "suggested" | "unmapped";
  mappingId: string | null;
  shopProduct: ShopBrief | null;
  allLinks: { id: string; platformCode: string; externalId: string; externalTitle: string | null }[];
  suggestion: { id: string; confidence: number; matchReason: string | null; shopProduct: ShopBrief | null } | null;
}

interface MappingGroup {
  id: string;
  createdAt: string;
  links: { id: string; platformCode: string; externalId: string; externalTitle: string | null; shopProduct: ShopBrief | null }[];
}

interface Suggestion {
  id: string;
  platformCode: string;
  platformProductId: string;
  platformTitle: string | null;
  confidence: number;
  matchReason: string | null;
  shopProduct: ShopBrief | null;
  remote: { title: string; sku: string | null; stock: number | null; price: number | string | null } | null;
  platform: { name: string };
}

interface Props {
  platforms: Platform[];
  source: Source;
  initialTab: string;
  stats: { mappings: number; suggestions: number; unmappedBy: Record<string, number>; items: number | null; itemsMatched: number };
}

// ── کمکی‌ها ───────────────────────────────────────────────────────────

const fa = (n: number) => n.toLocaleString("fa-IR");
const money = (v: number | string | null | undefined) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? `${fa(n)} تومان` : null;
};
const platformName = (code: string, platforms: Platform[]) =>
  code === "shop" ? "سایت" : platforms.find((p) => p.code === code)?.name ?? code;

function PlatformIcon({ code, platforms, className = "h-4 w-4" }: { code: string; platforms: Platform[]; className?: string }) {
  if (code === "shop") return <Store className={className} aria-hidden />;
  const p = platforms.find((x) => x.code === code);
  return p?.type === "ACCOUNTING" ? <Calculator className={className} aria-hidden /> : <Package className={className} aria-hidden />;
}

function Thumb({ src }: { src?: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5">
      <Package className="h-4 w-4" aria-hidden />
    </span>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-400">{children}</p>;
}

function confidenceTone(c: number): "green" | "amber" | "red" {
  return c >= 0.85 ? "green" : c >= 0.7 ? "amber" : "red";
}

/** مقدار با تأخیر — جستجو با هر حرف درخواست نفرستد */
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pr-9`} />
    </div>
  );
}

function Pager({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 p-3">
      <button type="button" className={btn.small} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        قبلی
      </button>
      <span className="text-xs text-gray-500">
        صفحه {fa(page)} از {fa(pages)}
      </span>
      <button type="button" className={btn.small} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        بعدی
      </button>
    </div>
  );
}

// ── انتخابگر محصول (سایت یا سرویس) ───────────────────────────────────

interface Pick {
  id: string;
  title: string;
  /** محصول سایتی که همین حالا نگاشت دارد */
  mappingId?: string | null;
  mappedOn?: string[];
}

interface ShopHit {
  id: string;
  title: string;
  sku: string | null;
  stock: number;
  price: number;
  image: string | null;
  isActive: boolean;
  hasVariants: boolean;
  mappingId: string | null;
  mappedOn: string[];
}

function Picker({
  platformCode,
  platforms,
  initialQ = "",
  onPick,
  exclude,
}: {
  platformCode: string;
  platforms: Platform[];
  initialQ?: string;
  onPick: (p: Pick) => void;
  /** سرویسی که محصول سایتِ نگاشت‌شده روی آن نباید محصول دیگری داشته باشد */
  exclude?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const dq = useDebounced(q.trim());
  const [hits, setHits] = useState<{ q: string; shop: ShopHit[]; remote: RemoteRow[] } | null>(null);
  const isShop = platformCode === "shop";

  useEffect(() => {
    if (!dq) return;
    let live = true;
    const url = isShop
      ? `/api/integration/mapping/shop-search?q=${encodeURIComponent(dq)}`
      : `/api/integration/platform-products?platformCode=${encodeURIComponent(platformCode)}&status=unmapped&pageSize=20&q=${encodeURIComponent(dq)}`;
    api<{ items: ShopHit[] | RemoteRow[] }>(url)
      .then((r) => {
        if (!live) return;
        setHits(isShop ? { q: dq, shop: r.items as ShopHit[], remote: [] } : { q: dq, shop: [], remote: r.items as RemoteRow[] });
      })
      .catch(() => live && setHits({ q: dq, shop: [], remote: [] }));
    return () => {
      live = false;
    };
  }, [dq, isShop, platformCode]);

  const shown = dq && hits?.q === dq ? hits : null;
  const loading = !!dq && !shown;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isShop ? "نام، SKU یا بارکد محصول سایت…" : `جستجو در ${platformName(platformCode, platforms)}…`}
          className={`${inputCls} pr-9`}
        />
      </div>
      <div className="max-h-64 divide-y divide-[var(--adm-border)] overflow-y-auto rounded-xl border border-[var(--adm-border)]">
        {!dq && <p className="p-4 text-center text-xs text-gray-400">نام محصول را بنویسید</p>}
        {loading && <p className="p-4 text-center text-xs text-gray-400">در حال جستجو…</p>}
        {shown && !shown.shop.length && !shown.remote.length && (
          <p className="p-4 text-center text-xs text-gray-400">
            {isShop ? "محصولی پیدا نشد" : "محصول بی‌نگاشتی با این نام نیست — اگر تازه ساخته‌اید «دریافت محصولات» را بزنید"}
          </p>
        )}
        {shown?.shop.map((h) => {
          const clash = !!exclude && h.mappedOn.includes(exclude);
          return (
            <button
              key={h.id}
              type="button"
              disabled={clash}
              onClick={() => onPick({ id: h.id, title: h.title, mappingId: h.mappingId, mappedOn: h.mappedOn })}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-right transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-blue-500/10"
            >
              <Thumb src={h.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{h.title}</p>
                <Meta>
                  {h.sku && <span>SKU {h.sku}</span>}
                  <span>موجودی {fa(h.stock)}</span>
                  {money(h.price) && <span>{money(h.price)}</span>}
                </Meta>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {!h.isActive && <Badge tone="gray">پیش‌نویس</Badge>}
                {h.hasVariants && <Badge tone="blue">تنوع‌دار</Badge>}
                {clash ? (
                  <Badge tone="red">در این سرویس نگاشت دارد</Badge>
                ) : h.mappingId ? (
                  <Badge tone="amber">به نگاشت فعلی‌اش اضافه می‌شود</Badge>
                ) : null}
              </div>
            </button>
          );
        })}
        {shown?.remote.map((h) => (
          <button
            key={h.platformProductId}
            type="button"
            onClick={() => onPick({ id: h.platformProductId, title: h.title })}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-right transition hover:bg-blue-50 dark:hover:bg-blue-500/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5">
              <PlatformIcon code={platformCode} platforms={platforms} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{h.title}</p>
              <Meta>
                <span>کد {h.platformProductId}</span>
                {h.sku && <span>SKU {h.sku}</span>}
                {h.stock != null && <span>موجودی {fa(h.stock)}</span>}
                {money(h.price) && <span>{money(h.price)}</span>}
              </Meta>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── پنجره‌ی نگاشت تازه ────────────────────────────────────────────────

function MappingSheet({
  origin,
  platforms,
  source,
  onClose,
  onDone,
}: {
  origin: { platformCode: string; id: string; title: string };
  platforms: Platform[];
  source: Source;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const others = ["shop", ...platforms.map((p) => p.code)].filter((c) => c !== origin.platformCode);
  const [picks, setPicks] = useState<Record<string, Pick | null>>({});
  const [open, setOpen] = useState<string | null>(others[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shopPick = picks.shop;
  const chosen = Object.entries(picks).filter(([, v]) => v) as [string, Pick][];
  // محصول سایتِ نگاشت‌دار: سرویس‌هایی که همین حالا دارد قابل انتخاب نیستند
  const taken = new Set(shopPick?.mappedOn ?? []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const links = [
        { platformCode: origin.platformCode, externalId: origin.id, externalTitle: origin.title },
        ...chosen.filter(([code]) => !taken.has(code)).map(([code, p]) => ({ platformCode: code, externalId: p.id, externalTitle: p.title })),
      ];
      const r = await api<{ attached?: boolean }>("/api/integration/mapping", { method: "POST", json: { links } });
      onDone(r.attached ? "به نگاشت فعلی محصول اضافه شد" : "نگاشت ساخته شد");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="نگاشت محصول"
      help="integrationMapping"
      wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400">
            {chosen.length ? `${fa(chosen.length + 1)} محصول در این نگاشت` : "دست‌کم یک محصول دیگر انتخاب کنید"}
          </p>
          <button type="button" className={btn.primary} disabled={busy || !chosen.length} onClick={save}>
            <Link2 className="h-4 w-4" aria-hidden />
            {busy ? "در حال ذخیره…" : "ذخیره‌ی نگاشت"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-blue-500/5 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <PlatformIcon code={origin.platformCode} platforms={platforms} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-blue-600">{platformName(origin.platformCode, platforms)}</p>
            <p className="truncate text-sm font-black text-gray-900 dark:text-white">{origin.title}</p>
          </div>
        </div>

        {others.map((code) => {
          const p = picks[code];
          const isTaken = code !== "shop" && taken.has(code);
          const isOpen = open === code && !p && !isTaken;
          return (
            <div key={code} className="rounded-2xl border border-[var(--adm-border)] p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5">
                  <PlatformIcon code={code} platforms={platforms} />
                </span>
                <p className="flex-1 text-sm font-black text-gray-900 dark:text-white">
                  {platformName(code, platforms)}
                  {code === "shop" && <span className="mr-1 text-[11px] font-bold text-gray-400">(پیشنهادی)</span>}
                </p>
                {isTaken ? (
                  <Badge tone="green">همین حالا در نگاشت است</Badge>
                ) : p ? (
                  <button type="button" className={btn.small} onClick={() => { setPicks((x) => ({ ...x, [code]: null })); setOpen(code); }}>
                    تغییر
                  </button>
                ) : !isOpen ? (
                  <button type="button" className={btn.small} onClick={() => setOpen(code)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    انتخاب
                  </button>
                ) : null}
              </div>
              {p && (
                <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{p.title}</span>
                </p>
              )}
              {isOpen && (
                <div className="mt-3">
                  <Picker
                    platformCode={code}
                    platforms={platforms}
                    initialQ={code === "shop" ? origin.title.split(/\s+/).slice(0, 3).join(" ") : ""}
                    exclude={code === "shop" ? origin.platformCode : undefined}
                    onPick={(x) => {
                      setPicks((prev) => ({ ...prev, [code]: x }));
                      const next = others.find((c) => c !== code && !picks[c] && !(x.mappedOn ?? []).includes(c));
                      setOpen(next ?? null);
                    }}
                  />
                  <p className="mt-2 text-[11px] text-gray-400">
                    {code === "shop"
                      ? "اگر محصول هنوز در سایت نیست، این قدم را رها کنید."
                      : "اگر این محصول آنجا نیست، رها کنید؛ بعداً از «قرار دادن محصول» می‌سازیدش."}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {source === "site" && (
          <p className="text-[11px] leading-5 text-gray-500">
            موجودی اولیه‌ی نگاشت همان موجودی محصول سایت است؛ بعداً در «موجودی» عوضش کنید.
          </p>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ── پنجره‌ی ویرایش نگاشت ──────────────────────────────────────────────

function EditSheet({
  mappingId,
  platforms,
  focus,
  onClose,
  onChanged,
}: {
  mappingId: string;
  platforms: Platform[];
  focus?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [group, setGroup] = useState<MappingGroup | null>(null);
  const [adding, setAdding] = useState<string | null>(focus ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api<{ mappings: MappingGroup[] }>(`/api/integration/mapping?id=${encodeURIComponent(mappingId)}&perPage=10`)
      .then((r) => live && setGroup(r.mappings[0] ?? null))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [mappingId, tick]);

  const codes = ["shop", ...platforms.map((p) => p.code)];
  const byCode = new Map((group?.links ?? []).map((l) => [l.platformCode, l]));

  async function remove(linkId: string) {
    if (!confirm("این محصول از نگاشت جدا شود؟")) return;
    setBusy(linkId);
    setError(null);
    try {
      await api(`/api/integration/mapping/link?id=${linkId}`, { method: "DELETE" });
      setTick((t) => t + 1);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function add(code: string, p: Pick) {
    setBusy(code);
    setError(null);
    try {
      await api("/api/integration/mapping/link", { method: "POST", json: { mappingId, platformCode: code, externalId: p.id, externalTitle: p.title } });
      setAdding(null);
      setTick((t) => t + 1);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open onClose={onClose} title="ویرایش نگاشت" wide footer={<button type="button" className={`${btn.dark} w-full`} onClick={onClose}>تمام</button>}>
      {!group ? (
        <p className="py-8 text-center text-sm text-gray-400">{error ?? "در حال بارگذاری…"}</p>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => {
            const l = byCode.get(code);
            const title = l ? (code === "shop" && l.shopProduct ? l.shopProduct.title : l.externalTitle ?? l.externalId) : null;
            return (
              <div key={code} className="rounded-2xl border border-[var(--adm-border)] p-3">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${l ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-100 text-gray-400 dark:bg-white/5"}`}>
                    <PlatformIcon code={code} platforms={platforms} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-gray-400">{platformName(code, platforms)}</p>
                    <p className={`truncate text-sm font-bold ${l ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>{title ?? "وصل نیست"}</p>
                  </div>
                  {l ? (
                    <button type="button" className={btn.small} disabled={busy === l.id} onClick={() => remove(l.id)}>
                      <X className="h-3.5 w-3.5" aria-hidden />
                      جدا کردن
                    </button>
                  ) : adding !== code ? (
                    <button type="button" className={btn.small} onClick={() => setAdding(code)}>
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      افزودن
                    </button>
                  ) : null}
                </div>
                {!l && adding === code && (
                  <div className="mt-3">
                    <Picker platformCode={code} platforms={platforms} initialQ="" onPick={(p) => add(code, p)} />
                  </div>
                )}
              </div>
            );
          })}
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Sheet>
  );
}

// ── زبانه‌ی پیشنهادها ─────────────────────────────────────────────────

function SuggestionsTab({ platforms, onChanged, onPickOther }: { platforms: Platform[]; onChanged: () => void; onPickOther: (s: Suggestion) => void }) {
  const [platform, setPlatform] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; suggestions: Suggestion[] } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    const sp = new URLSearchParams({ page: String(page), perPage: "50" });
    if (platform) sp.set("platform", platform);
    api<{ total: number; suggestions: Suggestion[] }>(`/api/integration/mapping/suggestions?${sp}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setMsg((e as Error).message));
    return () => {
      live = false;
    };
  }, [platform, page, tick]);

  async function act(ids: string[], action: "approve" | "reject") {
    setBusy(ids.length === 1 ? ids[0] : "bulk");
    setMsg(null);
    try {
      const r = await api<{ done: number; failed: number; error: string | null }>("/api/integration/mapping/suggestions", { method: "PATCH", json: { ids, action } });
      setMsg(
        `${fa(r.done)} پیشنهاد ${action === "approve" ? "تأیید" : "رد"} شد` + (r.failed ? ` — ${fa(r.failed)} مورد انجام نشد: ${r.error}` : ""),
      );
      setSel(new Set());
      setTick((t) => t + 1);
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const list = data?.suggestions ?? [];
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Sparkles className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-6 text-gray-500">
          بعد از هر «دریافت محصولات»، سیستم محصولات هم‌نام، هم‌کد یا هم‌بارکد را جفت می‌کند. بالای ۸۵٪ معمولاً درست است؛ بقیه را نگاه کنید.
        </p>
        {list.length > 0 && (
          <button type="button" className={btn.small} onClick={() => setSel(new Set(list.filter((s) => s.confidence >= 0.85).map((s) => s.id)))}>
            انتخاب همه‌ی بالای ۸۵٪
          </button>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Chips
          value={platform}
          onChange={(v) => {
            setPlatform(v);
            setPage(1);
          }}
          options={[{ value: "", label: "همه" }, ...platforms.map((p) => ({ value: p.code, label: p.name }))]}
        />
        {sel.size > 0 && (
          <div className="mr-auto flex gap-2">
            <button type="button" className={btn.primary} disabled={!!busy} onClick={() => act([...sel], "approve")}>
              <Check className="h-4 w-4" aria-hidden />
              تأیید {fa(sel.size)} پیشنهاد
            </button>
            <button type="button" className={btn.soft} disabled={!!busy} onClick={() => act([...sel], "reject")}>
              رد
            </button>
          </div>
        )}
      </div>
      {msg && <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{msg}</p>}

      <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
        {!data ? (
          <p className="py-12 text-center text-sm text-gray-400">در حال بارگذاری…</p>
        ) : !list.length ? (
          <Empty title="پیشنهادی در انتظار نیست" desc="با «دریافت محصولات» در زبانه‌ی هر بازارگاه، پیشنهادهای تازه ساخته می‌شود." />
        ) : (
          list.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-blue-600" aria-label="انتخاب" />
              <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                    <PlatformIcon code={s.platformCode} platforms={platforms} className="h-3.5 w-3.5" />
                    {s.platform.name}
                  </p>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.remote?.title ?? s.platformTitle ?? s.platformProductId}</p>
                  <Meta>
                    {s.remote?.sku && <span>SKU {s.remote.sku}</span>}
                    {s.remote?.stock != null && <span>موجودی {fa(s.remote.stock)}</span>}
                    {money(s.remote?.price) && <span>{money(s.remote?.price)}</span>}
                  </Meta>
                </div>
                <ArrowLeftRight className="hidden h-4 w-4 text-gray-300 sm:block" aria-hidden />
                <div className="flex min-w-0 items-center gap-2">
                  <Thumb src={s.shopProduct?.mainImage} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-400">سایت</p>
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.shopProduct?.title ?? "محصول حذف شده"}</p>
                    <Meta>
                      {s.shopProduct?.sku && <span>SKU {s.shopProduct.sku}</span>}
                      {s.shopProduct && <span>موجودی {fa(s.shopProduct.stock)}</span>}
                    </Meta>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge tone={confidenceTone(s.confidence)}>
                  {fa(Math.round(s.confidence * 100))}٪ {s.matchReason ? `· ${s.matchReason}` : ""}
                </Badge>
                <div className="flex gap-1">
                  <button type="button" className={btn.small} disabled={!!busy} onClick={() => act([s.id], "approve")}>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    تأیید
                  </button>
                  <button type="button" className={btn.small} disabled={!!busy} onClick={() => onPickOther(s)}>
                    انتخاب دیگر
                  </button>
                  <button type="button" className={btn.small} disabled={!!busy} onClick={() => act([s.id], "reject")} aria-label="رد">
                    <X className="h-3.5 w-3.5 text-red-500" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        {data && <Pager page={page} total={data.total} perPage={50} onPage={setPage} />}
      </Card>
    </div>
  );
}

// ── زبانه‌ی هر سرویس ──────────────────────────────────────────────────

type Status = "all" | "unmapped" | "suggested" | "mapped";

function PlatformTab({
  platform,
  onMap,
  onEdit,
  onChanged,
  tick,
}: {
  platform: Platform;
  onMap: (row: RemoteRow) => void;
  onEdit: (mappingId: string) => void;
  onChanged: () => void;
  tick: number;
}) {
  const [status, setStatus] = useState<Status>("unmapped");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: RemoteRow[]; total: number; counts: Record<Status, number>; lastFetchedAt: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [own, setOwn] = useState(0);

  useEffect(() => {
    let live = true;
    const sp = new URLSearchParams({ platformCode: platform.code, page: String(page), pageSize: "30" });
    if (status !== "all") sp.set("status", status);
    if (dq) sp.set("q", dq);
    api<{ items: RemoteRow[]; total: number; counts: Record<Status, number>; lastFetchedAt: string | null }>(`/api/integration/platform-products?${sp}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setMsg((e as Error).message));
    return () => {
      live = false;
    };
  }, [platform.code, status, dq, page, tick, own]);

  async function fetchProducts() {
    setBusy("fetch");
    setMsg(null);
    try {
      await api("/api/integration/sync", { method: "POST", json: { platformCode: platform.code, type: "FETCH_PRODUCTS", priority: 1 } });
      setMsg("در صف قرار گرفت — چند دقیقه‌ی دیگر محصولات تازه و پیشنهادها اینجا می‌آیند");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function suggestion(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      await api("/api/integration/mapping/suggestions", { method: "PATCH", json: { id, action } });
      setOwn((t) => t + 1);
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const c = data?.counts;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={`نام، کد یا SKU در ${platform.name}…`}
        />
        <button type="button" className={btn.soft} disabled={busy === "fetch"} onClick={fetchProducts}>
          <Download className="h-4 w-4" aria-hidden />
          دریافت محصولات
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chips
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "unmapped", label: "بی‌نگاشت", count: c?.unmapped },
            { value: "suggested", label: "پیشنهاد", count: c?.suggested },
            { value: "mapped", label: "نگاشت‌شده", count: c?.mapped },
            { value: "all", label: "همه", count: c?.all },
          ]}
        />
        {data?.lastFetchedAt && (
          <span className="mr-auto text-[11px] text-gray-400">
            آخرین دریافت: {new Date(data.lastFetchedAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )}
      </div>
      {msg && <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{msg}</p>}

      <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
        {!data ? (
          <p className="py-12 text-center text-sm text-gray-400">در حال بارگذاری…</p>
        ) : c && c.all === 0 && !dq ? (
          <Empty
            title={`هنوز محصولی از ${platform.name} دریافت نشده`}
            desc="«دریافت محصولات» را بزنید؛ محصولات هم‌کد و هم‌بارکد خودکار نگاشت و بقیه پیشنهاد می‌شوند."
            action={
              <button type="button" className={btn.primary} disabled={busy === "fetch"} onClick={fetchProducts}>
                <Download className="h-4 w-4" aria-hidden />
                دریافت محصولات
              </button>
            }
          />
        ) : !data.items.length ? (
          <Empty title={status === "unmapped" ? "همه نگاشت شده‌اند 🎉" : "موردی نیست"} />
        ) : (
          data.items.map((r) => (
            <div key={r.platformProductId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.mappingStatus === "mapped" ? "bg-emerald-500" : r.mappingStatus === "suggested" ? "bg-amber-400" : "bg-red-400"}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{r.title}</p>
                <Meta>
                  <span>کد {r.platformProductId}</span>
                  {r.sku && <span>SKU {r.sku}</span>}
                  {r.stock != null && <span>موجودی {fa(r.stock)}</span>}
                  {money(r.price) && <span>{money(r.price)}</span>}
                </Meta>
              </div>

              {r.mappingStatus === "mapped" && (
                <>
                  <div className="hidden min-w-0 max-w-[40%] items-center gap-2 sm:flex">
                    <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
                    {r.shopProduct ? (
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-emerald-600">{r.shopProduct.title}</p>
                        <Meta>
                          <span>موجودی سایت {fa(r.shopProduct.stock)}</span>
                          <span>{fa(r.allLinks.length)} سرویس</span>
                        </Meta>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-amber-600">بی محصول سایت</p>
                    )}
                  </div>
                  <button type="button" className={btn.small} onClick={() => r.mappingId && onEdit(r.mappingId)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    ویرایش
                  </button>
                </>
              )}

              {r.mappingStatus === "suggested" && r.suggestion && (
                <>
                  <div className="hidden min-w-0 max-w-[40%] items-center gap-2 sm:flex">
                    <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-amber-600">{r.suggestion.shopProduct?.title ?? "—"}</p>
                      <Meta>
                        <span>اطمینان {fa(Math.round(r.suggestion.confidence * 100))}٪</span>
                        {r.suggestion.matchReason && <span>{r.suggestion.matchReason}</span>}
                      </Meta>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className={btn.small} disabled={busy === r.suggestion.id} onClick={() => suggestion(r.suggestion!.id, "approve")}>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      تأیید
                    </button>
                    <button type="button" className={btn.small} onClick={() => onMap(r)}>
                      انتخاب دیگر
                    </button>
                    <button type="button" className={btn.small} disabled={busy === r.suggestion.id} onClick={() => suggestion(r.suggestion!.id, "reject")} aria-label="رد">
                      <X className="h-3.5 w-3.5 text-red-500" aria-hidden />
                    </button>
                  </div>
                </>
              )}

              {r.mappingStatus === "unmapped" && (
                <button type="button" className={btn.primary} onClick={() => onMap(r)}>
                  <Link2 className="h-4 w-4" aria-hidden />
                  نگاشت
                </button>
              )}
            </div>
          ))
        )}
        {data && <Pager page={page} total={data.total} perPage={30} onPage={setPage} />}
      </Card>
    </div>
  );
}

// ── زبانه‌ی همه‌ی نگاشت‌ها ────────────────────────────────────────────

function AllTab({ platforms, onEdit, onChanged, tick }: { platforms: Platform[]; onEdit: (id: string, focus?: string) => void; onChanged: () => void; tick: number }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [missing, setMissing] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; mappings: MappingGroup[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [own, setOwn] = useState(0);

  useEffect(() => {
    let live = true;
    const sp = new URLSearchParams({ page: String(page), perPage: "30" });
    if (dq) sp.set("q", dq);
    if (missing) sp.set("missing", missing);
    api<{ total: number; mappings: MappingGroup[] }>(`/api/integration/mapping?${sp}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setMsg((e as Error).message));
    return () => {
      live = false;
    };
  }, [dq, missing, page, tick, own]);

  async function remove(id: string) {
    if (!confirm("کل این نگاشت حذف شود؟ محصولات در سایت و بازارگاه‌ها می‌مانند؛ فقط ارتباطشان قطع می‌شود.")) return;
    try {
      await api(`/api/integration/mapping?id=${id}`, { method: "DELETE" });
      setOwn((t) => t + 1);
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const codes = ["shop", ...platforms.map((p) => p.code)];
  return (
    <div className="space-y-3">
      <SearchBox
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        placeholder="نام محصول، SKU یا کد بازارگاه…"
      />
      <Chips
        value={missing}
        onChange={(v) => {
          setMissing(v);
          setPage(1);
        }}
        options={[{ value: "", label: "همه", count: missing ? undefined : data?.total }, ...codes.map((c) => ({ value: c, label: `بدون ${platformName(c, platforms)}` }))]}
      />
      {msg && <ErrorText>{msg}</ErrorText>}

      <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
        {!data ? (
          <p className="py-12 text-center text-sm text-gray-400">در حال بارگذاری…</p>
        ) : !data.mappings.length ? (
          <Empty title={dq || missing ? "چیزی پیدا نشد" : "هنوز نگاشتی ساخته نشده"} />
        ) : (
          data.mappings.map((m) => {
            const byCode = new Map(m.links.map((l) => [l.platformCode, l]));
            const shop = byCode.get("shop")?.shopProduct ?? null;
            const head = shop?.title ?? m.links[0]?.externalTitle ?? m.links[0]?.externalId ?? "—";
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Thumb src={shop?.mainImage} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{head}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {codes.map((code) => {
                      const l = byCode.get(code);
                      return l ? (
                        <span
                          key={code}
                          title={code === "shop" ? shop?.title : l.externalTitle ?? l.externalId}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
                        >
                          <PlatformIcon code={code} platforms={platforms} className="h-3 w-3" />
                          {platformName(code, platforms)}
                          {code === "shop" && shop ? ` · ${fa(shop.stock)}` : ""}
                        </span>
                      ) : (
                        <button
                          key={code}
                          type="button"
                          onClick={() => onEdit(m.id, code)}
                          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2 py-0.5 text-[11px] font-bold text-gray-400 transition hover:border-blue-400 hover:text-blue-600 dark:border-white/15"
                        >
                          <Plus className="h-3 w-3" aria-hidden />
                          {platformName(code, platforms)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" className={btn.small} onClick={() => onEdit(m.id)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    ویرایش
                  </button>
                  <button type="button" className={btn.small} onClick={() => remove(m.id)} aria-label="حذف نگاشت">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })
        )}
        {data && <Pager page={page} total={data.total} perPage={30} onPage={setPage} />}
      </Card>
    </div>
  );
}

// ── زبانه‌ی کالای حسابداری (حالت داخلی) ───────────────────────────────

interface Candidate {
  item: { id: string; code: string; title: string; qty: number; barcodes: string[] };
  match: { id: string; title: string; sku: string | null; stock: number; mainImage: string | null; reason: string } | null;
}

interface LinkPlan {
  mode: "absorb" | "alias" | "merge";
  product: { id: string; title: string; sku: string | null; stock: number };
  productItem: { code: string; title: string; uses: string[] };
  item: { id: string; code: string; title: string; uses: string[]; qty: number };
  notes: string[];
}

const MODE_LABEL: Record<LinkPlan["mode"], { label: string; tone: "green" | "blue" | "amber" }> = {
  absorb: { label: "کالا جای کالای خالی محصول را می‌گیرد", tone: "green" },
  alias: { label: "کد و بارکد کالا به محصول اضافه می‌شود", tone: "blue" },
  merge: { label: "ادغام کاردکس دو کالا", tone: "amber" },
};

function LinkItemSheet({ item, product, platforms, onClose, onDone }: {
  item: Candidate["item"];
  product: { id: string; title: string } | null;
  platforms: Platform[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [target, setTarget] = useState(product);
  const [plan, setPlan] = useState<{ key: string; plan?: LinkPlan; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    let live = true;
    const key = target.id;
    api<LinkPlan>(`/api/admin/accounting/items/link?productId=${encodeURIComponent(target.id)}&itemId=${encodeURIComponent(item.id)}`)
      .then((p) => live && setPlan({ key, plan: p }))
      .catch((e) => live && setPlan({ key, error: (e as Error).message }));
    return () => {
      live = false;
    };
  }, [target, item.id]);

  const current = target && plan?.key === target.id ? plan : null;

  async function confirmLink() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/accounting/items/link", { method: "POST", json: { productId: target.id, itemId: item.id } });
      onDone(`«${item.title}» به «${target.title}» وصل شد`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="وصل کردن کالا به محصول سایت"
      wide
      footer={
        target ? (
          <div className="flex items-center justify-between gap-2">
            <button type="button" className={btn.soft} onClick={() => setTarget(null)}>
              محصول دیگر
            </button>
            <button type="button" className={btn.primary} disabled={busy || !current?.plan} onClick={confirmLink}>
              <Link2 className="h-4 w-4" aria-hidden />
              {busy ? "در حال وصل کردن…" : "وصل کن"}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-violet-500/5 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
            <Boxes className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-violet-600">کالای حسابداری · کد {item.code}</p>
            <p className="truncate text-sm font-black text-gray-900 dark:text-white">{item.title}</p>
            <Meta>
              <span>موجودی انبار فروش {fa(item.qty)}</span>
            </Meta>
          </div>
        </div>

        {!target ? (
          <>
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">محصول سایتِ همین کالا را پیدا کنید:</p>
            <Picker platformCode="shop" platforms={platforms} initialQ={item.title.split(/\s+/).slice(0, 3).join(" ")} onPick={(p) => setTarget({ id: p.id, title: p.title })} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/5 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Store className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-emerald-600">محصول سایت</p>
                <p className="truncate text-sm font-black text-gray-900 dark:text-white">{target.title}</p>
                {current?.plan && (
                  <Meta>
                    {current.plan.product.sku && <span>SKU {current.plan.product.sku}</span>}
                    <span>موجودی سایت {fa(current.plan.product.stock)}</span>
                    <span>کد حسابداری فعلی {current.plan.productItem.code}</span>
                  </Meta>
                )}
              </div>
            </div>
            {!current ? (
              <p className="text-center text-xs text-gray-400">در حال بررسی…</p>
            ) : current.error ? (
              <ErrorText>{current.error}</ErrorText>
            ) : current.plan ? (
              <div className="space-y-2 rounded-2xl border border-[var(--adm-border)] p-3">
                <Badge tone={MODE_LABEL[current.plan.mode].tone}>{MODE_LABEL[current.plan.mode].label}</Badge>
                <ul className="list-disc space-y-1 pr-5 text-xs leading-6 text-gray-600 dark:text-gray-300">
                  {current.plan.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                {(current.plan.item.uses.length > 0 || current.plan.productItem.uses.length > 0) && (
                  <p className="text-[11px] text-gray-400">
                    گردش کالا: {current.plan.item.uses.join("، ") || "ندارد"} — گردش کالای فعلی محصول: {current.plan.productItem.uses.join("، ") || "ندارد"}
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function ItemsTab({ platforms, onChanged, matchedCount }: { platforms: Platform[]; onChanged: () => void; matchedCount: number }) {
  const [only, setOnly] = useState<"matched" | "all">(matchedCount > 0 ? "matched" : "all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: Candidate[] } | null>(null);
  const [linking, setLinking] = useState<{ item: Candidate["item"]; product: { id: string; title: string } | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    const sp = new URLSearchParams({ page: String(page), perPage: "30" });
    if (dq) sp.set("q", dq);
    if (only === "matched") sp.set("matched", "1");
    api<{ total: number; items: Candidate[] }>(`/api/admin/accounting/items/link?${sp}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setMsg((e as Error).message));
    return () => {
      live = false;
    };
  }, [dq, only, page, tick]);

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-start gap-3 p-4">
        <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" aria-hidden />
        <div className="min-w-0 flex-1 text-xs leading-6 text-gray-500">
          <p className="font-black text-gray-900 dark:text-white">کالاهای حسابداری که هنوز محصول سایت ندارند</p>
          در حسابداری داخلی هر محصول سایت خودش یک کالاست. اگر کالایی را جدا ساخته‌اید (مثلاً در فاکتور خرید) و همان محصول در سایت هم
          هست، اینجا به هم وصلشان کنید تا موجودی و بهای خرید یکی شود. اگر محصولش در سایت نیست،{" "}
          <Link href="/admin/accounting/inventory/to-product" className="font-bold text-teal-600">
            ساخت محصول از کالا
          </Link>{" "}
          را بزنید؛ محصول ساخته‌شده خودکار به کالا وصل است.
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="نام، کد یا بارکد کالا…"
        />
        <Chips
          value={only}
          onChange={(v) => {
            setOnly(v);
            setPage(1);
          }}
          options={[
            { value: "matched", label: "با پیشنهاد" },
            { value: "all", label: "همه" },
          ]}
        />
      </div>
      {msg && <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{msg}</p>}

      <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
        {!data ? (
          <p className="py-12 text-center text-sm text-gray-400">در حال بارگذاری…</p>
        ) : !data.items.length ? (
          <Empty title={only === "matched" && !dq ? "پیشنهادی نیست" : "کالای بی‌محصولی نیست"} desc={only === "matched" ? "«همه» را بزنید تا کالاهای بی‌پیشنهاد را هم ببینید." : undefined} />
        ) : (
          data.items.map((c) => (
            <div key={c.item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Boxes className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{c.item.title}</p>
                <Meta>
                  <span>کد {c.item.code}</span>
                  <span>موجودی {fa(c.item.qty)}</span>
                </Meta>
              </div>
              {c.match ? (
                <>
                  <div className="flex min-w-0 max-w-full items-center gap-2 sm:max-w-[40%]">
                    <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
                    <Thumb src={c.match.mainImage} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-emerald-600">{c.match.title}</p>
                      <Meta>
                        <span>{c.match.reason}</span>
                        <span>موجودی سایت {fa(c.match.stock)}</span>
                      </Meta>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className={btn.small} onClick={() => setLinking({ item: c.item, product: { id: c.match!.id, title: c.match!.title } })}>
                      <Link2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      وصل کن
                    </button>
                    <button type="button" className={btn.small} onClick={() => setLinking({ item: c.item, product: null })}>
                      محصول دیگر
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" className={btn.small} onClick={() => setLinking({ item: c.item, product: null })}>
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  انتخاب محصول سایت
                </button>
              )}
            </div>
          ))
        )}
        {data && <Pager page={page} total={data.total} perPage={30} onPage={setPage} />}
      </Card>

      {linking && (
        <LinkItemSheet
          item={linking.item}
          product={linking.product}
          platforms={platforms}
          onClose={() => setLinking(null)}
          onDone={(m) => {
            setLinking(null);
            setMsg(m);
            setTick((t) => t + 1);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// ── صفحه ──────────────────────────────────────────────────────────────

const SOURCE_TIP: Record<Source, string> = {
  internal: "حسابداری داخلی: هر محصول سایت خودش کالای حسابداری است. اینجا محصول سایت را به بازارگاه‌ها وصل کنید و کالاهای جدا را در «کالای حسابداری» به محصولشان.",
  site: "بدون حسابداری: موجودی محصول سایت مرجع است. بعد از نگاشت، موجودی و قیمت خرید را در «موجودی» وارد کنید.",
  hesaban: "حسابان وب: هر نگاشت باید کالای حسابان را هم داشته باشد تا موجودی از حسابان بیاید و فاکتور ثبت شود.",
};

export default function MappingPageClient({ platforms, source, initialTab, stats }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [tick, setTick] = useState(0);
  const [mapping, setMapping] = useState<{ platformCode: string; id: string; title: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; focus?: string | null } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const router = useRouter();
  // آمار بالای صفحه از سرور می‌آید — بعد از هر تغییر تازه می‌شود
  const changed = useCallback(() => {
    setTick((t) => t + 1);
    router.refresh();
  }, [router]);

  const unmappedTotal = Object.values(stats.unmappedBy).reduce((s, n) => s + n, 0);

  const tabs: { key: string; label: string; icon: ReactNode; count?: number; tone?: string }[] = [
    { key: "suggestions", label: "پیشنهادها", icon: <Sparkles className="h-4 w-4" aria-hidden />, count: stats.suggestions, tone: "bg-amber-500 text-white" },
    ...platforms.map((p) => ({
      key: p.code,
      label: p.name,
      icon: <PlatformIcon code={p.code} platforms={platforms} />,
      count: stats.unmappedBy[p.code] ?? 0,
      tone: "bg-red-500/10 text-red-600",
    })),
    { key: "all", label: "همه‌ی نگاشت‌ها", icon: <Layers className="h-4 w-4" aria-hidden />, count: stats.mappings, tone: "bg-gray-500/10 text-gray-500" },
    ...(stats.items !== null
      ? [{ key: "items", label: "کالای حسابداری", icon: <Boxes className="h-4 w-4" aria-hidden />, count: stats.items, tone: "bg-violet-500/10 text-violet-600" }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="نگاشت فعال" value={fa(stats.mappings)} tone="green" sub="محصول با موجودی و قیمت یکی" />
        <Stat label="پیشنهاد در انتظار" value={fa(stats.suggestions)} tone={stats.suggestions ? "amber" : "gray"} sub="با یک کلیک تأیید" />
        <Stat label="بی‌نگاشت در سرویس‌ها" value={fa(unmappedTotal)} tone={unmappedTotal ? "red" : "gray"} sub="محصول دریافت‌شده بی جفت" />
        {stats.items !== null ? (
          <Stat label="کالای بی‌محصول" value={fa(stats.items)} tone={stats.itemsMatched ? "blue" : "gray"} sub={stats.itemsMatched ? `${fa(stats.itemsMatched)} با پیشنهاد` : "در حسابداری داخلی"} />
        ) : (
          <Stat label="سرویس فعال" value={fa(platforms.length)} sub={platforms.map((p) => p.name).join("، ") || "—"} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs leading-6 text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300">
        <span className="min-w-0 flex-1">{SOURCE_TIP[source]}</span>
        <Link href="/admin/integration/guide" className="font-black underline">
          راهنمای نگاشت
        </Link>
      </div>

      {!platforms.length && (
        <Card>
          <Empty
            title="هنوز سرویسی روشن نیست"
            desc="اول در «اتصالات» یک بازارگاه را وصل کنید."
            action={
              <Link href="/admin/integration/connections" className={btn.primary}>
                اتصالات
              </Link>
            }
          />
        </Card>
      )}

      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="زبانه‌های نگاشت">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              tab === t.key
                ? "acc-chip-on bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "acc-chip bg-[var(--adm-surface)] text-gray-600 ring-1 ring-[var(--adm-border)] hover:text-gray-900 dark:text-gray-300"
            }`}
          >
            {t.icon}
            {t.label}
            {!!t.count && <span className={`rounded-md px-1.5 text-[10px] ${tab === t.key ? "bg-white/20 text-current" : t.tone}`}>{fa(t.count)}</span>}
          </button>
        ))}
      </nav>

      {flash && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
          <Check className="h-4 w-4" aria-hidden />
          {flash}
          <button type="button" className="mr-2 text-gray-400" onClick={() => setFlash(null)} aria-label="بستن">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </p>
      )}

      {tab === "suggestions" && (
        <SuggestionsTab
          platforms={platforms}
          onChanged={changed}
          onPickOther={(s) => setMapping({ platformCode: s.platformCode, id: s.platformProductId, title: s.remote?.title ?? s.platformTitle ?? s.platformProductId })}
        />
      )}
      {platforms.map((p) =>
        tab === p.code ? (
          <PlatformTab
            key={p.code}
            platform={p}
            tick={tick}
            onChanged={changed}
            onMap={(r) => setMapping({ platformCode: p.code, id: r.platformProductId, title: r.title })}
            onEdit={(id) => setEditing({ id })}
          />
        ) : null,
      )}
      {tab === "all" && <AllTab platforms={platforms} tick={tick} onChanged={changed} onEdit={(id, focus) => setEditing({ id, focus })} />}
      {tab === "items" && stats.items !== null && <ItemsTab platforms={platforms} onChanged={changed} matchedCount={stats.itemsMatched} />}

      {mapping && (
        <MappingSheet
          origin={mapping}
          platforms={platforms}
          source={source}
          onClose={() => setMapping(null)}
          onDone={(m) => {
            setMapping(null);
            setFlash(m);
            changed();
          }}
        />
      )}
      {editing && <EditSheet mappingId={editing.id} focus={editing.focus} platforms={platforms} onClose={() => setEditing(null)} onChanged={changed} />}

      <p className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-gray-400">
        <RefreshCw className="h-3 w-3" aria-hidden />
        نگاشت تازه از دور بعدی همگام‌سازی موجودی و قیمت را یکی می‌کند.
      </p>
    </div>
  );
}
