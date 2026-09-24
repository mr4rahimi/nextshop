import MoneyDetail from "@/components/admin/accounting/cash/MoneyDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "دریافت و پرداخت" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MoneyDetail id={id} />;
}
