import CountSheetClient from "@/components/admin/accounting/inventory/CountSheetClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "برگه‌ی انبارگردانی" };

export default async function CountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CountSheetClient id={id} />;
}
