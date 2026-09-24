import KardexClient from "@/components/admin/accounting/inventory/KardexClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "کاردکس کالا" };

export default async function KardexPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <KardexClient productId={productId} />;
}
