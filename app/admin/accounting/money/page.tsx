import { Suspense } from "react";
import MoneyList from "@/components/admin/accounting/cash/MoneyList";

export const dynamic = "force-dynamic";
export const metadata = { title: "دریافت و پرداخت" };

export default function Page() {
  return (
    <Suspense>
      <MoneyList />
    </Suspense>
  );
}
