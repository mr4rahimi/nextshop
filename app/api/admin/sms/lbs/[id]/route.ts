import { withPanel } from "@/lib/club/sms/route-helpers";
import { SmsApiError } from "@/lib/club/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** لغو یک درخواست موقعیت‌محور */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lbsId = Number(id);

  return withPanel(async (panel) => {
    if (!Number.isFinite(lbsId) || lbsId <= 0) {
      throw new SmsApiError("VALIDATION", "شناسه درخواست نامعتبر است");
    }
    await panel.cancelLbs(lbsId);
    return { success: true };
  });
}
