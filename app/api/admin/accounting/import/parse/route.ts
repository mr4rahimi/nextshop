import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { readSheetFile } from "@/lib/accounting/import/sheet";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/** POST multipart `file` — خواندن xlsx/csv؛ فقط متن خانه‌ها برمی‌گردد، چیزی ذخیره نمی‌شود */
export async function POST(req: Request) {
  const guard = await requirePermission(["ACC_INVENTORY", "ACC_PARTY_MANAGE", "ACC_SETTINGS", "ACC_STOCK_COUNT"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AccError("فایلی انتخاب نشده");
    if (file.size > MAX_BYTES) throw new AccError("فایل بزرگ‌تر از ۱۵ مگابایت است — چند تکه کنید");
    const sheets = readSheetFile(file.name, Buffer.from(await file.arrayBuffer()));
    // ردیف‌های تمام‌خالی ته برگه حذف
    for (const s of sheets) while (s.rows.length && !s.rows[s.rows.length - 1].some((c) => c)) s.rows.pop();
    return NextResponse.json({ name: file.name, sheets });
  } catch (e) {
    return accErrorResponse(e, "[acc-import-parse]");
  }
}
