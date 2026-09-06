import { withPanel, intParam } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** فهرست درخواست‌های ارسال پنل — صفحه‌به‌صفحه، بدون کش */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return withPanel((panel) =>
    panel.getSendRequests(intParam(url, "page", 1), intParam(url, "limit", 20))
  );
}
