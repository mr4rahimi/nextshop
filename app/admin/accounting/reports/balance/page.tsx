import BalanceSheetReport from "@/components/admin/accounting/reports/BalanceSheetReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "ترازنامه" };

export default function Page() {
  return <BalanceSheetReport />;
}
