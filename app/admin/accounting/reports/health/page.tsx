import LedgerHealthReport from "@/components/admin/accounting/reports/LedgerHealthReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "سلامت دفتر" };

export default function Page() {
  return <LedgerHealthReport />;
}
