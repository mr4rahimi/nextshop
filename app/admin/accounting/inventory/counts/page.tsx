import { Suspense } from "react";
import CountsClient from "@/components/admin/accounting/inventory/CountsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "انبارگردانی" };

export default function Page() {
  return (
    <Suspense>
      <CountsClient />
    </Suspense>
  );
}
