import { Suspense } from "react";
import PurchaseOrderPrint from "@/components/admin/accounting/purchases/PurchaseOrderPrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "چاپ سفارش خرید" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PurchaseOrderPrint id={id} />
    </Suspense>
  );
}
