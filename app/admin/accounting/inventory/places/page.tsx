import { Suspense } from "react";
import PlacesClient from "@/components/admin/accounting/inventory/PlacesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "مکان کالا" };

export default function Page() {
  return (
    <Suspense>
      <PlacesClient />
    </Suspense>
  );
}
