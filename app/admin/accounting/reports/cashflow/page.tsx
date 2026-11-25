import CashFlowReport from "@/components/admin/accounting/reports/CashFlowReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "صورت جریان وجوه نقد" };

export default function Page() {
  return <CashFlowReport />;
}
