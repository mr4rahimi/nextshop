import { Suspense } from "react";
import PurchaseOrderDetail from "@/components/admin/accounting/purchases/PurchaseOrderDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "سفارش خرید" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PurchaseOrderDetail id={id} />
    </Suspense>
  );
}
