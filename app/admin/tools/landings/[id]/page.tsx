import LandingEditor from "@/components/admin/tools/LandingEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "ویرایش لندینگ" };

/** ویرایشگر لندینگ — docs/features/tools.md بخش ۳ */
export default async function ToolsLandingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LandingEditor id={id} />;
}
