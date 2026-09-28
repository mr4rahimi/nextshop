import TrendReport from "@/components/admin/accounting/reports/TrendReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "روند ماهانه" };

export default function Page() {
  return <TrendReport />;
}
