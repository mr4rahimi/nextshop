import YearClosingClient from "@/components/admin/accounting/YearClosingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "بستن سال مالی" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <YearClosingClient yearId={id} />;
}
