import ChequeDetail from "@/components/admin/accounting/cash/ChequeDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "چک" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChequeDetail id={id} />;
}
