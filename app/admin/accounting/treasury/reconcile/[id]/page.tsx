import ReconWorkbench from "@/components/admin/accounting/cash/ReconWorkbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "تطبیق بانک" };

export default async function BankReconDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReconWorkbench id={id} />;
}
