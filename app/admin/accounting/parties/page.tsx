import { Suspense } from "react";
import PartiesClient from "@/components/admin/accounting/PartiesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "اشخاص — حسابداری" };

export default function PartiesPage() {
  return (
    <Suspense>
      <PartiesClient />
    </Suspense>
  );
}
