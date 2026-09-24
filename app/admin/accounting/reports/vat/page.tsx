import VatReport from "@/components/admin/accounting/reports/VatReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "ارزش افزوده" };

export default function Page() {
  return <VatReport />;
}
