import ProductProfitReport from "@/components/admin/accounting/reports/ProductProfitReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "سود کالا و کانال" };

export default function Page() {
  return <ProductProfitReport />;
}
