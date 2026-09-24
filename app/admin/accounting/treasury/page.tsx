import { Suspense } from "react";
import TreasuryClient from "@/components/admin/accounting/TreasuryClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "صندوق و بانک — حسابداری" };

export default function TreasuryPage() {
  return (
    <Suspense>
      <TreasuryClient />
    </Suspense>
  );
}
