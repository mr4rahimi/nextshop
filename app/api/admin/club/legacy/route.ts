import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/permissions";
import { cardsGuard } from "@/lib/club/cards-api";
import { commitLegacy, LegacyError, listLegacy, parseLegacy, previewLegacy } from "@/lib/club/legacy-customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fa = (n: number | bigint) => n.toLocaleString("fa-IR");

function fail(e: unknown) {
  if (e instanceof LegacyError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[club-legacy]", e);
  return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
}

/** GET ?q&filter&page — پرونده‌های واردشده از نرم‌افزار قبلی (webhesab-parity.md بخش ۲۴) */
export async function GET(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const sp = new URL(req.url).searchParams;
    const f = sp.get("filter");
    return NextResponse.json(
      serialize(
        await listLegacy({
          search: sp.get("q") ?? undefined,
          filter: f === "noMobile" || f === "inactive" || f === "buyers" || f === "unlinked" ? f : "all",
          page: Number(sp.get("page")) || 1,
        }),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST { mode: "preview" | "commit", header, rows, offset, unit, consent }
 * رابط فایل را در مرورگر می‌خواند و دسته‌دسته می‌فرستد (پیش‌نمایش ۲۵۰۰تایی، ثبت ۵۰۰تایی)؛
 * `offset` شماره‌ی سطر فایل را در پیام خطا درست می‌کند. ثبت مجوز اشخاص حسابداری هم می‌خواهد.
 */
export async function POST(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const b = (await req.json().catch(() => null)) as { mode?: string; header?: string[]; rows?: string[][]; offset?: number; unit?: string; consent?: boolean } | null;
    if (!b || !Array.isArray(b.header) || !Array.isArray(b.rows)) return NextResponse.json({ error: "فایل خوانده نشد" }, { status: 400 });
    if (b.rows.length > 3000) return NextResponse.json({ error: "هر دسته حداکثر ۳٬۰۰۰ سطر" }, { status: 400 });
    const unit = b.unit === "toman" ? "toman" : "rial";
    const table = [b.header.map(String), ...b.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []))];
    const off = Math.max(0, Number(b.offset) || 0);
    const shift = <T extends { line: number }>(l: T[]) => l.map((x) => ({ ...x, line: x.line + off }));
    if (b.mode !== "commit") {
      const p = await previewLegacy(table, unit);
      return NextResponse.json(serialize({ ...p, errors: shift(p.errors), warnings: shift(p.warnings) }));
    }
    if (!can(g.access, "ACC_PARTY_MANAGE")) return NextResponse.json({ error: "ثبت، مجوز «افزودن و ویرایش اشخاص حسابداری» هم می‌خواهد" }, { status: 403 });
    const parsed = parseLegacy(table, unit);
    if (parsed.errors.length) return NextResponse.json({ error: `${fa(parsed.errors.length)} سطر خطا دارد`, errors: shift(parsed.errors).slice(0, 50) }, { status: 400 });
    const r = await commitLegacy(parsed.rows, { consent: !!b.consent, actor: g.access.name });
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: "club-legacy-import",
      entityTitle: "انتقال مشتریان از نرم‌افزار قبلی",
      summary: `سطرهای ${fa(off + 1)} تا ${fa(off + parsed.rows.length)}: ${fa(r.newUsers)} مشتری تازه، ${fa(r.newParties)} شخص حسابداری تازه${r.consented ? `، ${fa(r.consented)} رضایت پیامک` : ""}`,
    });
    return NextResponse.json(serialize({ ok: true, result: r }));
  } catch (e) {
    return fail(e);
  }
}
