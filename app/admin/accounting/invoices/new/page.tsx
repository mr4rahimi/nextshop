import InvoiceEditor from "@/components/admin/accounting/invoices/InvoiceEditor";
import type { InvoiceTypeKey } from "@/lib/accounting/invoices/calc";

export const dynamic = "force-dynamic";
export const metadata = { title: "فاکتور تازه" };

const TYPES: InvoiceTypeKey[] = ["SALES", "PURCHASE", "PROFORMA", "SALES_RETURN", "PURCHASE_RETURN"];

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string; ref?: string; batch?: string }> }) {
  const sp = await searchParams;
  const type = TYPES.includes(sp.type as InvoiceTypeKey) ? (sp.type as InvoiceTypeKey) : "SALES";
  // صدور گروهی فقط فروش، خرید و پیش‌فاکتور — برگشتی مرجع دارد (فاز ۱۰)
  const batch = sp.batch === "1" && !sp.ref && ["SALES", "PURCHASE", "PROFORMA"].includes(type);
  return <InvoiceEditor key={`${type}:${sp.ref ?? ""}:${batch}`} type={type} refId={sp.ref} batch={batch} />;
}
