import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "صفحه یافت نشد",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#050505] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-black text-primary-500 mb-4 select-none">۴۰۴</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          صفحه‌ای که دنبالش بودید پیدا نشد
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
          آدرس اشتباه است یا این صفحه حذف شده. می‌توانید به صفحه اصلی برگردید یا محصول موردنظر را جستجو کنید.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 rounded-2xl bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 transition-colors"
          >
            برگشت به خانه
          </Link>
          <Link
            href="/products"
            className="px-6 py-3 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            همه محصولات
          </Link>
        </div>
      </div>
    </div>
  );
}
