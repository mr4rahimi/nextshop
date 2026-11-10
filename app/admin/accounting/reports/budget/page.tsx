import BudgetReport from "@/components/admin/accounting/reports/BudgetReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "بودجه در برابر عملکرد" };

export default function Page() {
  return <BudgetReport />;
}
