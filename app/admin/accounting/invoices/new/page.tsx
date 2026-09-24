import InvoiceEditor from "@/components/admin/accounting/invoices/InvoiceEditor";
import type { InvoiceTypeKey } from "@/lib/accounting/invoices/calc";

export const dynamic = "force-dynamic";
export const metadata = { title: "فاکتور تازه" };

const TYPES: InvoiceTypeKey[] = ["SALES", "PURCHASE", "PROFORMA", "SALES_RETURN", "PURCHASE_RETURN"];

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string; ref?: string }> }) {
  const sp = await searchParams;
  const type = TYPES.includes(sp.type as InvoiceTypeKey) ? (sp.type as InvoiceTypeKey) : "SALES";
  return <InvoiceEditor key={`${type}:${sp.ref ?? ""}`} type={type} refId={sp.ref} />;
}
