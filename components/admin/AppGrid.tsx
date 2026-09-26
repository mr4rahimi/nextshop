"use client";

/**
 * کاشی‌های «اپ» و نوار ماژول — رابط مشترک کارتابل و حسابداری.
 *
 * | جزء | کجا |
 * |-----|-----|
 * | `AppGrid` | صفحه‌ی خانه‌ی ماژول — شبکه‌ی کاشی‌های مربعی |
 * | `AppLauncher` | پنجره‌ی «همه‌ی بخش‌ها» که از هر صفحه‌ی ماژول باز می‌شود |
 * | `ModuleBar` | نوار بالای صفحه‌های داخلی: ماژول › بخش جاری ▾ و دکمه‌ی اصلی |
 *
 * مستندات: docs/features/admin-ui.md
 */

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, LayoutGrid, X, type LucideIcon } from "lucide-react";
import { TONE_SOFT, TONE_TILE, type AppItem, type AppTone } from "./apps";

// ── یک کاشی ─────────────────────────────────────────────────────────────

export function AppIcon({
  icon: I,
  tone,
  img,
  size = "md",
}: {
  icon: LucideIcon;
  tone: AppTone;
  /** آیکن رنگی `public/admin-icons/<img>.svg` — اگر باشد جای آیکن خطی را می‌گیرد */
  img?: string;
  size?: "sm" | "md";
}) {
  if (img) {
    // آیکن‌های رنگی خودشان رنگ دارند؛ روی کاشی روشن و آرام می‌نشینند تا در
    // روز و شب هر دو خوانا بمانند.
    const box =
      size === "sm"
        ? "h-8 w-8 rounded-[10px] p-1"
        : "h-14 w-14 rounded-[18px] p-2 sm:h-[60px] sm:w-[60px] sm:rounded-[19px] sm:p-[9px]";
    return (
      <span
        className={`flex flex-shrink-0 items-center justify-center bg-gradient-to-br from-white to-blue-50/80 shadow-[0_4px_14px_-6px_rgba(37,99,235,.35)] ring-1 ring-inset ring-blue-100 dark:from-white/[0.16] dark:to-white/[0.07] dark:shadow-none dark:ring-white/10 ${box}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG ثابت و کوچک؛ بهینه‌سازی next/image لازم ندارد */}
        <img src={`/admin-icons/${img}.svg`} alt="" aria-hidden className="h-full w-full object-contain" draggable={false} />
      </span>
    );
  }

  const box = size === "sm" ? "h-9 w-9 rounded-[11px]" : "h-14 w-14 rounded-[18px] sm:h-[60px] sm:w-[60px] sm:rounded-[19px]";
  const ico = size === "sm" ? "h-[18px] w-[18px]" : "h-6 w-6 sm:h-[26px] sm:w-[26px]";
  return (
    <span
      className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/15 ${box} ${TONE_TILE[tone]}`}
    >
      {/* برق بالای کاشی — عمق می‌دهد بی‌آنکه شلوغ شود */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
      <I className={`relative ${ico}`} strokeWidth={2} aria-hidden />
    </span>
  );
}

function Tile({
  app,
  active,
  badge,
  index,
  onNavigate,
  className = "",
}: {
  app: AppItem;
  active: boolean;
  badge?: number;
  index: number;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={app.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      style={{ "--i": index } as React.CSSProperties}
      className={`adm-rise group relative flex flex-col items-center gap-2 rounded-2xl px-1 pb-2 pt-3 text-center transition-colors duration-200 hover:bg-[var(--adm-hover)] ${
        active ? "bg-[var(--adm-accent-soft)]" : ""
      } ${className}`}
    >
      <span className="relative transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-active:scale-95">
        <AppIcon icon={app.icon} tone={app.tone} img={app.img} />
        {!!badge && badge > 0 && (
          <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white ring-2 ring-[var(--adm-bg)]">
            {badge > 99 ? "۹۹+" : badge.toLocaleString("fa-IR")}
          </span>
        )}
      </span>
      <span
        className={`line-clamp-2 min-h-[2.2em] text-[11.5px] font-bold leading-[1.1rem] sm:text-xs ${
          active ? "text-[var(--adm-accent)]" : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {app.label}
      </span>
      {app.tag && (
        <span className="-mt-1.5 rounded-md bg-gray-500/10 px-1.5 text-[9px] font-bold text-gray-500 dark:text-gray-400">{app.tag}</span>
      )}
    </Link>
  );
}

// ── شبکه‌ی کاشی‌ها ────────────────────────────────────────────────────────

/**
 * در موبایل بیش از `mobileLimit` کاشی، بقیه پشت کاشی «همه» می‌روند تا فهرست
 * کار زیر شبکه گم نشود. در دسکتاپ همه دیده می‌شوند. پنهان‌کردن با CSS است،
 * پس بدون اندازه‌گیری و بدون پرش رندر می‌شود.
 */
export function AppGrid({
  apps,
  active,
  badges,
  mobileLimit = 7,
  wide = false,
}: {
  apps: AppItem[];
  active?: string | null;
  badges?: Record<string, number>;
  mobileLimit?: number;
  /** ۹ ستون در صفحه‌ی پهن — برای ماژول‌هایی که بخش زیاد دارند (۱۸ کاشی = دو ردیف) */
  wide?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const clip = !expanded && apps.length > mobileLimit + 1;

  return (
    <div className={`grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 ${wide ? "xl:grid-cols-9" : ""}`}>
      {apps.map((a, i) => (
        <Tile
          key={a.href}
          app={a}
          index={i}
          active={active === a.href}
          badge={badges?.[a.href]}
          className={clip && i >= mobileLimit ? "hidden sm:flex" : ""}
        />
      ))}
      {clip && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{ "--i": mobileLimit } as React.CSSProperties}
          className="adm-rise flex flex-col items-center gap-2 rounded-2xl px-1 pb-2 pt-3 text-center transition-colors hover:bg-[var(--adm-hover)] sm:hidden"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-dashed border-[var(--adm-border-strong)] bg-[var(--adm-surface)] text-gray-500">
            <LayoutGrid className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-h-[2.2em] text-[11.5px] font-bold leading-[1.1rem] text-gray-700 dark:text-gray-300">
            همه ({(apps.length - mobileLimit).toLocaleString("fa-IR")}+)
          </span>
        </button>
      )}
    </div>
  );
}

// ── پنجره‌ی همه‌ی بخش‌ها ─────────────────────────────────────────────────────

export function AppLauncher({
  open,
  onClose,
  title,
  apps,
  active,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  apps: AppItem[];
  active?: string | null;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="adm-fade-in absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-sheet-in relative flex max-h-[88vh] w-full flex-col rounded-t-[28px] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-2xl md:max-w-3xl md:rounded-3xl">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-gray-300 md:hidden dark:bg-white/15" aria-hidden />
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-3 md:pt-5">
          <h3 className="text-base font-black text-gray-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-[var(--adm-hover)] hover:text-gray-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5 md:pb-5">
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6">
            {apps.map((a, i) => (
              <Tile key={a.href} app={a} index={i} active={active === a.href} onNavigate={onClose} />
            ))}
          </div>
          {footer && <div className="mt-3 border-t border-[var(--adm-border)] pt-3">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

// ── نوار ماژول ────────────────────────────────────────────────────────────

/**
 * «حسابداری › فروش ▾» — روی نام بخش بزنید، همه‌ی بخش‌ها باز می‌شوند.
 * جای نوار زبانه‌ی قدیمی را گرفته که با ۱۴ بخش از صفحه بیرون می‌زد.
 */
export function ModuleBar({
  module,
  current,
  onOpenLauncher,
  action,
}: {
  module: { href: string; label: string; icon: LucideIcon; tone: AppTone };
  current: AppItem | null;
  onOpenLauncher: () => void;
  action?: ReactNode;
}) {
  const M = module.icon;
  return (
    <div className="mb-5 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-1 shadow-[var(--adm-shadow)]">
        <Link
          href={module.href}
          className="flex flex-shrink-0 items-center gap-2 rounded-xl py-1 pl-2.5 pr-1 text-[13px] font-black text-gray-900 transition-colors hover:bg-[var(--adm-hover)] dark:text-white"
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${TONE_SOFT[module.tone]}`}>
            <M className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="hidden sm:inline">{module.label}</span>
        </Link>

        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
          /
        </span>

        <button
          type="button"
          onClick={onOpenLauncher}
          aria-haspopup="dialog"
          className="group flex min-w-0 items-center gap-2 rounded-xl py-1 pl-2 pr-1 text-[13px] font-bold text-gray-700 transition-colors hover:bg-[var(--adm-hover)] dark:text-gray-200"
        >
          {current ? (
            <>
              {current.img ? (
                <AppIcon icon={current.icon} tone={current.tone} img={current.img} size="sm" />
              ) : (
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] ${TONE_SOFT[current.tone]}`}>
                  <current.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
              )}
              <span className="truncate">{current.label}</span>
            </>
          ) : (
            <>
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-gray-500/10 text-gray-500">
                <LayoutGrid className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="truncate">همه‌ی بخش‌ها</span>
            </>
          )}
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-y-px" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onOpenLauncher}
          aria-label="همه‌ی بخش‌ها"
          title="همه‌ی بخش‌ها"
          className="mr-auto hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-[var(--adm-hover)] hover:text-gray-900 sm:flex dark:hover:text-white"
        >
          <LayoutGrid className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
      {action}
    </div>
  );
}
