import { Suspense } from "react";
import TransfersClient from "@/components/admin/accounting/inventory/TransfersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "حواله‌های انتقال" };

export default function Page() {
  return (
    <Suspense>
      <TransfersClient />
    </Suspense>
  );
}
