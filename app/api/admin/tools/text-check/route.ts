import { NextResponse } from "next/server";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";
import { ToolError } from "@/lib/tools/common";
import { findSiteDuplicates } from "@/lib/tools/text-duplicates";
import { MAX_CHARS, MIN_WORDS } from "@/lib/tools/text-similarity";
import { tokenize } from "@/lib/tools/text-stats";

export const runtime = "nodejs";

/** درصد تکراری بودن متن در محتوای خود سایت — docs/features/tools.md بخش ۵ */
export async function POST(req: Request) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  try {
    const body = await readJson(req);
    const text = typeof body.text === "string" ? body.text : "";
    if (text.length > MAX_CHARS) throw new ToolError("متن بیش از ۱۰۰ هزار کاراکتر است");
    if (tokenize(text).length < MIN_WORDS) throw new ToolError("برای بررسی دست‌کم ۱۵ کلمه لازم است");
    return NextResponse.json(await findSiteDuplicates(text));
  } catch (e) {
    return toolsError(e);
  }
}
