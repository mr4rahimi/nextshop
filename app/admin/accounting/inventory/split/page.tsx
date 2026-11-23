import { Suspense } from "react";
import SplitClient from "@/components/admin/accounting/inventory/SplitClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "تفکیک خرید" };

export default function Page() {
  return (
    <Suspense>
      <SplitClient />
    </Suspense>
  );
}
