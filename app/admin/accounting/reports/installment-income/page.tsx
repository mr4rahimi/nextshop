import InstallmentIncomeReport from "@/components/admin/accounting/reports/InstallmentIncomeReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "کارمزد اقساط" };

export default function Page() {
  return <InstallmentIncomeReport />;
}
