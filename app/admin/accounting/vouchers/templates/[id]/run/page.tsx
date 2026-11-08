import TemplateRun from "@/components/admin/accounting/templates/TemplateRun";

export const dynamic = "force-dynamic";
export const metadata = { title: "ثبت ورودی سریع" };

export default async function RunVoucherTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateRun id={id} />;
}
