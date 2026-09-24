import TrialBalanceReport from "@/components/admin/accounting/reports/TrialBalanceReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "تراز آزمایشی" };

export default function Page() {
  return <TrialBalanceReport />;
}
