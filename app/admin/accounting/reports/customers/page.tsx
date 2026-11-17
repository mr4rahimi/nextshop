import CustomersReport from "@/components/admin/accounting/reports/CustomersReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "گزارش مشتریان" };

export default function Page() {
  return <CustomersReport />;
}
