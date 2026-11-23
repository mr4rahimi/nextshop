import { Suspense } from "react";
import { PreBillPrint } from "@/components/admin/accounting/pos/PosPrints";

export const dynamic = "force-dynamic";
export const metadata = { title: "پیش‌فاکتور صندوق" };

export default async function Page({ params }: { params: Promise<{ terminalId: string }> }) {
  const { terminalId } = await params;
  return (
    <Suspense>
      <PreBillPrint terminalId={terminalId} />
    </Suspense>
  );
}
