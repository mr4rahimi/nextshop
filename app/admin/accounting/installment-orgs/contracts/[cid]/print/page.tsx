import { Suspense } from "react";
import ContractPrint from "@/components/admin/accounting/org-installments/ContractPrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "فرم خرید اقساطی" };

export default async function Page({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  return (
    <Suspense>
      <ContractPrint id={cid} />
    </Suspense>
  );
}
