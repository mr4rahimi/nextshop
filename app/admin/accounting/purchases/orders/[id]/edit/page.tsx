import { Suspense } from "react";
import PurchaseOrderEditor from "@/components/admin/accounting/purchases/PurchaseOrderEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "ویرایش سفارش خرید" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PurchaseOrderEditor id={id} />
    </Suspense>
  );
}
