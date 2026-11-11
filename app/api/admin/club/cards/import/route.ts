import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { readSheetFile } from "@/lib/accounting/import/sheet";
import { AccError } from "@/lib/accounting/errors";
import { commitImport, parseImport } from "@/lib/club/cards";
import { cardsError, cardsGuard } from "@/lib/club/cards-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST (multipart) — ورود کارت و مانده از نرم‌افزار قبلی.
 * فیلدها: `file` (xlsx/csv) یا `text` (چسباندن از اکسل، جداشده با Tab)، `unit` (toman|rial)،
 * `commit` (۱ = ثبت؛ وگرنه فقط بررسی). هر بار فایل دوباره فرستاده می‌شود (بی‌حالت).
 */
export async function POST(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const text = String(form.get("text") ?? "");
    let table: string[][];
    if (file && typeof file !== "string" && file.size) {
      const sheets = readSheetFile(file.name, Buffer.from(await file.arrayBuffer()));
      table = sheets[0].rows;
    } else if (text.trim()) {
      table = text.split(/\r?\n/).map((l) => l.split("\t"));
    } else {
      return NextResponse.json({ error: "فایل اکسل را انتخاب کنید یا جدول را بچسبانید" }, { status: 400 });
    }
    const unit = form.get("unit") === "rial" ? "rial" : "toman";
    const parsed = await parseImport(table, unit);
    if (form.get("commit") !== "1") {
      return NextResponse.json(serialize({ ok: true, preview: { ...parsed, rows: parsed.rows.slice(0, 50) } }));
    }
    if (parsed.errors.length) return NextResponse.json({ error: `${parsed.errors.length.toLocaleString("fa-IR")} ردیف خطا دارد؛ اول درستشان کنید` }, { status: 400 });
    const r = await commitImport(parsed.rows);
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: "club-card-import",
      entityTitle: "ورود کارت اشتراک",
      summary: `ورود ${r.members.toLocaleString("fa-IR")} دارنده‌ی کارت (${r.newUsers.toLocaleString("fa-IR")} مشتری تازه) با ${parsed.summary.credit.toLocaleString("fa-IR")} تومان مانده`,
    });
    return NextResponse.json(serialize({ ok: true, result: r, summary: parsed.summary }));
  } catch (e) {
    if (e instanceof AccError) return NextResponse.json({ error: e.message }, { status: 400 });
    return cardsError(e, "[club-card-import]");
  }
}
