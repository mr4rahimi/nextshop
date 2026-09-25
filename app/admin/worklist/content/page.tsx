import { Suspense } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import ContentTasksClient from "@/components/admin/marketing/ContentTasksClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "کارهای محتوا" };

export default function ContentTasksPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">کارهای محتوا</h1>
          <HelpButton topic="contentTasks" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          مقاله از بریف تا انتشار در یک مسیر: محتوانویس می‌نویسد، محتواگذار در مجله منتشر می‌کند و
          مدیر تأیید می‌کند. متن همان‌جا ذخیره می‌شود؛ کپی و چسباندن در پنل مجله لازم نیست.
        </p>
      </div>
      <Suspense fallback={<p className="text-xs text-gray-500">در حال بارگذاری...</p>}>
        <ContentTasksClient />
      </Suspense>
    </div>
  );
}
