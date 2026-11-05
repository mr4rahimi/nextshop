import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { duplicateGroups, type DupGroup } from "@/lib/accounting/party-merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: DupGroup["kind"][] = ["mobile", "nationalId", "name"];

/** GET ?kind=mobile|nationalId|name — نامزدهای تکراری میان اشخاص فعال (بخش ۱۷) */
export async function GET(req: Request) {
  const guard = await requirePermission("ACC_PARTY_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const k = new URL(req.url).searchParams.get("kind") as DupGroup["kind"] | null;
    const groups = await duplicateGroups(prisma, k && KINDS.includes(k) ? [k] : KINDS);
    return NextResponse.json(serialize({ groups, can: { merge: can(guard.access, "ACC_VOUCHER") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-party-dups]");
  }
}
