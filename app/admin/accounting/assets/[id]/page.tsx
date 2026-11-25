import AssetDetail from "@/components/admin/accounting/assets/AssetDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "دارایی ثابت" };

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetDetail id={id} />;
}
