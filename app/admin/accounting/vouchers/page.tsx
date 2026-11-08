import VouchersClient from "@/components/admin/accounting/VouchersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "اسناد حسابداری" };

export default async function VouchersPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  return <VouchersClient templateId={template} />;
}
