import { Suspense } from "react";
import WorklistClient from "@/components/admin/worklist/WorklistClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "همه‌ی کارها" };

export default function AllTasksPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">همه‌ی کارها</h1>
        <p className="text-xs text-gray-500 mt-1">
          کارهای همه‌ی اعضای تیم. اگر دسترسی دیدن کار همه را نداشته باشید، فقط
          کارهای خودتان نشان داده می‌شود.
        </p>
      </div>
      {/* `useSearchParams` داخل کلاینت مرز Suspense می‌خواهد */}
      <Suspense fallback={<p className="text-xs text-gray-500">در حال بارگذاری...</p>}>
        <WorklistClient scope="all" />
      </Suspense>
    </div>
  );
}
