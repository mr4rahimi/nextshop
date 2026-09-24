import InventoryValueReport from "@/components/admin/accounting/reports/InventoryValueReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "ارزش موجودی کالا" };

export default function Page() {
  return <InventoryValueReport />;
}
