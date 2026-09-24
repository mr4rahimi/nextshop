import HelpButton from "@/components/admin/worklist/HelpButton";
import AccountingHomeClient from "@/components/admin/accounting/AccountingHomeClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "حسابداری" };

/** خانه‌ی حسابداری — docs/plans/accounting.md بخش ۴.۴ و ۱۳ */
export default function AccountingPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">حسابداری</h1>
          <HelpButton topic="accounting" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          انتخاب کنید حساب‌وکتاب کسب‌وکار کجا نگه داشته شود، و وضعیت ثبت رویدادهای مالی را ببینید.
        </p>
      </div>
      <AccountingHomeClient />
    </div>
  );
}
