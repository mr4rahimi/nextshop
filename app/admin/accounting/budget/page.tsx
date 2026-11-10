import BudgetEditor from "@/components/admin/accounting/budget/BudgetEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "تنظیم بودجه" };

export default function Page() {
  return <BudgetEditor />;
}
