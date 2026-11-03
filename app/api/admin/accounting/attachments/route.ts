import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getStaffAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, rangeFrom } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import {
  ACCEPT,
  ATTACH_PERMS,
  ATTACH_TYPES,
  addAttachment,
  canEdit,
  canView,
  isAttachType,
  listAttachments,
  resolveDocs,
  searchAttachments,
} from "@/lib/accounting/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * پیوست مدارک — docs/plans/webhesab-parity.md بخش ۱۶.
 * GET ?docType&docId — پیوست‌های یک سند (مجوز دیدن همان نوع سند)
 * GET ?docType&from&to&q&uploader (بی docId) — همه‌ی پیوست‌ها، فقط نوع‌هایی که کاربر می‌بیند
 * POST multipart: docType، docId، title?، file (یک یا چند) — مجوز ثبت همان نوع سند
 */
export async function GET(req: Request) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    const docType = sp.get("docType");
    const docId = sp.get("docId");
    if (docId) {
      if (!isAttachType(docType)) throw new AccError("نوع سند نامعتبر است");
      if (!canView(access, docType)) return NextResponse.json({ error: "دسترسی ندارید" }, { status: 403 });
      return NextResponse.json(serialize({ rows: await listAttachments(prisma, docType, docId), can: { edit: canEdit(access, docType) }, accept: ACCEPT }));
    }
    const types = ATTACH_TYPES.filter((t) => canView(access, t));
    if (!types.length) return NextResponse.json({ error: "دسترسی ندارید" }, { status: 403 });
    const range = rangeFrom(url);
    const data = await searchAttachments(prisma, { types, docType, from: range.from, to: range.to, q: sp.get("q"), uploader: sp.get("uploader") || null });
    return NextResponse.json(serialize({ ...data, types: types.map((t) => ({ value: t, label: ATTACH_PERMS[t].label })) }));
  } catch (e) {
    return accErrorResponse(e, "[acc-attach]");
  }
}

export async function POST(req: Request) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });
  try {
    const form = await req.formData().catch(() => null);
    if (!form) throw new AccError("درخواست نامعتبر است");
    const docType = form.get("docType");
    const docId = String(form.get("docId") ?? "");
    if (!isAttachType(docType)) throw new AccError("نوع سند نامعتبر است");
    if (!canEdit(access, docType)) return NextResponse.json({ error: "برای افزودن پیوست به این سند مجوز ندارید" }, { status: 403 });
    const files = form.getAll("file").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
    if (!files.length) throw new AccError("فایلی انتخاب نشده است");
    if (files.length > 10) throw new AccError("هر بار حداکثر ۱۰ فایل");
    const title = String(form.get("title") ?? "") || null;
    const actor = actorOf(access);
    const created = [];
    // یکی‌یکی: فایل خراب بعدی، فایل‌های سالم قبلی را برنمی‌گرداند و پیامش نام همان فایل را دارد
    for (const f of files) {
      created.push(await addAttachment(prisma, docType, docId, { name: f.name, size: f.size, type: f.type, bytes: Buffer.from(await f.arrayBuffer()) }, title, actor));
    }
    const doc = (await resolveDocs(prisma, [{ docType, docId }])).get(`${docType}|${docId}`);
    await logActivity({
      action: "UPLOAD",
      entity: "OTHER",
      entityId: docId,
      entityTitle: doc?.label ?? ATTACH_PERMS[docType].label,
      summary: `پیوست ${faNum(created.length)} فایل به ${doc?.label ?? "سند"}: ${created.map((c) => c.fileName).join("، ")}`,
    });
    return NextResponse.json(serialize({ ok: true, count: created.length }));
  } catch (e) {
    return accErrorResponse(e, "[acc-attach]");
  }
}
