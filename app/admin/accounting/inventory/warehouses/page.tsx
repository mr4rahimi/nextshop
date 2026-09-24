import { Suspense } from "react";
import WarehousesClient from "@/components/admin/accounting/inventory/WarehousesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "انبارها" };

export default function Page() {
  return (
    <Suspense>
      <WarehousesClient />
    </Suspense>
  );
}
