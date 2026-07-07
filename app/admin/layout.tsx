"use client";

import { redirect } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeProvider, useTheme } from "@/components/layout/ThemeProvider";

function Icon({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
    </svg>
  );
}

const ICONS = {
  dashboard:  "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  products:   "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  categories: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  brands:     "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  specs:      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  orders:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  users:      "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  blog:       "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13",
  settings:   "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  shipping:   "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0",
  widgets:    "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
  media:      "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  menu:       "M4 6h16M4 12h16M4 18h7",
  footer:     "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  chevron:    "M19 9l-7 7-7-7",
  external:   "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  logout:     "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  wallet: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  appearance: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  "chat-settings": "M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  changelog:    "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0-8c-1.11 0-2.08.402-2.599 1M12 16v1m0-1c1.11 0 2.08-.402 2.599-1M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  "chat-history": "M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  integration:  "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  plug:         "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  mapping:      "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
  price:        "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a1 1 0 001-1V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z",
  queue:        "M4 6h16M4 10h16M4 14h16M4 18h16",
  logs:         "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
};

const MENU_GROUPS = [
  {
    label: "اصلی",
    items: [
      { href: "/admin", label: "داشبورد", icon: "dashboard", exact: true },
    ],
  },
  {
    label: "فروشگاه",
    items: [
      {
        href: "/admin/products", label: "محصولات", icon: "products",
        children: [
          { href: "/admin/products", label: "لیست محصولات" },
          { href: "/admin/products/create", label: "محصول جدید" },
          { href: "/admin/categories", label: "دسته‌بندی‌ها" },
          { href: "/admin/brands", label: "برندها" },
          { href: "/admin/spec-groups", label: "گروه مشخصات" },
          { href: "/admin/attribute-groups", label: "گروه ویژگی ها" },
          { href: "/admin/products/bulk-price", label: "ویرایش گروهی قیمت", icon: "🏷️" },
          { href: "/admin/products/bulk-stock", label: "ویرایش گروهی موجودی", icon: "📦" },

        ],
        
      },
      {
            href: "/admin/guaranty", label: "گارانتی", icon: "shipping",
            children: [
              { href: "/admin/guaranty", label: "لیست گارانتی‌ها" },
              { href: "/admin/guaranty/requests", label: "درخواست‌های گارانتی" },
            ],
          },
      { href: "/admin/orders", label: "سفارشات", icon: "orders" },
      { href: "/admin/wallet", label: "کیف پول", icon: "wallet" },
      { href: "/admin/users", label: "کاربران", icon: "users" },
      { href: "/admin/shipping", label: "ارسال و پرداخت", icon: "shipping" },
      
    ],
  },
  {
    label: "محتوا",
    items: [
      { href: "/admin/media", label: "کتابخانه رسانه", icon: "media" },
      {
        href: "/admin/blog", label: "مجله / بلاگ", icon: "blog",
        children: [
          { href: "/admin/blog", label: "مطالب" },
          { href: "/admin/blog/create", label: "مطلب جدید" },
          { href: "/admin/blog/categories", label: "دسته‌بندی‌ها" },
          { href: "/admin/blog/comments", label: "نظرات" },
        ],
      },
      {
        href: "/admin/widgets", label: "صفحه اصلی", icon: "widgets",
        children: [
          { href: "/admin/widgets", label: "ویجت‌ها" },
          { href: "/admin/hero-slides", label: "اسلایدر Hero" },
          { href: "/admin/stories", label: "استوری‌ها" },
        ],
      },
    ],
  },
  {
    label: "یکپارچه‌سازی",
    items: [
      {
        href: "/admin/integration", label: "یکپارچه‌سازی", icon: "integration",
        children: [
          { href: "/admin/integration",                       label: "داشبورد" },
          { href: "/admin/integration/connections",           label: "اتصالات" },
          { href: "/admin/integration/mapping",               label: "نگاشت محصولات" },
          { href: "/admin/integration/product-suggestions",   label: "پیشنهادات اضافه کردن محصول" },
          { href: "/admin/integration/price-rules",           label: "قوانین قیمت" },
          { href: "/admin/integration/pricing",               label: "مدیریت قیمت خرید" },
          { href: "/admin/integration/inventory",             label: "مدیریت موجودی" },
          { href: "/admin/integration/queue",                 label: "صف عملیات" },
          { href: "/admin/integration/logs",                  label: "گزارش لاگ‌ها" },
        ],
      },
    ],
  },
  {
    label: "تنظیمات",
    items: [
      {
        href: "/admin/site-settings", label: "سایت", icon: "settings",
        children: [
          { href: "/admin/site-settings", label: "تنظیمات عمومی" },
          { href: "/admin/menu", label: "منوی هدر" },
          { href: "/admin/footer", label: "فوتر" },
          { href: "/admin/appearance", label: "ظاهر سایت", icon: "appearance" },
          { href: "/admin/admins", label: "مدیریت ادمین‌ها", icon: "🔐" },
          { href: "/admin/chat-settings", label: "تنظیمات چت", icon: "💬" },
          { href: "/admin/chat-history", label: "تاریخچه چت", icon: "💬" },
          { href: "/admin/callback-requests", label: "درخواست‌های تماس", icon: "💬" },
          { href: "/admin/changelog", label: "نسخه برنامه", icon: "🚀" }
        ],
      },
    ],
  },
  
];

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({
  item, depth = 0,
}: {
  item: typeof MENU_GROUPS[0]["items"][0] & { children?: { href: string; label: string }[]; exact?: boolean };
  depth?: number;
}) {
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;

  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  const isChildActive = hasChildren && item.children!.some(c => pathname.startsWith(c.href));

  const [open, setOpen] = useState(isActive || isChildActive);

  if (depth === 0 && hasChildren) {
    return (
      <li>
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group ${
            isChildActive
              ? "bg-blue-500/10 text-blue-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-200 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <span className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
            isChildActive ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-gray-500 group-hover:text-gray-300"
          }`}>
            <Icon path={ICONS[item.icon as keyof typeof ICONS]} className="w-3.5 h-3.5" />
          </span>
          <span className="flex-1 text-right">{item.label}</span>
          <Icon
            path={ICONS.chevron}
            className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <ul className="mt-1 mr-4 pr-3 border-r border-white/5 space-y-0.5">
            {item.children!.map(child => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    pathname === child.href || (child.href !== item.href && pathname.startsWith(child.href))
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-gray-500 hhover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                  {child.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group ${
          isActive
            ? "bg-blue-500/15 text-blue-400"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
        }`}
      >
        <span className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
          isActive ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-gray-500 group-hover:text-gray-300"
        }`}>
          <Icon path={ICONS[item.icon as keyof typeof ICONS]} className="w-3.5 h-3.5" />
        </span>
        {item.label}
      </Link>
    </li>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 right-0 h-full z-50 lg:static lg:z-auto
        w-64 flex flex-col
        bg-white dark:bg-[#0f1117] border-l border-gray-200 dark:border-white/[0.06]
        transition-transform duration-300 ease-out
        ${mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Icon path={ICONS.widgets} className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">پنل مدیریت</p>
              <p className="text-[10px] text-gray-500 dark:text-white" >Admin Panel</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {MENU_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.href} item={item as any} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-white/[0.06]">
          <Link href="/" target="_blank"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
            <Icon path={ICONS.external} className="w-3.5 h-3.5" />
            مشاهده سایت
          </Link>
        </div>
      </aside>
    </>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle}
      className="w-8 h-8 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
      {theme === "dark" ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
   <ThemeProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#080b12]" dir="rtl">

      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#0f1117] border-b border-gray-200 dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <Breadcrumb />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" target="_blank"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all border border-white/[0.06]">
              <Icon path={ICONS.external} className="w-3.5 h-3.5" />
              سایت
            </Link>
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-black">
              A
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#080b12]">
          {children}
        </main>
      </div>
    </div>
   </ThemeProvider>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────────
function Breadcrumb() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  const labels: Record<string, string> = {
    admin: "داشبورد", products: "محصولات", categories: "دسته‌بندی‌ها",
    brands: "برندها", orders: "سفارشات", users: "کاربران",
    "spec-groups": "مشخصات", blog: "بلاگ", widgets: "ویجت‌ها",
    stories: "استوری‌ها", "hero-slides": "اسلایدر", shipping: "ارسال",
    "site-settings": "تنظیمات", footer: "فوتر", menu: "منو",
    create: "جدید", comments: "نظرات", media: "کتابخانه رسانه", guaranty: "گارانتی", requests: "درخواست‌ها", wallet: "کیف پول", appearance: "ظاهر سایت", "chat-settings": "تنظیمات چت", changelog: "نسخه برنامه", "chat-history": "تاریخچه چت", "callback-requests": "درخواست‌های تماس",
    integration: "یکپارچه‌سازی", connections: "اتصالات", mapping: "نگاشت محصولات", "product-suggestions": "پیشنهادات محصول", "price-rules": "قوانین قیمت", queue: "صف عملیات", logs: "لاگ‌ها",
  };

  return (
    <nav className="flex items-center gap-1.5 text-xs font-bold">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-700">/</span>}
          <span className={i === parts.length - 1 ? "text-gray-200" : "text-gray-400 dark:text-gray-600"}>
            {labels[part] ?? part}
          </span>
        </span>
      ))}
    </nav>
  );
}
