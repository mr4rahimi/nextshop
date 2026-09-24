import { Suspense } from "react";
import InvoicePrint from "@/components/admin/accounting/invoices/InvoicePrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "چاپ فاکتور" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <InvoicePrint id={id} />
    </Suspense>
  );
}
