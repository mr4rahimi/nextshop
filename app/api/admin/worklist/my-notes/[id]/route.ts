import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { deleteMyNote, parseNoteInput, updateMyNote } from "@/lib/worklist/staff-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ویرایش و حذف یادداشت شخصی.
 *
 * یادداشتِ کسِ دیگر ۴۰۴ می‌گیرد نه ۴۰۳، تا حتی وجودش هم لو نرود.
 */
export async function PATCH(req: Request, { params }: Params) {
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

  const { id } = await params;
  const note = await updateMyNote(access.userId, id, parsed.data);
  if (!note) return NextResponse.json({ error: "یادداشت پیدا نشد" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(_req: Request, { params }: Params) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteMyNote(access.userId, id);
  if (!ok) return NextResponse.json({ error: "یادداشت پیدا نشد" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
