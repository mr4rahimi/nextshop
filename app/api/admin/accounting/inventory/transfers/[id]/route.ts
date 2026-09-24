import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { voidTransfer } from "@/lib/accounting/inventory/docs";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { action: "void", reason } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; reason?: string }>(req);
    if (b.action !== "void") throw new AccError("اقدام نامعتبر است");
    await prisma.$transaction((tx) => voidTransfer(tx, id, String(b.reason ?? ""), actorOf(guard.access)), { timeout: 60_000 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-transfer]");
  }
}
