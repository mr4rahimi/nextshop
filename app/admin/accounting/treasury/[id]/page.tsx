import TreasuryDetailClient from "@/components/admin/accounting/TreasuryDetailClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "گردش صندوق و بانک" };

export default async function TreasuryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TreasuryDetailClient id={id} />;
}
