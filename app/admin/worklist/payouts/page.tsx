import HelpButton from "@/components/admin/worklist/HelpButton";
import PayoutsClient from "@/components/admin/worklist/PayoutsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "پورسانت" };

export default function PayoutsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">پورسانت</h1>
          <HelpButton topic="payouts" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          مانده‌ی تسویه‌نشده از روی خودِ معامله‌ها حساب می‌شود. باز کردن این صفحه چیزی ذخیره نمی‌کند.
        </p>
      </div>
      <PayoutsClient />
    </div>
  );
}
