import InvoiceEditor from "@/components/admin/accounting/invoices/InvoiceEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "ویرایش فاکتور" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceEditor id={id} />;
}
