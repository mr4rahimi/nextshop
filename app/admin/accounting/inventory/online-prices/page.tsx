import OnlinePricesClient from "@/components/admin/accounting/inventory/OnlinePricesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "قیمت آنلاین" };

export default function Page() {
  return <OnlinePricesClient />;
}
