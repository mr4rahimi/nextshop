import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { createMyNote, listMyNotes, parseNoteInput } from "@/lib/worklist/staff-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * یادداشت‌های شخصی کاربر جاری.
 *
 * مجوز خاصی نمی‌خواهد: هر کارمندی که وارد پنل شده دفترچه‌ی خودش را دارد.
 * `userId` هیچ‌وقت از ورودی خوانده نمی‌شود — همیشه از نشست.
 */
export async function GET(req: Request) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });

  const archived = new URL(req.url).searchParams.get("archived") === "1";
  const notes = await listMyNotes(access.userId, archived);
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه‌ی نامعتبر" }, { status: 400 });
  }

  const parsed = parseNoteInput(raw);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.data.title && !parsed.data.body?.trim()) {
    return NextResponse.json({ error: "یادداشت خالی است" }, { status: 400 });
  }

  const note = await createMyNote(access.userId, parsed.data);
  return NextResponse.json({ note }, { status: 201 });
}
