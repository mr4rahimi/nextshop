"use client";

/**
 * پیشخوان دسکتاپی پنل مدیریت.
 *
 * | جزء | کار |
 * |-----|-----|
 * | سرصفحه | خوشامد، تاریخ و ساعت، جستجوی سریع اپ‌ها (کلید `/`) |
 * | کارت‌های شاخص | فروش، سفارش، میانگین سبد، کاربر تازه، کارهای مانده |
 * | پنجره‌ی دسته | آیکن هر بخش با نام زیرش؛ جمع‌شدنی؛ راست‌کلیک = منوی اپ |
 * | ویجت | گزارش مرتبط با همان دسته، کنار پنجره‌اش |
 * | داک | اپ‌های سنجاق‌شده، پایین صفحه |
 *
 * فقط اپ‌های مجاز از سرور می‌رسند (app/admin/page.tsx).
 * مستندات: docs/features/admin-desktop.md
 */

import "@/app/styles/desktop.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink, LayoutGrid, Pin, PinOff, Search, SquareArrowOutUpRight, X } from "lucide-react";
import { DEFAULT_DOCK, type BadgeKey, type DesktopApp, type DesktopCategory } from "./registry";
import { BarList, DailyBars, Donut, Heatmap, Sparkline, TrendChart, fa, faShort, type DonutSlice } from "./charts";
import { useAdminMe } from "../useAdminMe";
import { normalize } from "../AdminSidebar";
import HelpButton from "../worklist/HelpButton";

// ── انواع ────────────────────────────────────────────────────────────────

interface OrderStat { status: string; count: number; total: number }
interface RecentOrder { id: string; orderNumber: string; status: string; grandTotal: number; createdAt: string; userName: string }
interface StockProduct { id: string; title: string; stock: number }
interface TopBuyer { id: string; name: string; orders: number; total: number }

interface Props {
  categories: DesktopCategory[];
  badges: Record<BadgeKey, number>;
  totals: { users: number; products: number; outOfStock: number };
  orderStats: OrderStat[];
  recentOrders: RecentOrder[];
  stockLow: StockProduct[];
  topBuyers: TopBuyer[];
  heatmap: number[][];
  /** ۱۸۰ روز، قدیمی به جدید */
  dailySales: number[];
  dailyOrders: number[];
  dailyUsers: number[];
}

// ── ذخیره‌ی محلی (فقط راحتی هر بیننده؛ نبودنش چیزی را خراب نمی‌کند) ───────

const DOCK_KEY = "admin:dock";
const COLLAPSED_KEY = "admin:desktop:collapsed";

function readList(key: string): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}
function writeList(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* حالت خصوصی یا مسدود — بی‌صدا */
  }
}

const toman = (v: number) => `${faShort(v)} تومان`;
const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "انتظار پرداخت", PAID: "پرداخت شده", CONFIRMED: "تأیید شده",
  PROCESSING: "آماده‌سازی", PACKAGING: "بسته‌بندی", SHIPPED: "ارسال شده",
  DELIVERED: "تحویل شده", COMPLETED: "تکمیل شده", CANCELED: "لغو شده", REFUNDED: "مسترد شده",
};

// ── سرصفحه ───────────────────────────────────────────────────────────────

function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ساعت فقط در مرورگر، تا SSR با ساعت سرور ناهم‌خوان نشود
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function greeting(h: number): string {
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "روز بخیر";
  if (h < 21) return "عصر بخیر";
  return "شب بخیر";
}

// ── آیکن اپ ──────────────────────────────────────────────────────────────

interface MenuState { app: DesktopApp; x: number; y: number }

function AppTile({
  app, badge, selected, onMenu, index = 0,
}: {
  app: DesktopApp;
  badge?: number;
  selected?: boolean;
  onMenu: (m: MenuState) => void;
  index?: number;
}) {
  return (
    <Link
      href={app.href}
      data-selected={selected || undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ app, x: e.clientX, y: e.clientY });
      }}
      className="dk-app adm-rise group relative flex flex-col items-center gap-1.5 rounded-2xl px-1 pb-2 pt-3 text-center outline-none"
      style={{ ["--i" as string]: index }}
      title={app.label}
    >
      <span className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- آیکن ثابت محلی ۱۲۸ پیکسلی؛ بهینه‌ساز تصویر لازم نیست */}
        <img src={app.icon} alt="" width={52} height={52} className="dk-app-img h-12 w-12 sm:h-[52px] sm:w-[52px]" loading="lazy" draggable={false} />
        {!!badge && (
          <span className="absolute -left-2 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white shadow-md ring-2 ring-white dark:ring-[#141a26]">
            {badge > 99 ? "۹۹+" : fa(badge)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[11.5px] font-bold leading-snug text-[var(--dk-ink)]">{app.label}</span>
    </Link>
  );
}

function AppMenu({
  menu, pinned, onTogglePin, onClose,
}: {
  menu: MenuState;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    document.querySelector("main")?.addEventListener("scroll", close, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
      document.querySelector("main")?.removeEventListener("scroll", close);
    };
  }, [onClose]);

  // در پنجره بماند
  const W = 216, H = 150;
  const left = Math.min(menu.x, window.innerWidth - W - 8);
  const top = Math.min(menu.y, window.innerHeight - H - 8);
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--dk-ink)] transition-colors hover:bg-[var(--adm-accent)] hover:text-white";

  return (
    <div
      ref={ref}
      role="menu"
      className="adm-pop-in fixed z-50 rounded-xl border border-[var(--dk-edge)] bg-[var(--dk-glass-strong)] p-1.5 shadow-2xl backdrop-blur-2xl"
      style={{ left, top, width: W }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--dk-edge)] px-2.5 pb-2 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={menu.app.icon} alt="" className="h-6 w-6" />
        <span className="truncate text-xs font-black text-[var(--dk-ink)]">{menu.app.label}</span>
      </div>
      <div className="pt-1">
        <button role="menuitem" className={item} onClick={() => { router.push(menu.app.href); onClose(); }}>
          <SquareArrowOutUpRight className="h-4 w-4" aria-hidden /> باز کردن
        </button>
        <button role="menuitem" className={item} onClick={() => { window.open(menu.app.href, "_blank"); onClose(); }}>
          <ExternalLink className="h-4 w-4" aria-hidden /> باز کردن در زبانه‌ی تازه
        </button>
        <button role="menuitem" className={item} onClick={() => { onTogglePin(); onClose(); }}>
          {pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
          {pinned ? "برداشتن از داک" : "سنجاق به داک"}
        </button>
      </div>
    </div>
  );
}

// ── پنجره و ویجت ─────────────────────────────────────────────────────────

function Window({
  title, hint, icon, tone, count, collapsed, onToggle, children, action,
}: {
  title: string;
  hint?: string;
  icon: string;
  tone: string;
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`dk-window dk-tone dk-tone-${tone} flex min-w-0 flex-col overflow-hidden rounded-[22px]`}>
      <header className="dk-titlebar flex items-center gap-3 px-4 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" className="h-7 w-7 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-black text-[var(--dk-ink)]">
            {title}
            {count !== undefined && (
              <span className="rounded-full bg-[var(--adm-hover)] px-2 py-0.5 text-[10px] font-bold text-[var(--dk-ink-3)]">{fa(count)}</span>
            )}
          </h2>
          {hint && <p className="truncate text-[11px] text-[var(--dk-ink-3)]">{hint}</p>}
        </div>
        {action}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `باز کردن ${title}` : `جمع کردن ${title}`}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--dk-ink-3)] transition-colors hover:bg-[var(--adm-hover)] hover:text-[var(--dk-ink)]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "rotate-90" : ""}`} aria-hidden />
          </button>
        )}
      </header>
      <div className={`grid transition-[grid-template-rows] duration-300 ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
        <div className="min-h-0 overflow-hidden" inert={collapsed || undefined}>
          {children}
        </div>
      </div>
    </section>
  );
}

function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-lg bg-[var(--adm-hover)] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
            value === o.v ? "bg-[var(--dk-glass-strong)] text-[var(--dk-ink)] shadow-sm" : "text-[var(--dk-ink-3)] hover:text-[var(--dk-ink)]"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Delta({ value, suffix = "نسبت به دوره‌ی قبل" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-[11px] text-[var(--dk-ink-3)]">دوره‌ی قبل داده ندارد</span>;
  const up = value >= 0;
  return (
    <span className="text-[11px] text-[var(--dk-ink-3)]">
      <span className={`font-black ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {up ? "▲" : "▼"} {fa(Math.abs(value))}٪
      </span>{" "}
      {suffix}
    </span>
  );
}

/** دو ستون کنار هم در دسکتاپ؛ اگر یکی نبود، دیگری تمام‌عرض */
function Row({ a, b, ratio = "wide" }: { a?: ReactNode; b?: ReactNode; ratio?: "wide" | "even" }) {
  if (!a && !b) return null;
  if (!a || !b) return <div>{a ?? b}</div>;
  return (
    <div className={`grid gap-4 lg:gap-5 ${ratio === "wide" ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : "lg:grid-cols-2"}`}>
      {a}
      {b}
    </div>
  );
}

// ── اصلی ─────────────────────────────────────────────────────────────────

export default function DesktopClient(props: Props) {
  const { categories, badges, totals, orderStats, recentOrders, stockLow, topBuyers, heatmap, dailySales, dailyOrders, dailyUsers } = props;
  const router = useRouter();
  const me = useAdminMe();
  const now = useNow();

  const allApps = useMemo(() => {
    const seen = new Map<string, DesktopApp & { category: string }>();
    categories.forEach((c) => c.apps.forEach((a) => !seen.has(a.href) && seen.set(a.href, { ...a, category: c.label })));
    return [...seen.values()];
  }, [categories]);
  const byHref = useMemo(() => new Map(allApps.map((a) => [a.href, a])), [allApps]);
  const cat = (key: string) => categories.find((c) => c.key === key);

  // ── داک و جمع‌بودن پنجره‌ها ──
  const [dock, setDock] = useState<string[]>(DEFAULT_DOCK);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage فقط بعد از mount
    setDock(readList(DOCK_KEY) ?? DEFAULT_DOCK);
    setCollapsed(readList(COLLAPSED_KEY) ?? []);
  }, []);
  const togglePin = (href: string) => {
    const next = dock.includes(href) ? dock.filter((h) => h !== href) : [...dock, href];
    setDock(next);
    writeList(DOCK_KEY, next);
  };
  const toggleCollapsed = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key];
    setCollapsed(next);
    writeList(COLLAPSED_KEY, next);
  };
  const dockApps = dock.map((h) => byHref.get(h)).filter((a): a is NonNullable<typeof a> => !!a);

  const [menu, setMenu] = useState<MenuState | null>(null);

  // ── جستجوی سریع ──
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const results = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return allApps.filter((a) => {
      const hay = normalize(`${a.label} ${a.category} ${a.keywords ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [query, allApps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── شاخص‌ها ──
  const last = (a: number[], n: number) => a.slice(a.length - n);
  const before = (a: number[], n: number) => a.slice(a.length - 2 * n, a.length - n);
  const sales30 = sum(last(dailySales, 30)), salesPrev30 = sum(before(dailySales, 30));
  const orders30 = sum(last(dailyOrders, 30)), ordersPrev30 = sum(before(dailyOrders, 30));
  const users30 = sum(last(dailyUsers, 30)), usersPrev30 = sum(before(dailyUsers, 30));
  const aov = orders30 ? sales30 / orders30 : 0;
  const aovPrev = ordersPrev30 ? salesPrev30 / ordersPrev30 : 0;
  const pending = badges.orders + badges.callbacks + badges.guaranty + badges.comments;

  const name = me?.name?.split(" ")[0];
  const dateText = now?.toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeText = now?.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

  // ── پنجره‌ی یک دسته ──
  const appWindow = (key: string) => {
    const c = cat(key);
    if (!c) return undefined;
    return (
      <Window
        title={c.label}
        hint={c.hint}
        icon={c.icon}
        tone={c.tone}
        count={c.apps.length}
        collapsed={collapsed.includes(c.key)}
        onToggle={() => toggleCollapsed(c.key)}
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1 p-3 sm:p-4">
          {c.apps.map((a, i) => (
            <AppTile key={a.href} app={a} index={i} badge={a.badge ? badges[a.badge] : undefined} onMenu={setMenu} />
          ))}
        </div>
      </Window>
    );
  };

  return (
    <div className="dk-root" dir="rtl">
      <div className="dk-wallpaper" aria-hidden />

      <div className="mx-auto max-w-[1500px] space-y-4 px-4 pb-32 pt-5 lg:space-y-5 lg:px-6 lg:pt-7">
        {/* ── سرصفحه ── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--dk-ink-3)]" suppressHydrationWarning>
              {dateText ?? " "}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--dk-ink)] sm:text-[28px]">
              {now ? greeting(now.getHours()) : "سلام"}
              {name ? `، ${name}` : ""}
              {timeText && <span className="mr-3 align-middle text-base font-bold tabular-nums text-[var(--dk-ink-3)]">{timeText}</span>}
            </h1>
          </div>

          <div className="flex w-full items-center gap-2 lg:w-auto">
          <div className="relative w-full lg:w-[26rem]">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dk-ink-3)]" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSel(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
                if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
                if (e.key === "Enter" && results[sel]) router.push(results[sel].href);
                if (e.key === "Escape") { setQuery(""); searchRef.current?.blur(); }
              }}
              placeholder={`جستجو در ${fa(allApps.length)} بخش پنل…`}
              aria-label="جستجوی بخش‌های پنل"
              className="dk-window h-12 w-full rounded-2xl pl-14 pr-10 text-sm font-bold text-[var(--dk-ink)] outline-none placeholder:font-normal placeholder:text-[var(--dk-ink-3)] focus:ring-2 focus:ring-[var(--adm-accent)]"
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="پاک کردن جستجو" className="absolute left-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--dk-ink-3)] hover:bg-[var(--adm-hover)]">
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <kbd className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md border border-[var(--dk-edge)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--dk-ink-3)]">/</kbd>
            )}
          </div>
          <HelpButton topic="desktop" />
          </div>
        </div>

        {query ? (
          /* ── نتیجه‌ی جستجو ── */
          <Window title="نتیجه‌ی جستجو" hint={`«${query}»`} icon="/panel-icons/fluent/magnifying-glass-tilted-left.webp" tone="blue" count={results.length}>
            {results.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1 p-4">
                {results.map((a, i) => (
                  <AppTile key={a.href} app={a} index={i} selected={i === sel} badge={a.badge ? badges[a.badge] : undefined} onMenu={setMenu} />
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-[var(--dk-ink-3)]">بخشی با این نام پیدا نشد.</p>
            )}
          </Window>
        ) : (
          <>
            {/* ── کارت‌های شاخص ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 lg:gap-4">
              <Kpi href="/admin/accounting/reports/sales" label="فروش ۳۰ روز" value={toman(sales30)} delta={pctChange(sales30, salesPrev30)} spark={last(dailySales, 30)} color="var(--dk-s1)" />
              <Kpi href="/admin/orders" label="سفارش ۳۰ روز" value={fa(orders30)} delta={pctChange(orders30, ordersPrev30)} spark={last(dailyOrders, 30)} color="var(--dk-s2)" />
              <Kpi href="/admin/orders" label="میانگین سبد" value={toman(aov)} delta={pctChange(aov, aovPrev)} />
              <Kpi href="/admin/users" label="کاربر تازه ۳۰ روز" value={fa(users30)} delta={pctChange(users30, usersPrev30)} spark={last(dailyUsers, 30)} color="var(--dk-s3)" sub={`از ${fa(totals.users)} کاربر`} />
              <PendingKpi badges={badges} total={pending} />
            </div>

            <Row a={appWindow("sales")} b={<SalesWidget dailySales={dailySales} dailyOrders={dailyOrders} />} />
            <Row a={<OrdersWidget orderStats={orderStats} recentOrders={recentOrders} />} b={appWindow("catalog")} ratio="even" />
            <Row a={appWindow("inventory")} b={<StockWidget stockLow={stockLow} totals={totals} />} />
            {appWindow("accounting")}
            <Row a={appWindow("reports")} b={<HeatmapWidget heatmap={heatmap} />} ratio="even" />
            <Row a={appWindow("customers")} b={<CustomersWidget dailyUsers={dailyUsers} topBuyers={topBuyers} />} />
            {appWindow("worklist")}
            <Row a={appWindow("marketing")} b={appWindow("sms")} />
            <Row a={appWindow("integration")} b={appWindow("content")} ratio="even" />
            <Row a={appWindow("system")} b={appWindow("seo")} ratio="even" />
          </>
        )}
      </div>

      {/* ── داک ── */}
      {dockApps.length > 0 && (
        <nav aria-label="داک" className="pointer-events-none sticky bottom-3 z-20 flex justify-center px-3 pb-1 sm:bottom-4">
          <div className="dk-dock pointer-events-auto flex max-w-full items-end gap-1 overflow-x-auto rounded-[22px] px-2.5 py-2 sm:gap-1.5 sm:overflow-visible">
            {dockApps.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                aria-label={a.label}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ app: a, x: e.clientX, y: e.clientY }); }}
                className="dk-dock-item relative flex-shrink-0 rounded-xl p-1 outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.icon} alt="" className="h-10 w-10 sm:h-11 sm:w-11" draggable={false} />
                {a.badge && !!badges[a.badge] && (
                  <span className="absolute left-0 top-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[var(--dk-glass-strong)]" />
                )}
                <span className="dk-dock-tip absolute -top-9 right-1/2 hidden whitespace-nowrap rounded-lg bg-gray-900/90 px-2 py-1 text-[11px] font-bold text-white sm:block dark:bg-white/90 dark:text-gray-900">
                  {a.label}
                </span>
              </Link>
            ))}
            <span className="mx-1 h-10 w-px flex-shrink-0 self-center bg-[var(--dk-edge)]" aria-hidden />
            <button
              onClick={() => { document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); searchRef.current?.focus(); }}
              aria-label="همه‌ی بخش‌ها"
              className="dk-dock-item relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-[var(--dk-ink-2)] outline-none sm:h-[52px] sm:w-[52px]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md sm:h-11 sm:w-11 dark:from-slate-300 dark:to-slate-500 dark:text-slate-900">
                <LayoutGrid className="h-5 w-5" aria-hidden />
              </span>
              <span className="dk-dock-tip absolute -top-9 right-1/2 hidden whitespace-nowrap rounded-lg bg-gray-900/90 px-2 py-1 text-[11px] font-bold text-white sm:block dark:bg-white/90 dark:text-gray-900">
                جستجوی بخش‌ها
              </span>
            </button>
          </div>
        </nav>
      )}

      {menu && (
        <AppMenu
          menu={menu}
          pinned={dock.includes(menu.app.href)}
          onTogglePin={() => togglePin(menu.app.href)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

// ── کارت شاخص ────────────────────────────────────────────────────────────

function Kpi({ href, label, value, delta, spark, color, sub }: {
  href: string;
  label: string;
  value: string;
  delta: number | null;
  spark?: number[];
  color?: string;
  sub?: string;
}) {
  return (
    <Link href={href} className="dk-window group flex min-w-0 flex-col rounded-[20px] p-4 transition-transform hover:-translate-y-0.5">
      <span className="text-[11px] font-bold text-[var(--dk-ink-3)]">{label}</span>
      <span className="mt-1 truncate text-lg font-black tabular-nums text-[var(--dk-ink)] sm:text-xl">{value}</span>
      <span className="mt-0.5 truncate"><Delta value={delta} suffix="از ماه قبل" /></span>
      {sub && <span className="truncate text-[11px] text-[var(--dk-ink-3)]">{sub}</span>}
      <div className="mt-auto pt-2">{spark ? <Sparkline data={spark} color={color} /> : <div className="h-9" />}</div>
    </Link>
  );
}

function PendingKpi({ badges, total }: { badges: Record<BadgeKey, number>; total: number }) {
  const rows: { href: string; label: string; v: number }[] = [
    { href: "/admin/orders?status=PAID", label: "سفارش منتظر", v: badges.orders },
    { href: "/admin/comments", label: "نظر تأییدنشده", v: badges.comments },
    { href: "/admin/callback-requests", label: "درخواست تماس", v: badges.callbacks },
    { href: "/admin/guaranty/requests", label: "گارانتی باز", v: badges.guaranty },
  ];
  return (
    <div className="dk-window col-span-2 flex min-w-0 flex-col rounded-[20px] p-4 md:col-span-1">
      <span className="text-[11px] font-bold text-[var(--dk-ink-3)]">کارهای منتظر رسیدگی</span>
      <span className="mt-1 text-xl font-black tabular-nums text-[var(--dk-ink)]">{fa(total)}</span>
      <ul className="mt-2 grid grid-cols-2 gap-1">
        {rows.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="flex items-center justify-between gap-1 rounded-lg px-1.5 py-1 text-[11px] transition-colors hover:bg-[var(--adm-hover)]">
              <span className="truncate text-[var(--dk-ink-2)]">{r.label}</span>
              <span className={`font-black tabular-nums ${r.v ? "text-red-600 dark:text-red-400" : "text-[var(--dk-ink-3)]"}`}>{fa(r.v)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── ویجت‌ها ───────────────────────────────────────────────────────────────

const RANGES = [{ v: 7, l: "۷ روز" }, { v: 30, l: "۳۰ روز" }, { v: 90, l: "۹۰ روز" }];

function SalesWidget({ dailySales, dailyOrders }: { dailySales: number[]; dailyOrders: number[] }) {
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<"sales" | "orders">("sales");
  const src = metric === "sales" ? dailySales : dailyOrders;
  const values = src.slice(src.length - range);
  const prev = src.slice(src.length - 2 * range, src.length - range);
  const cur = sum(values);
  const format = metric === "sales" ? toman : fa;

  return (
    <Window
      title="روند فروش"
      hint="سفارش‌های پرداخت‌شده، در برابر دوره‌ی هم‌طول قبل"
      icon="/panel-icons/fluent/chart-increasing.webp"
      tone="blue"
      action={<Segmented label="شاخص" value={metric} onChange={setMetric} options={[{ v: "sales", l: "مبلغ" }, { v: "orders", l: "تعداد" }]} />}
    >
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-black tabular-nums text-[var(--dk-ink)]">{format(cur)}</div>
            <Delta value={pctChange(cur, sum(prev))} />
          </div>
          <Segmented label="بازه" value={range} onChange={setRange} options={RANGES} />
        </div>
        <TrendChart values={values} prev={prev} format={format} label={`روند ${metric === "sales" ? "مبلغ فروش" : "تعداد سفارش"} ${fa(range)} روز اخیر`} />
        <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--dk-ink-2)]">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--dk-s1)]" /> این دوره</span>
          <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-[var(--dk-prev)]" /> دوره‌ی قبل</span>
          <Link href="/admin/accounting/reports/sales" className="mr-auto font-bold text-[var(--adm-accent)] hover:underline">تحلیل کامل فروش ←</Link>
        </div>
      </div>
    </Window>
  );
}

function OrdersWidget({ orderStats, recentOrders }: { orderStats: OrderStat[]; recentOrders: RecentOrder[] }) {
  const c = (statuses: string[]) => orderStats.filter((s) => statuses.includes(s.status)).reduce((a, s) => a + s.count, 0);
  // ترتیب ثابت پالت دسته‌ای: آبی، نارنجی، فیروزه‌ای، زرد
  const slices: DonutSlice[] = [
    { key: "flow", label: "در جریان (پرداخت تا ارسال)", value: c(["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED"]), color: "var(--dk-s1)", href: "/admin/orders?status=PAID" },
    { key: "cancel", label: "لغو و مرجوع", value: c(["CANCELED", "REFUNDED"]), color: "var(--dk-s2)", href: "/admin/orders?status=CANCELED" },
    { key: "done", label: "تحویل و تکمیل", value: c(["DELIVERED", "COMPLETED"]), color: "var(--dk-s3)", href: "/admin/orders?status=DELIVERED" },
    { key: "unpaid", label: "در انتظار پرداخت", value: c(["PENDING_PAYMENT"]), color: "var(--dk-s4)", href: "/admin/orders?status=PENDING_PAYMENT" },
  ];
  const total = sum(slices.map((s) => s.value));

  return (
    <Window title="وضعیت سفارش‌ها" hint="همه‌ی سفارش‌ها و آخرین‌ها" icon="/panel-icons/fluent/clipboard.webp" tone="indigo">
      <div className="space-y-4 p-4">
        <Donut slices={slices} center={fa(total)} centerSub="کل سفارش‌ها" />
        <div className="border-t border-[var(--dk-edge)] pt-3">
          <div className="mb-1 flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-[var(--dk-ink)]">آخرین سفارش‌ها</h3>
            <Link href="/admin/orders" className="text-[11px] font-bold text-[var(--adm-accent)] hover:underline">همه ←</Link>
          </div>
          {recentOrders.length ? (
            <ul>
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-[var(--adm-hover)]">
                    <span className="w-20 flex-shrink-0 truncate font-mono text-[11px] text-[var(--dk-ink-3)]" dir="ltr">{o.orderNumber}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-[var(--dk-ink)]">{o.userName}</span>
                    <span className="hidden flex-shrink-0 text-[11px] text-[var(--dk-ink-3)] sm:inline">{STATUS_LABEL[o.status] ?? o.status}</span>
                    <span className="flex-shrink-0 font-black tabular-nums text-[var(--dk-ink)]">{faShort(o.grandTotal)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-4 text-center text-xs text-[var(--dk-ink-3)]">هنوز سفارشی ثبت نشده.</p>
          )}
        </div>
      </div>
    </Window>
  );
}

function StockWidget({ stockLow, totals }: { stockLow: StockProduct[]; totals: Props["totals"] }) {
  const inStock = Math.max(0, totals.products - totals.outOfStock);
  const share = totals.products ? (inStock / totals.products) * 100 : 0;
  return (
    <Window title="موجودی محصولات" hint="محصولات فعال فروشگاه" icon="/panel-icons/fluent/card-file-box.webp" tone="orange">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/products" className="rounded-2xl bg-[var(--adm-hover)] p-3 transition-colors hover:bg-[var(--adm-accent-soft)]">
            <div className="text-[11px] font-bold text-[var(--dk-ink-3)]">محصول فعال</div>
            <div className="text-xl font-black tabular-nums text-[var(--dk-ink)]">{fa(totals.products)}</div>
          </Link>
          <Link href="/admin/products/bulk-stock" className="rounded-2xl bg-[var(--adm-hover)] p-3 transition-colors hover:bg-[var(--adm-accent-soft)]">
            <div className="text-[11px] font-bold text-[var(--dk-ink-3)]">ناموجود</div>
            <div className={`text-xl font-black tabular-nums ${totals.outOfStock ? "text-red-600 dark:text-red-400" : "text-[var(--dk-ink)]"}`}>{fa(totals.outOfStock)}</div>
          </Link>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-[11px] text-[var(--dk-ink-2)]">
            <span>سهم موجود</span>
            <span className="font-black tabular-nums text-[var(--dk-ink)]">{fa(share)}٪</span>
          </div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            <div className="rounded-full bg-[var(--dk-s3)]" style={{ width: `${share}%` }} />
            <div className="flex-1 rounded-full bg-[var(--dk-s2)]" />
          </div>
        </div>
        <div className="border-t border-[var(--dk-edge)] pt-3">
          <h3 className="mb-1 px-2 text-xs font-black text-[var(--dk-ink)]">رو به اتمام</h3>
          {stockLow.length ? (
            <BarList
              color="var(--dk-s2)"
              rows={stockLow.map((p) => ({ key: p.id, label: p.title, value: p.stock, sub: "عدد", href: `/admin/products/${p.id}` }))}
            />
          ) : (
            <p className="px-2 py-3 text-center text-xs text-[var(--dk-ink-3)]">محصول موجودی ندارد.</p>
          )}
        </div>
      </div>
    </Window>
  );
}

function HeatmapWidget({ heatmap }: { heatmap: number[][] }) {
  return (
    <Window title="ساعت‌های پرسفارش" hint="۹۰ روز اخیر، به وقت تهران" icon="/panel-icons/fluent/stopwatch.webp" tone="violet">
      <div className="p-4">
        <Heatmap grid={heatmap} />
      </div>
    </Window>
  );
}

function CustomersWidget({ dailyUsers, topBuyers }: { dailyUsers: number[]; topBuyers: TopBuyer[] }) {
  const last30 = dailyUsers.slice(dailyUsers.length - 30);
  return (
    <Window title="مشتریان" hint="ثبت‌نام روزانه و خریداران برتر" icon="/panel-icons/fluent/busts-in-silhouette.webp" tone="rose">
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-black text-[var(--dk-ink)]">ثبت‌نام ۳۰ روز اخیر</h3>
            <span className="text-lg font-black tabular-nums text-[var(--dk-ink)]">{fa(sum(last30))}</span>
          </div>
          <DailyBars values={last30} unit="کاربر تازه" label="ثبت‌نام روزانه‌ی ۳۰ روز اخیر" />
        </div>
        <div className="border-t border-[var(--dk-edge)] pt-3">
          <h3 className="mb-1 px-2 text-xs font-black text-[var(--dk-ink)]">خریداران برتر</h3>
          {topBuyers.length ? (
            <BarList
              color="var(--dk-s1)"
              format={toman}
              rows={topBuyers.map((b) => ({ key: b.id, label: `${b.name} · ${fa(b.orders)} سفارش`, value: b.total, href: `/admin/users/${b.id}` }))}
            />
          ) : (
            <p className="px-2 py-3 text-center text-xs text-[var(--dk-ink-3)]">هنوز خریدی ثبت نشده.</p>
          )}
        </div>
      </div>
    </Window>
  );
}
