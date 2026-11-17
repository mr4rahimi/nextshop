import SalesAnalysisReport from "@/components/admin/accounting/reports/SalesAnalysisReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "تحلیل فروش کالا" };

/** `?by=&partyId=&from=&to=` — لینک «تحلیل خرید» از گزارش مشتریان (webhesab-parity.md بخش ۲۵) */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <SalesAnalysisReport initial={{ by: sp.by, partyId: sp.partyId, from: sp.from, to: sp.to }} />;
}
