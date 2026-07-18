"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
    avatarUrl: string | null;
    role: string;
  };
}

const menuItems = [
  {
    href: "/user",
    label: "پیشخوان",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/user/orders",
    label: "سفارش‌های من",
    badge: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    href: "/user/wallet",
    label: "کیف پول و تراکنش‌ها",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: "/user/wishlist",
    label: "علاقه‌مندی‌ها",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    href: "/user/guaranty",
    label: "گارانتی‌های من",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    href: "/user/tickets",
    label: "پیام‌ها و اعلان‌ها",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  
  { href: "/user/club", label: "باشگاه مشتریان" },  

];

const settingsItems = [
  { href: "/user/settings/profile", label: "ویرایش اطلاعات کاربری" },
  { href: "/user/settings/password", label: "تغییر رمز عبور" },
  { href: "/user/settings/addresses", label: "آدرس‌های من" },
];

export default function UserSidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/user/settings"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const SidebarContent = () => (
    <div className="space-y-6">
      {}
      <div className="relative overflow-hidden bg-white/40 dark:bg-gray-950/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-none">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl" />

        {}
        <div className="relative flex flex-col items-center text-center pb-6 mb-6 border-b border-gray-200/30 dark:border-white/5">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-primary-500/20 to-primary-500/5 p-1 backdrop-blur-md border border-white/50">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={fullName} className="w-full h-full rounded-[1.8rem] object-cover" />
              ) : (
                <div className="w-full h-full rounded-[1.8rem] bg-primary-500/20 flex items-center justify-center text-primary-600 text-2xl font-black">
                  {fullName.charAt(0)}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 border-4 border-white/80 dark:border-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">{fullName}</h3>
          <span className="inline-flex items-center px-3 py-1 mt-2 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-black">
            {user.role === "ADMIN" ? "مدیر سیستم" : "کاربر فروشگاه"}
          </span>
        </div>

        {}
        <nav className="space-y-1.5 relative">
          {menuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group ${
                  active
                    ? "bg-primary-500 text-white shadow-xl shadow-primary-500/30"
                    : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-primary-500"
                }`}>
                <span className={active ? "opacity-90" : "group-hover:scale-110 transition-transform"}>
                  {item.icon}
                </span>
                <span className="text-xs font-black">{item.label}</span>
              </Link>
            );
          })}

          {}
          <div>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-gray-600 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5 transition-all group border border-transparent hover:border-white/50 dark:hover:border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500/10 group-hover:text-primary-500 transition-all">
                  <svg className={`w-5 h-5 transition-transform duration-500 ${settingsOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-xs font-black">تنظیمات حساب</span>
              </div>
              <svg className={`w-4 h-4 opacity-50 transition-transform duration-300 ${settingsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="flex flex-col mt-1 mr-6 border-r-2 border-primary-500/20 pr-4 space-y-0.5">
                {settingsItems.map(item => (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`py-3 text-[11px] font-bold flex items-center gap-2 transition-all group/item ${
                      pathname === item.href
                        ? "text-primary-500 dark:text-primary-400"
                        : "text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400"
                    }`}>
                    <span className={`w-1 h-1 rounded-full transition-all ${pathname === item.href ? "bg-primary-500 scale-150" : "bg-gray-300 group-hover/item:bg-primary-500"}`} />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {}
          <div className="pt-3 mt-2 border-t border-gray-200/30 dark:border-white/5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-secondary-500 hover:bg-red-500/10 transition-all group"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs font-black">خروج از حساب</span>
            </button>
          </div>
        </nav>
      </div>

      {}
      <div className="p-6 rounded-[2.5rem] bg-white/10 dark:bg-primary-500/5 backdrop-blur-2xl border border-white/40 dark:border-white/10 relative overflow-hidden group shadow-[0_20px_40px_rgba(0,0,0,0.05)]">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl group-hover:bg-primary-500/30 transition-all duration-700" />
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-primary-500/20 backdrop-blur-lg border border-primary-500/30 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
            <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h4 className="text-gray-900 dark:text-white text-[14px] font-black mb-1">مرکز پشتیبانی</h4>
          <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold mb-5 leading-5">سوالی دارید؟ تیم ما آماده پاسخگویی است.</p>
          <Link href="/user/tickets/new"
            className="block w-full py-3.5 bg-primary-500 text-white dark:bg-primary-500/20 dark:text-primary-400 dark:border dark:border-primary-500/30 rounded-2xl text-[11px] font-black text-center transition-all active:scale-95 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40">
            گفتگوی آنلاین
          </Link>
        </div>
        <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-primary-400/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-80 flex-shrink-0">
        <div className="sticky top-10">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile button */}
      <div className="fixed bottom-28 right-6 z-[95] lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center w-14 h-14 bg-white/40 dark:bg-white/[0.05] backdrop-blur-2xl text-primary-600 rounded-2xl shadow-xl border border-white/60 dark:border-white/10 active:scale-90 transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
          </svg>
        </button>
      </div>

      {/* Mobile offcanvas */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[150] lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-[85%] max-w-[380px] bg-white/30 dark:bg-black/40 backdrop-blur-[30px] border-l border-white/40 dark:border-white/10 shadow-2xl flex flex-col">
            <div className="p-6 flex items-center justify-between border-b border-white/40 dark:border-white/5 bg-white/20 dark:bg-white/[0.02]">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">پنل کاربری</h2>
              <button onClick={() => setMobileOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-300 border border-white/60 dark:border-white/10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
