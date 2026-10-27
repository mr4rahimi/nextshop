import PriceCheck from "@/components/admin/accounting/pos/PriceCheck";

export const dynamic = "force-dynamic";
export const metadata = { title: "چک کردن قیمت" };

/** کیوسک قیمت — تمام‌صفحه، بی‌قاب پنل (app/admin/layout.tsx و AccountingShell). `?w=` انبار کیوسک */
export default async function Page({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  return <PriceCheck initialWarehouse={w || null} />;
}
