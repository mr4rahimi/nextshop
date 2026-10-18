"use client";

import { useCallback, useEffect, useState } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";

/**
 * ربات بله — اتصال، کاتالوگ محصولات و بازبینی محصولات ربات
 *
 * ربات همان ربات باشگاه است؛ توکن و وب‌هوک مشترک‌اند.
 * مستندات: docs/features/bale-catalog.md
 */

type PlatformCode = "shop" | "basalam" | "snappshop" | "tapsi_shop";

interface PlatformCfg {
  enabled: boolean;
  label: string;
  urlTemplate: string;
}

interface CatalogCfg {
  enabled: boolean;
  welcomeText: string;
  searchEnabled: boolean;
  showImage: boolean;
  markCheapest: boolean;
  showClubButton: boolean;
  platforms: Record<PlatformCode, PlatformCfg>;
}

interface Status {
  hasToken: boolean;
  username: string | null;
  botLink: string | null;
  bot: { id: number; first_name: string; username?: string } | null;
  botError: string | null;
  webhookSet: boolean;
  webhookActual: string | null;
  catalog: CatalogCfg;
  stats: { categories: number; products: number };
}

interface Entry {
  platform: PlatformCode;
  label: string;
  linkId: string;
  price: number | null;
  originalPrice: number | null;
  estimated: boolean;
  available: boolean;
  url: string | null;
  manualUrl: string | null;
  fromPrice: boolean;
  cheapest: boolean;
}

interface Card {
  mappingId: string;
  title: string;
  imageUrl: string | null;
  entries: Entry[];
}

const PLATFORM_ORDER: PlatformCode[] = ["shop", "basalam", "snappshop", "tapsi_shop"];

const PLACEHOLDER_HINT: Record<PlatformCode, string> = {
  shop: "",
  basalam: "{id} شناسه‌ی محصول در باسلام",
  snappshop: "{parent} شماره‌ی صفحه‌ی محصول، {number} شماره‌ی تنوع، {id} شناسه",
  tapsi_shop: "{hsin} کد HSIN، {sku} کد فروشنده، {id} شناسه",
};

function fa(n: number) {
  return Number(n).toLocaleString("fa-IR");
}

const inputCls =
  "w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[11px] font-bold text-gray-900 dark:text-white outline-none focus:border-primary-500 transition-colors";

export default function BaleBotClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [catalog, setCatalog] = useState<CatalogCfg | null>(null);
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [productsKey, setProductsKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/integration/bale-bot");
    const d = await res.json().catch(() => null);
    if (!d?.ok) {
      setMessage({ text: d?.error ?? "بارگذاری تنظیمات ناموفق بود", ok: false });
      return;
    }
    setStatus(d);
    setCatalog(d.catalog);
    setUsername(d.username ?? "");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, extra?: Record<string, unknown>, okText = "ذخیره شد") {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/integration/bale-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) {
        setMessage({ text: d?.error ?? "خطایی رخ داد", ok: false });
        return;
      }
      setMessage(
        d.webhookError
          ? { text: `ذخیره شد، ولی ${d.webhookError}`, ok: false }
          : {
              text: action === "test" ? `اتصال برقرار است — ${d.bot?.first_name ?? ""}` : okText,
              ok: true,
            },
      );
      if (action === "save-connection") setToken("");
      await load();
      if (action === "save-catalog") setProductsKey((k) => k + 1);
    } catch {
      setMessage({ text: "ارتباط با سرور برقرار نشد", ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (!status || !catalog) {
    return (
      <div className="p-6" dir="rtl">
        {message ? (
          <p className="text-xs font-black text-red-600 dark:text-red-400">{message.text}</p>
        ) : (
          <p className="text-xs font-bold text-gray-400">در حال بارگذاری…</p>
        )}
      </div>
    );
  }

  const setPlatform = (code: PlatformCode, patch: Partial<PlatformCfg>) =>
    setCatalog({ ...catalog, platforms: { ...catalog.platforms, [code]: { ...catalog.platforms[code], ...patch } } });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">ربات بله</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            محصولات نگاشت‌شده خودکار در ربات دیده می‌شوند، با قیمت به‌روز در سایت، باسلام،
            اسنپ‌شاپ و تپسی‌شاپ و دکمه‌ی خرید از هرکدام.
          </p>
        </div>
        <HelpButton topic="baleBot" />
      </header>

      {message && (
        <div
          className={`rounded-2xl p-4 text-xs font-black ${
            message.ok
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="اتصال"
          value={status.bot ? "برقرار" : status.hasToken ? "ناموفق" : "بدون توکن"}
          tone={status.bot ? "ok" : "warn"}
        />
        <Stat label="وب‌هوک" value={status.webhookSet ? "ثبت شده" : "ثبت نشده"} tone={status.webhookSet ? "ok" : "warn"} />
        <Stat label="دسته‌ها در ربات" value={fa(status.stats.categories)} />
        <Stat
          label="محصولات در ربات"
          value={catalog.enabled ? fa(status.stats.products) : "خاموش"}
          tone={catalog.enabled && status.stats.products > 0 ? "ok" : undefined}
        />
      </div>

      {status.hasToken && status.bot && !status.webhookSet && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex flex-wrap items-center gap-3">
          <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex-1 min-w-[220px] leading-relaxed">
            وب‌هوک ثبت نشده است؛ تا ثبت نشود ربات به هیچ پیامی جواب نمی‌دهد و پیام‌ها در بله منتظر می‌مانند.
          </p>
          <Button
            onClick={() => act("set-webhook", undefined, "وب‌هوک ثبت شد؛ ربات حالا پیام‌ها را جواب می‌دهد")}
            busy={busy === "set-webhook"}
          >
            ثبت وب‌هوک
          </Button>
        </div>
      )}

      {status.botError && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-xs font-black text-red-600 dark:text-red-400">{status.botError}</p>
        </div>
      )}

      {/* ── اتصال ─────────────────────────────────────────────── */}
      <Section title="اتصال ربات">
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
          این همان ربات باشگاه مشتریان است؛ توکن در هر دو بخش یکی است. توکن را از
          <span dir="ltr" className="font-mono mx-1">@BotFather</span>
          در بله بگیرید.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-black text-gray-500 mb-2">توکن ربات (کلید API)</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={status.hasToken ? "•••••••••• (ثبت شده)" : "123456789:AA..."}
              dir="ltr"
              autoComplete="off"
              className={inputCls}
            />
            <span className="block text-[10px] font-bold text-gray-400 mt-1.5 leading-relaxed">
              {status.hasToken ? "خالی بگذارید تا همان توکن قبلی بماند." : "با ذخیره، وب‌هوک هم خودکار ثبت می‌شود."}
            </span>
          </label>
          <label className="block">
            <span className="block text-[10px] font-black text-gray-500 mb-2">نام کاربری ربات</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="myshopbot"
              dir="ltr"
              className={inputCls}
            />
            <span className="block text-[10px] font-bold text-gray-400 mt-1.5">بدون @ — خالی بماند از خود ربات خوانده می‌شود</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => act("save-connection", { token, username })} busy={busy === "save-connection"}>
            ذخیره
          </Button>
          <Button variant="ghost" onClick={() => act("test")} busy={busy === "test"} disabled={!status.hasToken}>
            تست اتصال
          </Button>
          <Button
            variant="ghost"
            onClick={() => act("set-webhook", undefined, "وب‌هوک ثبت شد؛ ربات حالا پیام‌ها را جواب می‌دهد")}
            busy={busy === "set-webhook"}
            disabled={!status.hasToken}
          >
            ثبت وب‌هوک
          </Button>
          {status.botLink && (
            <a
              href={status.botLink}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-black text-primary-600 dark:text-primary-400 mr-auto"
              dir="ltr"
            >
              {status.botLink.replace("https://", "")}
            </a>
          )}
        </div>
      </Section>

      {/* ── کاتالوگ ───────────────────────────────────────────── */}
      <Section title="نمایش محصولات در ربات">
        <Toggle
          checked={catalog.enabled}
          onChange={(v) => setCatalog({ ...catalog, enabled: v })}
          label="محصولات را در ربات نشان بده"
          hint="روشن که باشد، /start منوی محصولات، جستجو و باشگاه را نشان می‌دهد. خاموش، ربات فقط برای عضویت باشگاه است."
        />

        <label className="block">
          <span className="block text-[10px] font-black text-gray-500 mb-2">متن خوش‌آمد</span>
          <textarea
            value={catalog.welcomeText}
            onChange={(e) => setCatalog({ ...catalog, welcomeText: e.target.value })}
            rows={3}
            maxLength={1000}
            placeholder="خالی بماند، متن پیش‌فرض با نام فروشگاه نوشته می‌شود"
            className={inputCls}
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <Toggle
            checked={catalog.searchEnabled}
            onChange={(v) => setCatalog({ ...catalog, searchEnabled: v })}
            label="جستجو با نام محصول"
            hint="مشتری هر کلمه‌ای بنویسد، محصولات هم‌نام می‌آیند."
          />
          <Toggle
            checked={catalog.showImage}
            onChange={(v) => setCatalog({ ...catalog, showImage: v })}
            label="ارسال عکس محصول"
            hint="کارت محصول با عکس اصلی آن فرستاده می‌شود."
          />
          <Toggle
            checked={catalog.markCheapest}
            onChange={(v) => setCatalog({ ...catalog, markCheapest: v })}
            label="نشان کمترین قیمت"
            hint="ارزان‌ترین فروشگاه با ✅ مشخص می‌شود."
          />
          <Toggle
            checked={catalog.showClubButton}
            onChange={(v) => setCatalog({ ...catalog, showClubButton: v })}
            label="دکمه‌ی باشگاه مشتریان"
            hint="عضویت با شماره‌ی موبایل، از منوی اصلی."
          />
        </div>

        <div className="space-y-3 pt-2">
          <h3 className="text-[11px] font-black text-gray-700 dark:text-gray-300">فروشگاه‌ها</h3>
          {PLATFORM_ORDER.map((code) => {
            const p = catalog.platforms[code];
            return (
              <div
                key={code}
                className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => setPlatform(code, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-primary-600"
                    />
                    <span className="text-[11px] font-black text-gray-900 dark:text-white">نمایش</span>
                  </label>
                  <input
                    value={p.label}
                    onChange={(e) => setPlatform(code, { label: e.target.value })}
                    maxLength={40}
                    className={`${inputCls} !w-40`}
                    aria-label="نام در ربات"
                  />
                  {code === "shop" && (
                    <span className="text-[10px] font-bold text-gray-400">لینک از صفحه‌ی محصول سایت ساخته می‌شود</span>
                  )}
                </div>
                {code !== "shop" && (
                  <div>
                    <input
                      value={p.urlTemplate}
                      onChange={(e) => setPlatform(code, { urlTemplate: e.target.value })}
                      dir="ltr"
                      placeholder="https://..."
                      className={inputCls}
                      aria-label="الگوی لینک محصول"
                    />
                    <span className="block text-[10px] font-bold text-gray-400 mt-1" dir="rtl">
                      الگوی لینک صفحه‌ی محصول — {PLACEHOLDER_HINT[code]}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
            اگر لینک یک فروشگاه درست باز نمی‌شود، الگو را عوض کنید یا برای همان محصول در فهرست پایین
            لینک دستی بگذارید. کدهای HSIN تپسی و شماره‌ی محصول اسنپ‌شاپ با «دریافت محصولات» در اتصالات
            پر می‌شوند.
          </p>
        </div>

        <div>
          <Button onClick={() => act("save-catalog", { catalog })} busy={busy === "save-catalog"}>
            ذخیره‌ی تنظیمات محصولات
          </Button>
        </div>
      </Section>

      <ProductsPreview key={productsKey} />
    </div>
  );
}

// ─── فهرست محصولات ربات ──────────────────────────────────────────

function ProductsPreview() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; perPage: number; cards: Card[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integration/bale-bot/products?q=${encodeURIComponent(query)}&page=${page}`,
      );
      const d = await res.json().catch(() => null);
      if (d?.ok) setData(d);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <Section title="محصولات ربات">
      <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
        همان چیزی که مشتری در ربات می‌بیند: نگاشت‌هایی که محصول فروشگاهِ فعال و موجود دارند. قیمت هر
        بازارگاه از آخرین دریافت محصولات می‌آید؛ «تخمینی» یعنی هنوز دریافت نشده و از قوانین قیمت حساب شده.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام محصول" className={inputCls} />
        <button type="submit" className="px-4 py-2 rounded-xl text-[11px] font-black bg-gray-900 dark:bg-white text-white dark:text-gray-900">
          جستجو
        </button>
      </form>

      {!data ? (
        <p className="text-xs font-bold text-gray-400">در حال بارگذاری…</p>
      ) : data.cards.length === 0 ? (
        <p className="text-xs font-bold text-gray-400">
          محصولی پیدا نشد. محصول باید در «نگاشت محصولات» به محصول فعال و موجود فروشگاه وصل باشد.
        </p>
      ) : (
        <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          <p className="text-[10px] font-bold text-gray-400">{fa(data.total)} محصول</p>
          {data.cards.map((c) => (
            <ProductRow key={c.mappingId} card={c} onChanged={load} />
          ))}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="ghost" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                قبلی
              </Button>
              <span className="text-[11px] font-black text-gray-500">
                {fa(page)} از {fa(pages)}
              </span>
              <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
                بعدی
              </Button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function ProductRow({ card, onChanged }: { card: Card; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveUrl(linkId: string, url: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/integration/bale-bot/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId, url }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) {
        setError(d?.error ?? "ذخیره نشد");
        return;
      }
      setEditing(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex gap-3">
      {card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-white/5" />
      ) : (
        <div className="w-14 h-14 rounded-lg shrink-0 bg-gray-100 dark:bg-white/5" />
      )}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[12px] font-black text-gray-900 dark:text-white">{card.title}</p>
        {card.entries.length === 0 && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">هیچ فروشگاه فعالی برای این محصول نیست</p>
        )}
        {card.entries.map((e) => (
          <div key={e.linkId} className="text-[11px] font-bold text-gray-600 dark:text-gray-300 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={e.cheapest ? "text-emerald-600 dark:text-emerald-400" : ""}>
                {e.cheapest ? "✅" : "▫️"} {e.label}:
              </span>
              {!e.available || e.price == null ? (
                <span className="text-gray-400">ناموجود</span>
              ) : (
                <span>
                  {e.fromPrice ? "از " : ""}
                  {fa(e.price)} تومان
                  {e.originalPrice ? <span className="text-gray-400 line-through mr-1">{fa(e.originalPrice)}</span> : null}
                  {e.estimated && <span className="text-amber-600 dark:text-amber-400 mr-1">(تخمینی)</span>}
                </span>
              )}
              {e.url ? (
                <a href={e.url} target="_blank" rel="noreferrer" className="text-primary-600 dark:text-primary-400 text-[10px] font-black">
                  {e.manualUrl ? "لینک دستی ↗" : "بازکردن لینک ↗"}
                </a>
              ) : (
                <span className="text-red-500 text-[10px] font-black">بدون لینک خرید</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditing(e.linkId);
                  setValue(e.manualUrl ?? "");
                  setError(null);
                }}
                className="text-[10px] font-black text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {e.manualUrl ? "ویرایش لینک" : "لینک دستی"}
              </button>
            </div>
            {editing === e.linkId && (
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={value}
                  onChange={(ev) => setValue(ev.target.value)}
                  dir="ltr"
                  placeholder="https://..."
                  className={`${inputCls} !w-auto flex-1 min-w-[220px]`}
                />
                <Button onClick={() => saveUrl(e.linkId, value)} busy={saving}>
                  ذخیره
                </Button>
                {e.manualUrl && (
                  <Button variant="ghost" onClick={() => saveUrl(e.linkId, "")} busy={saving}>
                    برگشت به الگو
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  انصراف
                </Button>
                {error && <span className="text-[10px] font-black text-red-500 w-full">{error}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── اجزای کوچک ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h2 className="text-xs font-black text-gray-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-[10px] font-bold text-gray-400">{label}</p>
      <p
        className={`text-sm font-black mt-1 ${
          tone === "ok"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-primary-600"
      />
      <span className="text-[11px] font-black text-gray-900 dark:text-white leading-relaxed">
        {label}
        {hint && <span className="block text-[10px] font-bold text-gray-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

function Button({
  children, onClick, busy, disabled, variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`px-4 py-2 rounded-xl text-[11px] font-black disabled:opacity-30 transition-opacity ${
        variant === "ghost"
          ? "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300"
          : "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
      }`}
    >
      {busy ? "..." : children}
    </button>
  );
}
