import { Suspense } from "react";
import ExpensesList from "@/components/admin/accounting/cash/ExpensesList";

export const dynamic = "force-dynamic";
export const metadata = { title: "هزینه‌ها" };

export default function Page() {
  return (
    <Suspense>
      <ExpensesList />
    </Suspense>
  );
}
