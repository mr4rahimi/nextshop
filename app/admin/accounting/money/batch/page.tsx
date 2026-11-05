import { Suspense } from "react";
import MoneyBatch from "@/components/admin/accounting/cash/MoneyBatch";

export const dynamic = "force-dynamic";
export const metadata = { title: "دریافت و پرداخت گروهی" };

export default function Page() {
  return (
    <Suspense>
      <MoneyBatch />
    </Suspense>
  );
}
