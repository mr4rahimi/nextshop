import HelpButton from "@/components/admin/worklist/HelpButton";
import CreditClient from "@/components/admin/worklist/CreditClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "موعدهای پرداخت" };

/** موعدهای پرداخت اعتباری — فاز ۱۰، docs/features/staff-worklist.md بخش ۲۴ */
export default async function CreditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">موعدهای پرداخت</h1>
          <HelpButton topic="credit" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          سفارش‌های اعتباری: روز قبل از هر موعد پیامک یادآوری به مشتری می‌رود و روز موعد یک کار پیگیری در کارتابل.
        </p>
      </div>
      <CreditClient initialTab={sp.tab} initialQ={sp.q} />
    </div>
  );
}
