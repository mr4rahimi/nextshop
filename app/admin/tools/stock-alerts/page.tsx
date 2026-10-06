import StockAlertsClient from "@/components/admin/tools/StockAlertsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "موجود شد خبرم کن" };

/** «موجود شد خبرم کن» — docs/features/tools.md بخش ۷ */
export default function ToolsStockAlertsPage() {
  return <StockAlertsClient />;
}
