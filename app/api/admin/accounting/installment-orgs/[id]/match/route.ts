import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { orgGuard, SETTLE_ORG } from "@/lib/accounting/org-api";
import { matchOrgFile } from "@/lib/accounting/org-installments";
import { readSheetFile } from "@/lib/accounting/import/sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST (multipart: file, period) — تطبیق فایل اکسل سازمان با مشتری‌ها؛ چیزی ثبت نمی‌شود */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await orgGuard(SETTLE_ORG);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    const period = String(form.get("period") ?? "");
    if (!(file instanceof File)) throw new AccError("فایل اکسل سازمان را انتخاب کنید");
    if (file.size > 5_000_000) throw new AccError("فایل بیشتر از ۵ مگابایت است");
    const sheets = readSheetFile(file.name, Buffer.from(await file.arrayBuffer()));
    const sheet = sheets.find((s) => s.rows.length > 1) ?? sheets[0];
    if (!sheet) throw new AccError("فایل خالی است");
    return NextResponse.json(serialize({ fileName: file.name, ...(await matchOrgFile(prisma, id, period, sheet.rows)) }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-match]");
  }
}
