import AdjustmentDetail from "@/components/admin/accounting/inventory/AdjustmentDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "سند ورود/خروج کالا" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdjustmentDetail id={id} />;
}
