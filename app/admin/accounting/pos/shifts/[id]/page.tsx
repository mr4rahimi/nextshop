import ShiftDetail from "@/components/admin/accounting/pos/ShiftDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "شیفت صندوق" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShiftDetail id={id} />;
}
