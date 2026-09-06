import { withPanel, readJson, requireString } from "@/lib/club/sms/route-helpers";
import { SmsApiError } from "@/lib/club/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** تخمین هزینه پیش از ارسال — تا ادمین بعد از خرج شدن اعتبار غافلگیر نشود */
export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);
    const count = Number(body.receiverCount);

    if (!Number.isFinite(count) || count <= 0) {
      throw new SmsApiError("VALIDATION", "تعداد گیرنده نامعتبر است");
    }

    return panel.estimateCost(
      requireString(body, "lineNumber", "خط ارسال"),
      requireString(body, "text", "متن پیامک"),
      Math.floor(count)
    );
  });
}
