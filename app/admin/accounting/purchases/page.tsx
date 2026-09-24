import { Suspense } from "react";
import InvoicesList from "@/components/admin/accounting/invoices/InvoicesList";

export const dynamic = "force-dynamic";
export const metadata = { title: "خرید" };

export default function Page() {
  return (
    <Suspense>
      <InvoicesList side="purchases" />
    </Suspense>
  );
}
