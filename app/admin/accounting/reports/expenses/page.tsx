import ExpenseReport from "@/components/admin/accounting/reports/ExpenseReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "گزارش هزینه‌ها" };

export default function Page() {
  return <ExpenseReport />;
}
