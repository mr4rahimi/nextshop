"use client";

/** فهرست گزارش‌های مالی — docs/plans/accounting.md بخش ۱۱ */

import Link from "next/link";
import { useAccess } from "../access";
import { PageHeader, SectionTitle } from "../ui";

interface Item {
  href: string;
  icon: string;
  title: string;
  desc: string;
  /** همه‌ی این مجوزها لازم است */
  perm: string[];
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "صورت‌های مالی",
    items: [
      { href: "/admin/accounting/reports/pl", icon: "📈", title: "سود و زیان", desc: "فروش، بهای تمام‌شده، هزینه‌ها و سود خالص؛ مقایسه با دوره‌ی قبل", perm: ["ACC_REPORTS", "ACC_COST_VIEW"] },
      { href: "/admin/accounting/reports/balance", icon: "⚖️", title: "ترازنامه", desc: "دارایی‌ها، بدهی‌ها و سرمایه در یک تاریخ", perm: ["ACC_REPORTS", "ACC_COST_VIEW"] },
      { href: "/admin/accounting/reports/trial", icon: "🧮", title: "تراز آزمایشی", desc: "دو، چهار و شش ستونی؛ گروه، کل، معین یا تفصیلی", perm: ["ACC_REPORTS", "ACC_COST_VIEW"] },
    ],
  },
  {
    title: "فروش و سود",
    items: [
      { href: "/admin/accounting/reports/profit", icon: "🏷️", title: "سود هر کالا، دسته و کانال", desc: "فروش، بهای تمام‌شده و درصد سود؛ سایت، تلفنی و بازارگاه‌ها", perm: ["ACC_REPORTS", "ACC_COST_VIEW"] },
      { href: "/admin/accounting/reports/aging", icon: "⏳", title: "سنی بدهی", desc: "طلب از مشتریان به تفکیک عمر: ۳۰، ۶۰، ۹۰ و بیشتر از ۹۰ روز", perm: ["ACC_REPORTS"] },
      { href: "/admin/accounting/reports/vat", icon: "🧾", title: "ارزش افزوده (فصلی)", desc: "مالیات فروش منهای مالیات خرید، با فهرست فاکتورهای مشمول", perm: ["ACC_REPORTS"] },
    ],
  },
  {
    title: "پول و کالا",
    items: [
      { href: "/admin/accounting/reports/expenses", icon: "💸", title: "هزینه‌ها", desc: "به تفکیک سرفصل با نمودار و مقایسه با دوره‌ی قبل", perm: ["ACC_REPORTS"] },
      { href: "/admin/accounting/reports/treasury", icon: "🏦", title: "گردش صندوق و بانک", desc: "موجودی ابتدا، ورود، خروج و موجودی پایان هر حساب", perm: ["ACC_REPORTS"] },
      { href: "/admin/accounting/reports/inventory", icon: "📦", title: "ارزش موجودی کالا", desc: "به تفکیک دسته، کالا یا انبار؛ تطبیق با دفتر", perm: ["ACC_REPORTS", "ACC_COST_VIEW"] },
    ],
  },
  {
    title: "گردش‌ها (در بخش خودشان)",
    items: [
      { href: "/admin/accounting/parties", icon: "👥", title: "صورت‌حساب اشخاص", desc: "گردش و مانده‌ی هر شخص — از صفحه‌ی همان شخص", perm: ["ACC_VIEW"] },
      { href: "/admin/accounting/accounts", icon: "📒", title: "دفتر کل و معین", desc: "گردش هر حساب با مانده‌ی جاری — از سرفصل حساب‌ها", perm: ["ACC_VIEW"] },
      { href: "/admin/accounting/cheques", icon: "🧾", title: "گزارش چک‌ها", desc: "بر اساس وضعیت و سررسید", perm: ["ACC_VIEW"] },
      { href: "/admin/accounting/inventory", icon: "📦", title: "کاردکس کالا", desc: "ورود، خروج و مانده با بها — از کالا و انبار", perm: ["ACC_VIEW"] },
    ],
  },
];

export default function ReportsHub() {
  const { can, ready } = useAccess();
  return (
    <div className="space-y-6">
      <PageHeader title="گزارش‌ها" help="accountingReports" desc="همه‌ی عددها از همان اسناد حسابداری جمع زده می‌شوند؛ دو گزارش هیچ‌وقت با هم تناقض ندارند." />
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !ready || i.perm.every((p) => can([p])));
        if (!items.length) return null;
        return (
          <section key={g.title}>
            <SectionTitle title={g.title} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 hover:border-blue-400 transition flex gap-3"
                >
                  <span className="text-2xl">{i.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-gray-900 dark:text-white">{i.title}</span>
                    <span className="block text-[11px] text-gray-500 leading-5 mt-0.5">{i.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
