import { Suspense } from "react";
import InvoicePrint from "@/components/admin/accounting/invoices/InvoicePrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "چاپ گروهی فاکتورها" };

/** چاپ گروهی — `?ids=a,b,c&tpl=shop&back=/admin/accounting/sales` (فاز ۱۰) */
export default async function Page({ searchParams }: { searchParams: Promise<{ ids?: string; back?: string }> }) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").filter((x) => /^[a-z0-9]{10,40}$/i.test(x)).slice(0, 200);
  const back = sp.back?.startsWith("/admin/accounting/") ? sp.back : "/admin/accounting/sales";
  return (
    <Suspense>
      <InvoicePrint ids={ids} back={{ href: back, label: "بازگشت" }} />
    </Suspense>
  );
}
