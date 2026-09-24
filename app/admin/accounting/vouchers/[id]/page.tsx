import VoucherDetailClient from "@/components/admin/accounting/VoucherDetailClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "سند حسابداری" };

export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VoucherDetailClient id={id} />;
}
