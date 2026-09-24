import AccEventsClient from "@/components/admin/accounting/AccEventsClient";
import { PageHeader } from "@/components/admin/accounting/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "رویدادهای مالی" };

/** صف رویداد مالی — docs/plans/accounting.md بخش ۴.۲ */
export default async function AccEventsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  return (
    <div>
      <PageHeader
        title="رویدادهای مالی"
        help="accountingEvents"
        desc="هر فروش، دریافت یا خریدی که باید در حسابداری ثبت شود، اینجا یک ردیف دارد."
      />
      <AccEventsClient initialStatus={sp.status} />
    </div>
  );
}
