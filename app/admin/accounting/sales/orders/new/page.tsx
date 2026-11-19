import { Suspense } from "react";
import PurchaseOrderEditor from "@/components/admin/accounting/purchases/PurchaseOrderEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "سفارش فروش تازه" };

export default function Page() {
  return (
    <Suspense>
      <PurchaseOrderEditor kind="SALES" />
    </Suspense>
  );
}
