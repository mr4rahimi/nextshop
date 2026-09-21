import { Suspense } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import SeoTasksClient from "@/components/admin/marketing/SeoTasksClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "کارهای سئو" };

export default function SeoTasksPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">کارهای سئو</h1>
          <HelpButton topic="seoTasks" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          سایت‌مپ، ایندکس، لینک داخلی، ریدایرکت، اسکیما و سرعت. گزارش انجام اجباری است و
          آدرس صفحه‌ها همان چیزی است که بعداً اثر کار را قابل سنجش می‌کند.
        </p>
      </div>
      {/* `useSearchParams` داخل کلاینت مرز Suspense می‌خواهد */}
      <Suspense fallback={<p className="text-xs text-gray-500">در حال بارگذاری...</p>}>
        <SeoTasksClient />
      </Suspense>
    </div>
  );
}
