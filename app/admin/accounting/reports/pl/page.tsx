import ProfitLossReport from "@/components/admin/accounting/reports/ProfitLossReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "سود و زیان" };

export default function Page() {
  return <ProfitLossReport />;
}
