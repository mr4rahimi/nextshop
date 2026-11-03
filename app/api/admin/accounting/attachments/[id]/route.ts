import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { canEdit, canView, isAttachType, readAttachment, removeAttachment, renameAttachment } from "@/lib/accounting/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function guard(id: string, mode: "view" | "edit") {
  const access = await getStaffAccess();
  if (!access) return { error: NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 }) };
  const a = await prisma.accAttachment.findUnique({ where: { id }, select: { docType: true, deletedAt: true } });
  if (!a || a.deletedAt || !isAttachType(a.docType)) return { error: NextResponse.json({ error: "پیوست پیدا نشد" }, { status: 404 }) };
  const ok = mode === "view" ? canView(access, a.docType) : canEdit(access, a.docType);
  if (!ok) return { error: NextResponse.json({ error: "دسترسی ندارید" }, { status: 403 }) };
  return { access };
}

/** خود فایل — عکس و PDF درون مرورگر، بقیه (و `?download=1`) دانلود */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const g = await guard(id, "view");
  if (g.error) return g.error;
  try {
    const { a, bytes, inline } = await readAttachment(prisma, id);
    const asFile = !inline || new URL(req.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": a.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${asFile ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return accErrorResponse(e, "[acc-attach]");
  }
}

/** `{title}` — شرح پیوست */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const g = await guard(id, "edit");
  if (g.error) return g.error;
  try {
    const b = await readJson<{ title?: unknown }>(req);
    await renameAttachment(prisma, id, typeof b.title === "string" ? b.title : null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-attach]");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const g = await guard(id, "edit");
  if (g.error) return g.error;
  try {
    const a = await removeAttachment(prisma, id, actorOf(g.access!));
    await logActivity({ action: "DELETE", entity: "OTHER", entityId: a.docId, entityTitle: a.fileName, summary: `حذف پیوست «${a.fileName}»` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-attach]");
  }
}
