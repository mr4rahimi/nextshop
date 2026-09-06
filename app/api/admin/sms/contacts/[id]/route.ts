import { withPanel } from "@/lib/club/sms/route-helpers";
import { SmsApiError } from "@/lib/club/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contactId = Number(id);

  return withPanel(async (panel) => {
    if (!Number.isFinite(contactId) || contactId <= 0) {
      throw new SmsApiError("VALIDATION", "شناسه مخاطب نامعتبر است");
    }
    await panel.deleteContact(contactId);
    return { success: true };
  });
}
