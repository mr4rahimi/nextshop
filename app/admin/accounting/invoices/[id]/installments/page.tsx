import PlanEditor from "@/components/admin/accounting/installments/PlanEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "فروش اقساطی" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanEditor invoiceId={id} />;
}
