import { Suspense } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import LinksClient from "@/components/admin/marketing/LinksClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "لینک‌سازی" };

export default function LinksPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">لینک‌سازی</h1>
          <HelpButton topic="linkBuilding" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          چارت لینک‌سازی هم برنامه است هم گزارش پیشرفت: مدیر یک‌بار می‌کشد، کارها از رویش ساخته
          می‌شوند و همان چارت با رنگ نشان می‌دهد چه چیزی اجرا شده.
        </p>
      </div>
      {/* `useSearchParams` داخل کلاینت مرز Suspense می‌خواهد */}
      <Suspense fallback={<p className="text-xs text-gray-500">در حال بارگذاری...</p>}>
        <LinksClient />
      </Suspense>
    </div>
  );
}
