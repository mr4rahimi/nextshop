"use client";

/**
 * سایدبار پنل مدیریت.
 *
 * سه حالت دارد و هر سه از یک درخت منو (`components/admin/nav.tsx`) ساخته می‌شوند:
 *
 * | حالت | کِی | رفتار |
 * |------|-----|-------|
 * | باز | دسکتاپ، پیش‌فرض | آیکن + عنوان + زیرمنوی آکاردئونی |
 * | جمع | دسکتاپ، بعد از کلیک روی دکمه‌ی جمع‌کردن | فقط آیکن؛ زیرمنو با هاور به شکل پنل شناور کنار ریل باز می‌شود |
 * | کشویی | زیر `lg` | از سمت راست باز می‌شود، همیشه کامل است و با انتخاب هر لینک بسته می‌شود |
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
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, MENU_GROUPS, type NavChild, type NavGroup, type NavItem } from "./nav";

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
function normalize(s: string): string {
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

  return createPortal(
    <div
      dir="rtl"
      onMouseEnter={onHold}
      onMouseLeave={onRelease}
      style={{ top: state.top, right: state.right }}
      className="admin-nav-flyout fixed z-[80] w-60 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#12151d]/95"
    >
      <Link
        href={item.href}
        onClick={onNavigate}
        className="mb-1 block rounded-xl px-3 py-2 text-xs font-black text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
      >
        {item.label}
      </Link>

      {item.children && item.children.length > 0 && (
        <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
          {item.children.map(child => {
            const active = basePath(child.href) === activeChild;
            return (
              <li key={child.href + child.label}>
                <Link
                  href={child.href}
                  target={child.target ? "_blank" : undefined}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    active
                      ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
                  }`}
                >
                  <span className="h-1 w-1 flex-shrink-0 rounded-full bg-current" />
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
    if (activeChild) setOpen(true);
  }, [activeChild]);

  const chip = (
    <span
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] text-[13px] transition-all ${
        active
          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-600/30"
          : "bg-gray-100 text-gray-500 group-hover:text-gray-900 dark:bg-white/[0.06] dark:text-gray-400 dark:group-hover:text-gray-200"
      }`}
    >
      <Icon name={item.icon} className="h-4 w-4" />
    </span>
  );

  const rowClass = `nav-row group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-bold transition-all ${
    active
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-100"
  }`;

  const hoverProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => onHoverStart(e.currentTarget, item),
    onMouseLeave: onHoverEnd,
    // در حالت جمع، پیمایش با Tab هم باید عنوان و زیرمنو را نشان بدهد
    onFocus: (e: React.FocusEvent<HTMLElement>) => onHoverStart(e.currentTarget, item),
    onBlur: onHoverEnd,
  };

  // در حالت جمع هیچ آکاردئونی باز نمی‌شود؛ همه‌چیز از پنل شناور می‌آید.
  if (collapsed || !hasChildren) {
    return (
      <li>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={rowClass}
          {...hoverProps}
        >
          {chip}
          <span className="nav-expanded-only flex-1 truncate text-right">{item.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open || forceOpen}
        className={rowClass}
      >
        {chip}
        <span className="nav-expanded-only flex-1 truncate text-right">{item.label}</span>
        <Icon
          name="chevron"
          className={`nav-expanded-only h-3.5 w-3.5 flex-shrink-0 opacity-60 transition-transform duration-200 ${
            open || forceOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {(open || forceOpen) && (
        <ul className="nav-expanded-only mt-1 mr-5 space-y-0.5 border-r border-gray-200 pr-3 dark:border-white/[0.07]">
          {item.children!.map(child => {
            const childActive = basePath(child.href) === activeChild;
            return (
              <li key={child.href + child.label}>
                <Link
                  href={child.href}
                  target={child.target ? "_blank" : undefined}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                    childActive
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-500 dark:hover:bg-white/[0.04] dark:hover:text-gray-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors ${
                      childActive ? "bg-blue-500" : "bg-gray-300 dark:bg-white/20"
                    }`}
                  />
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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
  const router = useRouter();
  const asideRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

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

  // با هر جابه‌جایی، کشوی موبایل و پنل شناور بسته می‌شوند
  useEffect(() => {
    setFlyout(null);
  }, [pathname]);

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
      const estimated = 52 + (item.children?.length ?? 0) * 30;
      const top = Math.max(12, Math.min(row.top - 6, window.innerHeight - estimated - 16));

      setFlyout({ item, top, right: window.innerWidth - aside.left + 10 });
    },
    [collapsed, holdFlyout],
  );

  useEffect(() => () => holdFlyout(), [holdFlyout]);

  const groups = useMemo(() => filterGroups(MENU_GROUPS, query), [query]);
  const searching = query.trim().length > 0;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/admin/login");
    router.refresh();
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
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        ref={asideRef}
        className={`admin-nav fixed top-0 right-0 z-50 flex h-full flex-col border-l border-gray-200 bg-white lg:relative lg:z-auto dark:border-white/[0.06] dark:bg-[#0f1117] ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0"
        }`}
      >
        {/* دکمه‌ی جمع/باز — روی لبه‌ی داخلی سایدبار می‌نشیند */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "باز کردن منو" : "جمع کردن منو"}
          title={collapsed ? "باز کردن منو" : "جمع کردن منو"}
          className="absolute top-[3.9rem] -left-3 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition-all hover:border-blue-400 hover:text-blue-500 lg:flex dark:border-white/10 dark:bg-[#171b24] dark:text-gray-400 dark:hover:text-blue-400"
        >
          <Icon
            name="chevron"
            className={`h-3 w-3 transition-transform duration-200 ${collapsed ? "rotate-90" : "-rotate-90"}`}
          />
        </button>

        {/* سرصفحه */}
        <div className="nav-head flex h-14 flex-shrink-0 items-center gap-3 border-b border-gray-200 px-4 dark:border-white/[0.06]">
          <Link
            href="/admin"
            onClick={handleNavigate}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30"
          >
            <Icon name="widgets" className="h-4 w-4 text-white" />
          </Link>

          <div className="nav-expanded-only min-w-0 flex-1">
            <p className="truncate text-[13px] font-black text-gray-900 dark:text-white">پنل مدیریت</p>
            <p className="truncate text-[10px] font-bold text-gray-400 dark:text-gray-500">
              {storeName || "Admin Panel"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن منو"
            className="nav-expanded-only flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden dark:hover:bg-white/5 dark:hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* جستجو */}
        <div className="nav-expanded-only flex-shrink-0 px-3 pt-3">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center text-gray-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="جستجو در منو…"
              aria-label="جستجو در منو"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pr-9 pl-8 text-[12px] font-bold text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-gray-600 dark:focus:bg-white/[0.07]"
            />
            {searching && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="پاک کردن جستجو"
                className="absolute inset-y-0 left-0 flex w-8 items-center justify-center text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* دکمه‌ی جستجو در حالت جمع — باز می‌کند و فوکوس می‌دهد */}
        <div className="nav-collapsed-only flex-shrink-0 px-3 pt-3">
          <button
            type="button"
            onClick={() => {
              toggleCollapsed();
              setTimeout(() => searchRef.current?.focus(), 220);
            }}
            aria-label="جستجو در منو"
            title="جستجو در منو"
            className="flex h-9 w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-400 transition-colors hover:text-blue-500 dark:border-white/[0.07] dark:bg-white/[0.04] dark:hover:text-blue-400"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </button>
        </div>

        {/* درخت منو */}
        <nav className="admin-nav-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {groups.length === 0 && (
            <p className="px-2 py-6 text-center text-[11px] font-bold text-gray-400">
              چیزی پیدا نشد
            </p>
          )}

          {groups.map(group => (
            <div key={group.label}>
              <p className="nav-expanded-only mb-1.5 px-2.5 text-[9.5px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600">
                {group.label}
              </p>
              <div className="nav-collapsed-only mx-auto mb-2 h-px w-7 bg-gray-200 dark:bg-white/10" />
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
        <div className="flex-shrink-0 space-y-1 border-t border-gray-200 p-3 dark:border-white/[0.06]">
          <Link
            href="/"
            target="_blank"
            className="nav-row group flex items-center gap-3 rounded-xl px-2.5 py-2 text-[12px] font-bold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-100"
            title="مشاهده سایت"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
              <Icon name="external" className="h-4 w-4" />
            </span>
            <span className="nav-expanded-only truncate">مشاهده سایت</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="خروج از حساب"
            className="nav-row group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[12px] font-bold text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-60 dark:text-gray-400 dark:hover:text-red-400"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-gray-500 transition-colors group-hover:bg-red-500/15 group-hover:text-red-500 dark:bg-white/[0.06] dark:text-gray-400 dark:group-hover:text-red-400">
              <Icon name="logout" className="h-4 w-4" />
            </span>
            <span className="nav-expanded-only truncate">{loggingOut ? "در حال خروج…" : "خروج از حساب"}</span>
          </button>
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
          width: 17rem;
          transition: width .22s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.4,0,.2,1);
        }
        .nav-collapsed-only { display: none; }

        .admin-nav-scroll { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.35) transparent; }
        .admin-nav-scroll::-webkit-scrollbar { width: 6px; }
        .admin-nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .admin-nav-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,.3); border-radius: 999px; }
        .admin-nav-scroll:hover::-webkit-scrollbar-thumb { background: rgba(148,163,184,.5); }

        .admin-nav-flyout { animation: adminNavFlyIn .13s ease-out; }
        @keyframes adminNavFlyIn {
          from { opacity: 0; transform: translateX(6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* حالت جمع فقط روی دسکتاپ معنا دارد — کشوی موبایل همیشه کامل است */
        @media (min-width: 1024px) {
          html.${COLLAPSED_CLASS} .admin-nav { width: 4.75rem; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-expanded-only { display: none !important; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-collapsed-only { display: block; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-head { justify-content: center; padding-left: 0; padding-right: 0; }
          html.${COLLAPSED_CLASS} .admin-nav .nav-row { justify-content: center; padding-left: 0; padding-right: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .admin-nav, .admin-nav-flyout { transition: none; animation: none; }
        }
      `}</style>
    </>
  );
}
