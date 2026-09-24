import { Suspense } from "react";
import OpeningInventoryClient from "@/components/admin/accounting/inventory/OpeningInventoryClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "موجودی کالای اول دوره" };

export default function Page() {
  return (
    <Suspense>
      <OpeningInventoryClient />
    </Suspense>
  );
}
