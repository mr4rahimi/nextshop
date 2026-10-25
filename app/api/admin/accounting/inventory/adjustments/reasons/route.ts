import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { ensureReasons, listReasons, saveReason } from "@/lib/accounting/inventory/adjust";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?all=1 — دلیل‌های ورود و خروج؛ نبودشان ← پیش‌فرض‌ها ساخته می‌شوند */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    await prisma.$transaction((tx) => ensureReasons(tx));
    const reasons = await listReasons(prisma, new URL(req.url).searchParams.get("all") === "1");
    return NextResponse.json(serialize({ reasons, can: { manage: can(guard.access, "ACC_INVENTORY"), account: can(guard.access, "ACC_SETTINGS") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-reasons]");
  }
}

/** POST { id?, name, direction, accountId?, isActive?, sortOrder? } — سرفصل فقط با ACC_SETTINGS */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ id?: string; name?: string; direction?: string; accountId?: string; isActive?: boolean; sortOrder?: number }>(req);
    const r = await prisma.$transaction((tx) =>
      saveReason(
        tx,
        b.id || null,
        {
          name: b.name,
          direction: b.direction === "IN" ? "IN" : b.direction === "OUT" ? "OUT" : undefined,
          accountId: b.accountId || undefined,
          isActive: b.isActive,
          sortOrder: b.sortOrder,
        },
        can(guard.access, "ACC_SETTINGS"),
      ),
    );
    return NextResponse.json(serialize({ ok: true, reason: r }));
  } catch (e) {
    return accErrorResponse(e, "[acc-reasons]");
  }
}
