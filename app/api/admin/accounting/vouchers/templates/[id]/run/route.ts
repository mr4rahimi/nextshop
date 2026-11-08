import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";
import { runTemplate, type TemplateRunInput } from "@/lib/accounting/ledger/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — ثبت سند از روی ورودی سریع */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ date?: string; base?: unknown; description?: string; version?: string; lines?: TemplateRunInput["lines"] }>(req);
    if (b.lines !== undefined && !Array.isArray(b.lines)) throw new AccError("ردیف‌ها نامعتبر است");
    const input: TemplateRunInput = {
      date: requireDay(b.date),
      base: toAmount(b.base, "مبلغ پایه"),
      description: b.description ?? null,
      version: b.version ?? null,
      lines: b.lines ?? [],
    };
    const v = await prisma.$transaction((tx) => runTemplate(tx, id, input, actorOf(guard.access)));
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: v.id, entityTitle: `سند حسابداری ${v.number}`, summary: `ورودی سریع، سند ${v.number}: ${v.description}` });
    return NextResponse.json(serialize({ ok: true, voucher: v }));
  } catch (e) {
    return accErrorResponse(e, "[acc-templates-run]");
  }
}
