import { NextResponse } from "next/server";
import { clearAuthCookie, getAuthUser } from "@/lib/auth";
import { endWorkSession } from "@/lib/worklist/attendance";

export const runtime = "nodejs";

export async function POST() {
  // ⚠️ کاربر باید **قبل از** پاک‌کردن کوکی خوانده شود، وگرنه نشست حضور بی‌صاحب
  // می‌ماند و فقط با timeout بسته می‌شود — یعنی تا پانزده دقیقه حاضر حساب می‌شود.
  const user = await getAuthUser().catch(() => null);

  if (user && (user.role === "ADMIN" || user.role === "SELLER")) {
    await endWorkSession(user.id, "LOGOUT");
  }

  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
