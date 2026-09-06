import { withPanel, readJson, intParam, requireString } from "@/lib/club/sms/route-helpers";
import { SmsApiError } from "@/lib/club/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withPanel((panel) =>
    panel.getNumberBanks(intParam(url, "page", 1), intParam(url, "limit", 30))
  );
}

/** ارسال به بانک شماره — گیرنده‌ها را خود پنل از بانک انتخاب می‌کند */
export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);

    const targets = (Array.isArray(body.targets) ? body.targets : []).flatMap((t) => {
      const r = t as Record<string, unknown>;
      const bankId = Number(r?.bankId);
      if (!Number.isFinite(bankId) || bankId <= 0) return [];
      return [
        {
          bankId,
          offset: Number(r.offset) || 0,
          limit: Number(r.limit) || 100,
        },
      ];
    });

    if (targets.length === 0) {
      throw new SmsApiError("VALIDATION", "هیچ بانک شماره‌ای انتخاب نشده است");
    }

    return panel.sendToNumberBank(
      requireString(body, "lineNumber", "خط ارسال"),
      requireString(body, "text", "متن پیامک"),
      targets
    );
  });
}
