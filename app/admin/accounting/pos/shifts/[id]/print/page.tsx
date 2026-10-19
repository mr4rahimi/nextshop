import { Suspense } from "react";
import { ShiftPrint } from "@/components/admin/accounting/pos/PosPrints";

export const dynamic = "force-dynamic";
export const metadata = { title: "گزارش بستن صندوق" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ShiftPrint id={id} />
    </Suspense>
  );
}
