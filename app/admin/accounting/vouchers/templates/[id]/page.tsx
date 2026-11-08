import TemplateEditor from "@/components/admin/accounting/templates/TemplateEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "ویرایش ورودی سریع" };

export default async function EditVoucherTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateEditor id={id} />;
}
