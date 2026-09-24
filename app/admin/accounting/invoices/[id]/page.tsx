import InvoiceDetail from "@/components/admin/accounting/invoices/InvoiceDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "فاکتور" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
