import { withPanel, readJson, requireString } from "@/lib/club/sms/route-helpers";
import { SmsApiError } from "@/lib/club/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) {
    throw new SmsApiError("VALIDATION", "شناسه دفترچه نامعتبر است");
  }

  return withPanel(async (panel) => {
    const body = await readJson(req);
    const ids = Array.isArray(body.attributeIds)
      ? body.attributeIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : undefined;
    await panel.updatePhonebook(bookId, requireString(body, "title", "نام دفترچه"), ids);
    return { success: true };
  });
}
