import OrgDetail from "@/components/admin/accounting/org-installments/OrgDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "اقساط سازمانی" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrgDetail id={id} />;
}
