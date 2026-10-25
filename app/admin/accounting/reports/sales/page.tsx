import SalesAnalysisReport from "@/components/admin/accounting/reports/SalesAnalysisReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "تحلیل فروش کالا" };

export default function Page() {
  return <SalesAnalysisReport />;
}
