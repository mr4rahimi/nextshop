import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getProvider } from "@/lib/club/sms";
import { errorResponse, intParam } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** پیام‌های دریافتی — این پنل webhook ندارد و باید pull شود */
export async function GET(req: Request) {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  try {
    const provider = await getProvider();
    const messages = await provider.getInbox(intParam(url, "page", 1), intParam(url, "limit", 50));
    return NextResponse.json({ messages });
  } catch (err) {
    return errorResponse(err);
  }
}
