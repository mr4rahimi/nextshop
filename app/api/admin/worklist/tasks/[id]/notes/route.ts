import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { addNote, listNotes } from "@/lib/worklist/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  return NextResponse.json(serialize({ notes: await listNotes(id) }));
}

/**
 * ثبت یادداشت.
 *
 * مجوزش `WORK_EDIT_OWN` است نه `WORK_EDIT_ALL`: هرکس می‌تواند روی هر کاری
 * یادداشت بگذارد. خیلی وقت‌ها یکی کار را انجام می‌دهد و دیگری مستندش می‌کند،
 * و بستن این راه یعنی مستندسازی اصلاً انجام نمی‌شود.
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission(["WORK_EDIT_OWN", "WORK_EDIT_ALL", "CALL_LOG"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const exists = await prisma.staffTask.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });

  try {
    const { body } = await req.json();
    const note = await addNote(id, String(body ?? ""), guard.access);
    return NextResponse.json(
      serialize({ note, canEditAll: can(guard.access, "WORK_EDIT_ALL") }),
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
