import PlanPrint from "@/components/admin/accounting/installments/PlanPrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "چاپ جدول اقساط" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanPrint invoiceId={id} />;
}
