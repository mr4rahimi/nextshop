import { Suspense } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import CallsClient from "@/components/admin/worklist/CallsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "تماس‌ها" };

export default function CallsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">تماس‌ها</h1>
          <HelpButton topic="calls" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          تماس‌های ورودی و خروجی. نتیجه‌ی هر تماس را ثبت کنید تا در گزارش بیاید.
        </p>
      </div>
      {/* `useSearchParams` داخل کلاینت مرز Suspense می‌خواهد */}
      <Suspense fallback={<p className="text-xs text-gray-500">در حال بارگذاری...</p>}>
        <CallsClient />
      </Suspense>
    </div>
  );
}
