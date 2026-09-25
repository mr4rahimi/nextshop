import { Suspense } from "react";
import LinkCampaignDetail from "@/components/admin/marketing/LinkCampaignDetail";

export const dynamic = "force-dynamic";

export const metadata = { title: "کمپین لینک‌سازی" };

export default async function LinkCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="text-xs text-gray-500">در حال بارگذاری...</p>}>
      <LinkCampaignDetail campaignId={id} />
    </Suspense>
  );
}
