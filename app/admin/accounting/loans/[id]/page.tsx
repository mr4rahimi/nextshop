import LoanDetail from "@/components/admin/accounting/loans/LoanDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "وام" };

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoanDetail id={id} />;
}
