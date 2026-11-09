import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { createRecon, reconHub } from "@/lib/accounting/cash/recon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — حساب‌های قابل تطبیق و تاریخچه‌ی تطبیق‌ها */
export async function GET() {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json(serialize(await reconHub(prisma)));
}

/** POST — شروع تطبیق تازه */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ treasuryId?: string; statementDate?: string; fromDate?: string; openingBalance?: unknown; closingBalance?: unknown }>(req);
    const recon = await prisma.$transaction((tx) =>
      createRecon(
        tx,
        {
          treasuryId: String(b.treasuryId ?? ""),
          statementDate: requireDay(b.statementDate, "تاریخ صورت‌حساب"),
          fromDate: parseDay(b.fromDate),
          openingBalance: toAmount(b.openingBalance, "مانده‌ی آغاز"),
          closingBalance: toAmount(b.closingBalance, "مانده‌ی پایان"),
        },
        actorOf(guard.access),
      ),
    );
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: recon.id, entityTitle: "تطبیق بانک", summary: "تطبیق بانک تازه شروع شد" });
    return NextResponse.json(serialize({ ok: true, recon }));
  } catch (e) {
    return accErrorResponse(e, "[acc-recon]");
  }
}
