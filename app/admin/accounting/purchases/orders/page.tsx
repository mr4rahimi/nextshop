import { Suspense } from "react";
import PurchaseOrdersList from "@/components/admin/accounting/purchases/PurchaseOrdersList";

export const dynamic = "force-dynamic";
export const metadata = { title: "سفارش خرید" };

export default function Page() {
  return (
    <Suspense>
      <PurchaseOrdersList />
    </Suspense>
  );
}
