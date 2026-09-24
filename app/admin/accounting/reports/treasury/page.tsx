import TreasuryFlowReport from "@/components/admin/accounting/reports/TreasuryFlowReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "گردش صندوق و بانک" };

export default function Page() {
  return <TreasuryFlowReport />;
}
