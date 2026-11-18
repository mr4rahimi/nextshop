import SalesAnalysisReport from "@/components/admin/accounting/reports/SalesAnalysisReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "تحلیل خرید کالا" };

/** `?by=&supplierId=&from=&to=` — گزارش جمعی خرید (webhesab-parity.md بخش ۲۸) */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <SalesAnalysisReport side="purchase" initial={{ by: sp.by, supplierId: sp.supplierId, from: sp.from, to: sp.to }} />;
}
