import { withPanel } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** خطوط در دسترس این حساب — کوتاه و کم‌تغییر، ولی زنده خوانده می‌شود */
export async function GET() {
  return withPanel(async (panel) => ({ lines: await panel.getLines() }));
}
