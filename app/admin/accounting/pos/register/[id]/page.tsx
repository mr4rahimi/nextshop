import PosRegister from "@/components/admin/accounting/pos/PosRegister";

export const dynamic = "force-dynamic";
export const metadata = { title: "صندوق" };

/** صفحه‌ی پیشخوان — تمام‌صفحه، بی‌قاب پنل (app/admin/layout.tsx و AccountingShell) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PosRegister terminalId={id} />;
}
