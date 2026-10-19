import { Suspense } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import WorklistClient from "@/components/admin/worklist/WorklistClient";
import { MyScoreMini } from "@/components/admin/worklist/ScoreClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "کارهای من" };

export default function MyWorklistPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">کارهای من</h1>
          <HelpButton topic="myWork" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          کارهای امروز، عقب‌افتاده و پیش رو. نتیجه را همین‌جا ثبت کنید تا کار بسته شود.
        </p>
      </div>
      {/* امتیاز این ماه — خودش پنهان می‌شود اگر امتیاز خاموش است یا کارمند گروه ندارد */}
      <MyScoreMini />
      {/* `useSearchParams` داخل کلاینت مرز Suspense می‌خواهد */}
      <Suspense fallback={<p className="text-xs text-gray-500">در حال بارگذاری...</p>}>
        <WorklistClient scope="me" />
      </Suspense>
    </div>
  );
}
