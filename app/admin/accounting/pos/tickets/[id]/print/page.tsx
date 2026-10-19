import { Suspense } from "react";
import { TicketPrint } from "@/components/admin/accounting/pos/PosPrints";

export const dynamic = "force-dynamic";
export const metadata = { title: "رسید صندوق" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <TicketPrint id={id} />
    </Suspense>
  );
}
