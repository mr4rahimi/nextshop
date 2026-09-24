import PartyDetailClient from "@/components/admin/accounting/PartyDetailClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "صورت‌حساب شخص" };

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartyDetailClient id={id} />;
}
