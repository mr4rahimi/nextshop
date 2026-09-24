import { Suspense } from "react";
import InventoryClient from "@/components/admin/accounting/inventory/InventoryClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "موجودی کالا" };

export default function Page() {
  return (
    <Suspense>
      <InventoryClient />
    </Suspense>
  );
}
