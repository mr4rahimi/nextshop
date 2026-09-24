import HelpButton from "@/components/admin/worklist/HelpButton";
import AccEventsClient from "@/components/admin/accounting/AccEventsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "رویدادهای مالی" };

/** صف رویداد مالی — docs/plans/accounting.md بخش ۴.۲ */
export default async function AccEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">رویدادهای مالی</h1>
          <HelpButton topic="accountingEvents" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          هر فروش، دریافت یا خریدی که باید در حسابداری ثبت شود، اینجا یک ردیف دارد.
        </p>
      </div>
      <AccEventsClient initialStatus={sp.status} />
    </div>
  );
}
