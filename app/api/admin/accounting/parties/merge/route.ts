import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import { mergeParties, mergePreview } from "@/lib/accounting/party-merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ادغام اشخاص تکراری — docs/plans/webhesab-parity.md بخش ۱۷.
 * GET ?a&b — پیش‌نمایش (گردش هر طرف، مانده، پیشنهاد ماندنی، مانع‌ها)
 * POST `{keepId, dropId}` — ادغام؛ مجوز اشخاص **و** نمای حسابدار (ردیف سندهای ثبت‌شده جابه‌جا می‌شوند)
 */
export async function GET(req: Request) {
  const guard = await requirePermission("ACC_PARTY_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const u = new URL(req.url);
    const a = u.searchParams.get("a");
    const b = u.searchParams.get("b");
    if (!a || !b) throw new AccError("دو شخص را انتخاب کنید");
    const preview = await mergePreview(prisma, a, b);
    return NextResponse.json(serialize({ ...preview, can: { merge: can(guard.access, "ACC_VOUCHER") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-party-merge]");
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_PARTY_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!can(guard.access, "ACC_VOUCHER")) return NextResponse.json({ error: "ادغام اشخاص مجوز «نمای حسابدار» هم می‌خواهد" }, { status: 403 });
  try {
    const b = await readJson<{ keepId?: string; dropId?: string }>(req);
    if (!b.keepId || !b.dropId) throw new AccError("دو شخص را انتخاب کنید");
    const { keepId, dropId } = b;
    const drop = await prisma.accParty.findUnique({ where: { id: dropId }, select: { name: true, code: true } });
    const res = await prisma.$transaction((tx) => mergeParties(tx, keepId, dropId, actorOf(guard.access)), { timeout: 120_000 });
    const n = Object.values(res.moved).reduce((s, x) => s + (x ?? 0), 0);
    await logActivity({
      action: "UPDATE",
      entity: "OTHER",
      entityId: res.keep.id,
      entityTitle: `شخص ${res.keep.name}`,
      summary: `ادغام «${drop?.name ?? "?"}» (کد ${faNum(drop?.code ?? 0)}) در «${res.keep.name}» (کد ${faNum(res.keep.code)}): ${faNum(n)} مورد منتقل شد`,
    });
    return NextResponse.json(serialize({ ok: true, ...res }));
  } catch (e) {
    return accErrorResponse(e, "[acc-party-merge]");
  }
}
