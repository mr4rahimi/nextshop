"use client";

/**
 * سایدبار پنل مدیریت.
 *
 * سه حالت دارد و هر سه از یک درخت منو (`components/admin/nav.tsx`) ساخته می‌شوند:
 *
 * | حالت | کِی | رفتار |
 * |------|-----|-------|
 * | باز | دسکتاپ، پیش‌فرض | آیکن + عنوان + زیرمنوی آکاردئونی |
 * | جمع | دسکتاپ، با دکمه‌ی پایین سایدبار یا Ctrl+B | فقط آیکن؛ زیرمنو با هاور به شکل پنل شناور کنار ریل باز می‌شود |
 * | کشویی | زیر `lg` | از سمت راست باز می‌شود، همیشه کامل است و با انتخاب هر لینک بسته می‌شود |
 *
 * ⚠️ **هندسه‌ی ثابت:** فاصله‌ی افقی هر ردیف در دو حالت یکی است و فقط عرض
 * سایدبار عوض می‌شود؛ متن‌ها محو می‌شوند و لبه‌ی سایدبار آن‌ها را می‌بُرد.
 * برای همین آیکن‌ها هنگام جمع‌شدن سر جایشان می‌مانند و چیزی نمی‌پرد. هر
 * padding تازه باید در هر دو حالت برابر بماند.
 *
 * ⚠️ **چرا جمع‌بودن با کلاس روی `<html>` کار می‌کند و نه با state؟**
 * اگر عرض سایدبار از state می‌آمد، هر بار بعد از رفرش یک لحظه باز رندر می‌شد و
 * بعد جمع می‌پرید. اسکریپت `BOOT_SCRIPT` پیش از اولین رنگ‌آمیزی کلاس را روی
 * `<html>` می‌گذارد و CSS بقیه‌ی کار را می‌کند؛ state فقط برای منطق جاوااسکریپت
 * (پنل شناور و aria) با آن هم‌گام می‌شود.
 *
 * ⚠️ پنل شناور با `createPortal` روی `body` می‌نشیند، نه داخل ریل. داخل ریل
 * `overflow-y: auto` است و پنل از پهلو بریده می‌شد.
 *
 * مستندات: docs/features/admin-sidebar.md
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LogOut, PanelRightClose, PanelRightOpen, Search, X } from "lucide-react";
import { Icon, MENU_GROUPS, type NavChild, type NavGroup, type NavItem } from "./nav";
import { canOpenPath, type GateAccess } from "@/lib/admin-sections";
import { initialOf, useAdminMe } from "./useAdminMe";

const STORAGE_KEY = "admin:sidebar";
const COLLAPSED_CLASS = "admin-nav-collapsed";

/** پیش از اولین رنگ‌آمیزی اجرا می‌شود تا سایدبار جمع، جمع رندر شود. */
const BOOT_SCRIPT =
  `(function(){try{if(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})==="collapsed")` +
  `{document.documentElement.classList.add(${JSON.stringify(COLLAPSED_CLASS)})}}catch(e){}})()`;

// ── تطبیق مسیر ────────────────────────────────────────────────────────────────

/** بخش کوئری برای تطبیق مسیر به کار نمی‌آید (`/admin/comments?tab=blog`) */
function basePath(href: string): string {
  return href.split("?")[0];
}

function matches(pathname: string, href: string): boolean {
  const p = basePath(href);
  return pathname === p || pathname.startsWith(`${p}/`);
}

/**
 * فعال‌ترین زیرمنو، نه هر زیرمنویی که مسیر با آن شروع شود.
 *
 * بدون این، در «کارتابل» هم «کارهای من» (`/admin/worklist`) و هم «تماس‌ها»
 * (`/admin/worklist/calls`) هم‌زمان فعال نشان داده می‌شدند.
 */
function activeChildHref(pathname: string, children?: NavChild[]): string | null {
  let best: string | null = null;
  for (const c of children ?? []) {
    const p = basePath(c.href);
    if (matches(pathname, p) && (best === null || p.length > best.length)) best = p;
  }
  return best;
}

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (matches(pathname, item.href)) return true;
  return activeChildHref(pathname, item.children) !== null;
}

// ── جستجو ─────────────────────────────────────────────────────────────────────

/** ی/ي و ک/ك و اعراب را یکسان می‌کند تا جستجو به شکل تایپ حساس نباشد */
export function normalize(s: string): string {
  return s
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ً-ْ‌]/g, "")
    .trim()
    .toLowerCase();
}

function filterGroups(groups: NavGroup[], query: string): NavGroup[] {
  const q = normalize(query);
  if (!q) return groups;

  return groups
    .map(g => ({
      ...g,
      items: g.items.reduce<NavItem[]>((acc, item) => {
        if (normalize(item.label).includes(q)) {
          acc.push(item);
        } else {
          const kids = (item.children ?? []).filter(c => normalize(c.label).includes(q));
          if (kids.length) acc.push({ ...item, children: kids });
        }
        return acc;
      }, []),
    }))
    .filter(g => g.items.length > 0);
}

/**
 * پنهان‌کردن بخش‌هایی که کاربر به آن‌ها دسترسی ندارد.
 *
 * ⚠️ فقط راحتی است، نه امنیت — مرز واقعی proxy.ts است. تا وقتی دسترسی
 * نیامده (`null`) همه‌چیز نشان داده می‌شود تا منو پرش نکند.
 */
export function filterByAccess(groups: NavGroup[], access: GateAccess | null): NavGroup[] {
  if (!access || access.isUnrestricted) return groups;
  const open = (href: string) => canOpenPath(href.split("?")[0], access);

  return groups
    .map((g) => ({
      ...g,
      items: g.items.reduce<NavItem[]>((acc, item) => {
        const kids = (item.children ?? []).filter((c) => !c.target && open(c.href));
        if (item.children?.length) {
          if (kids.length) acc.push({ ...item, href: open(item.href) ? item.href : kids[0].href, children: kids });
        } else if (open(item.href)) {
          acc.push(item);
        }
        return acc;
      }, []),
    }))
    .filter((g) => g.items.length > 0);
}

// ── پنل شناور حالت جمع ────────────────────────────────────────────────────────

interface FlyoutState {
  item: NavItem;
  top: number;
  /** فاصله از لبه‌ی راست پنجره — سایدبار در RTL سمت راست است */
  right: number;
}

function Flyout({
  state,
  pathname,
  onHold,
  onRelease,
  onNavigate,
}: {
  state: FlyoutState;
  pathname: string;
  onHold: () => void;
  onRelease: () => void;
  onNavigate: () => void;
}) {
  const { item } = state;
  const activeChild = activeChildHref(pathname, item.children);
  const hasChildren = !!item.children?.length;

  return createPortal(
    <div
      dir="rtl"
      onMouseEnter={onHold}
      onMouseLeave={onRelease}
      style={{ top: state.top, right: state.right }}
      className={`admin-nav-flyout fixed z-[80] rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_16px_40px_-12px_rgba(16,24,40,.25)] backdrop-blur-xl dark:border-white/10 dark:bg-[#141922]/95 ${
        hasChildren ? "w-60 p-1.5" : "p-1"
      }`}
    >
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`block rounded-xl px-3 py-2 text-[13px] font-black text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-white/5 ${
          hasChildren ? "mb-1 border-b border-gray-100 rounded-b-none dark:border-white/5" : "whitespace-nowrap"
        }`}
      >
        {item.label}
      </Link>

      {hasChildren && (
        <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
          {item.children!.map(child => {
            const active = basePath(child.href) === activeChild;
            return (
              <li key={child.href + child.label}>
                <Link
                  href={child.href}
                  target={child.target ? "_blank" : undefined}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    active
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${active ? "bg-blue-500" : "bg-gray-300 dark:bg-white/20"}`} />
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>,
    document.body,
  );
}

// ── یک آیتم منو ───────────────────────────────────────────────────────────────

/** کلاس مشترک هر ردیف — padding افقی در هر دو حالت یکی است (هندسه‌ی ثابت) */
const ROW =
  "nav-row group relative flex h-10 w-full items-center gap-2.5 rounded-xl px-[7px] text-[13px] font-bold transition-colors duration-150";

function NavRow({
  item,
  pathname,
  collapsed,
  forceOpen,
  onHoverStart,
  onHoverEnd,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  /** هنگام جستجو همه‌ی نتیجه‌ها باز می‌مانند */
  forceOpen: boolean;
  onHoverStart: (el: HTMLElement, item: NavItem) => void;
  onHoverEnd: () => void;
  onNavigate: () => void;
}) {
  const hasChildren = !!item.children?.length;
  const activeChild = activeChildHref(pathname, item.children);
  const active = isItemActive(pathname, item);

  const [open, setOpen] = useState(active);

  // با رفتن به صفحه‌ای از این شاخه، شاخه خودش باز می‌شود — بدون این، کاربر بعد
  // از کلیک روی نتیجه‌ی جستجو زیرمنوی بسته می‌دید.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- باز شدن شاخه دنبال مسیر است، نه رویداد کاربر
    if (activeChild) setOpen(true);
  }, [activeChild]);

  const expanded = (open || forceOpen) && !collapsed;

  const chip = (
    <span
      className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] transition-all duration-200 ${
        active
          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-600/30"
          : "text-gray-500 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-100"
      }`}
    >
      <Icon name={item.icon} className="h-[18px] w-[18px]" />
    </span>
  );

  const rowClass = `${ROW} ${
    active
      ? "text-gray-900 dark:text-white"
      : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-100"
  }`;

  const hoverProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => onHoverStart(e.currentTarget, item),
    onMouseLeave: onHoverEnd,
    // در حالت جمع، پیمایش با Tab هم باید عنوان و زیرمنو را نشان بدهد
    onFocus: (e: React.FocusEvent<HTMLElement>) => onHoverStart(e.currentTarget, item),
    onBlur: onHoverEnd,
  };

  /** نوار باریک کنار ردیف فعال، چسبیده به لبه‌ی سایدبار */
  const indicator = active && (
    <span aria-hidden className="absolute -right-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-l-full bg-blue-500" />
  );

  // در حالت جمع هیچ آکاردئونی باز نمی‌شود؛ همه‌چیز از پنل شناور می‌آید.
  if (collapsed || !hasChildren) {
    return (
      <li>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active && !hasChildren ? "page" : undefined}
          className={rowClass}
          {...hoverProps}
        >
          {indicator}
          {chip}
          <span className="nav-label flex-1 truncate text-right">{item.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={expanded} className={rowClass}>
        {indicator}
        {chip}
        <span className="nav-label flex-1 truncate text-right">{item.label}</span>
        <ChevronDown
          className={`nav-label h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {/* آکاردئون نرم: ارتفاع با grid-template-rows از ۰ تا اندازه‌ی واقعی می‌رود */}
      <div
        className={`nav-sub grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        inert={!expanded}
      >
        <div className="overflow-hidden">
          <ul className="mr-[23px] mt-0.5 mb-1 space-y-px border-r border-gray-200 pr-2 dark:border-white/[0.08]">
            {item.children!.map(child => {
              const childActive = basePath(child.href) === activeChild;
              return (
                <li key={child.href + child.label}>
                  <Link
                    href={child.href}
                    target={child.target ? "_blank" : undefined}
                    onClick={onNavigate}
                    aria-current={childActive ? "page" : undefined}
                    className={`relative flex h-8 items-center rounded-lg px-3 text-[12.5px] font-bold transition-colors ${
                      childActive
                        ? "bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"
                        : "text-gray-500 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-100"
                    }`}
                  >
                    {childActive && (
                      <span aria-hidden className="absolute -right-[9px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
                    )}
                    <span className="truncate">{child.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}

// ── سایدبار ───────────────────────────────────────────────────────────────────

export default function AdminSidebar({
  mobileOpen,
  onClose,
  storeName,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  storeName?: string;
}) {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const me = useAdminMe();

  // هم‌گام‌سازی state با کلاسی که BOOT_SCRIPT گذاشته است
  useEffect(() => {
    setCollapsed(document.documentElement.classList.contains(COLLAPSED_CLASS));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      document.documentElement.classList.toggle(COLLAPSED_CLASS, next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {}
      return next;
    });
    setFlyout(null);
    setQuery("");
  }, []);

  // Ctrl+B (یا ⌘B) — همان میان‌بر ویرایشگرها برای جمع/باز کردن نوار کناری
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === "KeyB" && window.innerWidth >= 1024) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  // با هر جابه‌جایی، پنل شناور بسته می‌شود
  useEffect(() => {
    setFlyout(null);
  }, [pathname]);

  // ردیف فعال در بار اول دیده شود — در منوی بلند ممکن بود پایین‌تر از دید باشد
  useEffect(() => {
    asideRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, []);

  // کشوی موبایل: قفل اسکرول صفحه و بستن با Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, onClose]);

  const holdFlyout = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const releaseFlyout = useCallback(() => {
    holdFlyout();
    // بدون این شرط، هر بار عبور ماوس از روی منو در حالت باز هم یک تایمر می‌ساخت
    setFlyout(current => {
      if (current) closeTimer.current = setTimeout(() => setFlyout(null), 140);
      return current;
    });
  }, [holdFlyout]);

  const openFlyout = useCallback(
    (el: HTMLElement, item: NavItem) => {
      if (!collapsed || !asideRef.current) return;
      holdFlyout();

      const row = el.getBoundingClientRect();
      const aside = asideRef.current.getBoundingClientRect();
      // ارتفاع تخمینی: سرصفحه + هر زیرمنو یک ردیف. دقیق نیست، فقط برای این است
      // که پنل از پایین پنجره بیرون نزند.
      const hasKids = !!item.children?.length;
      const estimated = hasKids ? 56 + item.children!.length * 34 : 40;
      const top = hasKids
        ? Math.max(12, Math.min(row.top - 6, window.innerHeight - estimated - 16))
        : row.top + (row.height - estimated) / 2;

      setFlyout({ item, top, right: window.innerWidth - aside.left + 8 });
    },
    [collapsed, holdFlyout],
  );

  useEffect(() => () => holdFlyout(), [holdFlyout]);

  const access: GateAccess | null = me ? { isUnrestricted: me.isUnrestricted, permissions: me.permissions } : null;
  const groups = useMemo(
    () => filterGroups(filterByAccess(MENU_GROUPS, access), query),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `access` از `me` ساخته می‌شود
    [me, query],
  );
  const searching = query.trim().length > 0;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    // حساب بعدی ممکن است کس دیگری باشد — بارگذاری کامل تا کش دسترسی هم پاک شود
    window.location.href = "/admin/login";
  }

  /** روی موبایل هر انتخابی کشو را می‌بندد؛ روی دسکتاپ کاری نمی‌کند */
  const handleNavigate = useCallback(() => {
    onClose();
    setFlyout(null);
  }, [onClose]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />

      {/* پرده‌ی کشوی موبایل */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        ref={asideRef}
        aria-label="منوی پنل"
        className={`admin-nav fixed top-0 right-0 z-50 flex h-full flex-col overflow-hidden border-l border-[var(--adm-border)] bg-white lg:relative lg:z-auto dark:bg-[#0d1118] ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0"
        }`}
      >
        {/* سرصفحه */}
        <div className="flex h-16 flex-shrink-0 items-center gap-2.5 px-3">
          <Link
            href="/admin"
            onClick={handleNavigate}
            className="mr-[7px] flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 shadow-lg shadow-indigo-600/30 ring-1 ring-inset ring-white/20"
            aria-label="داشبورد"
          >
            <Icon name="widgets" className="h-[18px] w-[18px] text-white" />
          </Link>

          <div className="nav-label min-w-0 flex-1">
            <p className="truncate text-[14px] font-black text-gray-900 dark:text-white">پنل مدیریت</p>
            <p className="truncate text-[11px] font-bold text-gray-400 dark:text-gray-500">{storeName || "مدیریت فروشگاه"}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن منو"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden dark:hover:bg-white/5 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* جستجو — در حالت جمع همان جعبه فقط آیکنش پیداست و با کلیک باز می‌شود */}
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="relative h-10">
            <span className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Escape" && setQuery("")}
              placeholder="جستجو در منو…"
              aria-label="جستجو در منو"
              className="nav-search h-full w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-8 text-[13px] font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400 transition-[border-color,background-color,box-shadow] focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-white/[0.07]"
            />
            {searching && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="پاک کردن جستجو"
                className="nav-label absolute inset-y-0 left-0 flex w-8 items-center justify-center text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                toggleCollapsed();
                setTimeout(() => searchRef.current?.focus(), 220);
              }}
              aria-label="جستجو در منو"
              title="جستجو در منو"
              className="nav-collapsed-only absolute inset-0 rounded-xl"
            />
          </div>
        </div>

        {/* درخت منو */}
        <nav className="admin-nav-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-1">
          {groups.length === 0 && (
            <p className="nav-label px-2 py-8 text-center text-xs font-bold text-gray-400">چیزی پیدا نشد</p>
          )}

          {groups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-3" : ""}>
              {/* عنوان گروه ارتفاع ثابت دارد؛ در حالت جمع جایش یک خط کوتاه می‌نشیند */}
              <div className="relative flex h-7 items-center px-[9px]">
                <p className="nav-label text-[10.5px] font-black tracking-wide text-gray-400 dark:text-gray-500">{group.label}</p>
                <span className="nav-collapsed-only absolute right-[19px] top-1/2 h-px w-5 bg-gray-200 dark:bg-white/10" />
              </div>
              <ul className="space-y-0.5">
                {group.items.map(item => (
                  <NavRow
                    key={item.href + item.label}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    forceOpen={searching}
                    onHoverStart={openFlyout}
                    onHoverEnd={releaseFlyout}
                    onNavigate={handleNavigate}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* پاصفحه */}
        <div className="flex-shrink-0 border-t border-[var(--adm-border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "باز کردن منو (Ctrl+B)" : "جمع کردن منو (Ctrl+B)"}
            aria-label={collapsed ? "باز کردن منو" : "جمع کردن منو"}
            className={`${ROW} mb-1 hidden text-gray-500 hover:bg-gray-100/80 hover:text-gray-900 lg:flex dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-100`}
          >
            <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center">
              {collapsed ? <PanelRightOpen className="h-[18px] w-[18px]" aria-hidden /> : <PanelRightClose className="h-[18px] w-[18px]" aria-hidden />}
            </span>
            <span className="nav-label flex-1 truncate text-right text-[12.5px]">جمع کردن منو</span>
            <kbd className="nav-label rounded-md border border-gray-200 px-1.5 py-0.5 font-sans text-[10px] font-bold text-gray-400 dark:border-white/10" dir="ltr">
              Ctrl B
            </kbd>
          </button>

          <div className="nav-user flex items-center gap-2.5 rounded-2xl bg-gray-50 p-[7px] dark:bg-white/[0.03]">
            <span
              className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-[13px] font-black text-white dark:from-slate-500 dark:to-slate-700"
              title={me?.name ?? undefined}
            >
              {initialOf(me?.name)}
            </span>
            <div className="nav-label min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-black text-gray-900 dark:text-gray-100">{me?.name || "مدیر"}</p>
              <p className="truncate text-[11px] font-bold text-gray-400 dark:text-gray-500">
                {me?.roleTitle || (me?.isUnrestricted ? "دسترسی کامل" : " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="خروج از حساب"
              aria-label="خروج از حساب"
              className="nav-logout flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            >
              <LogOut className="h-[17px] w-[17px]" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      {flyout && (
        <Flyout
          state={flyout}
          pathname={pathname}
          onHold={holdFlyout}
          onRelease={releaseFlyout}
          onNavigate={handleNavigate}
        />
      )}

      <style>{`
        .admin-nav {
          width: min(18rem, 86vw);
          transition: width .24s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.32,.72,0,1);
        }
        @media (min-width: 1024px) { .admin-nav { width: 17rem; } }
        .nav-label { transition: opacity .16s ease; white-space: nowrap; }
        .nav-collapsed-only { display: none; }

        .admin-nav-flyout { animation: adminNavFlyIn .14s ease-out; }
        @keyframes adminNavFlyIn {
          from { opacity: 0; transform: translateX(6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* حالت جمع فقط روی دسکتاپ معنا دارد — کشوی موبایل همیشه کامل است.
           عرض کم می‌شود، متن‌ها محو می‌شوند و زیرمنوها نرم بسته می‌شوند؛
           هیچ padding‌ای عوض نمی‌شود تا آیکن‌ها سر جایشان بمانند. */
        @media (min-width: 1024px) {
          html.${COLLAPSED_CLASS} .admin-nav { width: 4.5rem; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-label { opacity: 0; pointer-events: none; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-collapsed-only { display: block; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-sub { grid-template-rows: 0fr; opacity: 0; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-search { color: transparent; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-search::placeholder { color: transparent; }
          /* کارت کاربر: دکمه‌ی خروج زیر آواتار می‌رود */
          html.${COLLAPSED_CLASS} .admin-nav .nav-user { flex-direction: column; background: transparent; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-user .nav-label { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .admin-nav, .admin-nav-flyout, .nav-label, .nav-sub { transition: none; animation: none; }
        }
      `}</style>
    </>
  );
}
