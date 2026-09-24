import { Suspense } from "react";
import ExpenseForm from "@/components/admin/accounting/cash/ExpenseForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ثبت هزینه" };

export default function Page() {
  return (
    <Suspense>
      <ExpenseForm />
    </Suspense>
  );
}
