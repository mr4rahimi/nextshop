import { Suspense } from "react";
import StorePricesClient from "@/components/admin/accounting/inventory/StorePricesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "قیمت فروشگاه" };

export default function Page() {
  return (
    <Suspense>
      <StorePricesClient />
    </Suspense>
  );
}
