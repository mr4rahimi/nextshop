import { Suspense } from "react";
import SerialsClient from "@/components/admin/accounting/inventory/SerialsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "شماره سریال" };

export default function Page() {
  return (
    <Suspense>
      <SerialsClient />
    </Suspense>
  );
}
