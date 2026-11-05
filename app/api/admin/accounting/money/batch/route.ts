import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { BatchRollback, runMoneyBatch, type BatchInput, type BatchResult, type BatchRowInput } from "@/lib/accounting/cash/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — دریافت/پرداخت گروهی (docs/plans/webhesab-parity.md بخش ۱۸).
 * `{commit:false}` پیش‌نمایش: همه‌ی ردیف‌ها اجرا و برگردانده می‌شوند (خطا و هشدار هر ردیف، مانده‌ی هر شخص).
 * `{commit:true}` ثبت: فقط اگر هیچ ردیفی خطا نداشته باشد؛ وگرنه هیچ‌کدام و همان گزارش ردیف‌ها.
 */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ commit?: boolean; kind?: string; date?: string; method?: string; treasuryId?: string; allocate?: boolean; description?: string; rows?: BatchRowInput[] }>(req);
    if (!Array.isArray(b.rows)) throw new AccError("ردیف‌ها را بفرستید");
    const input: BatchInput = {
      kind: b.kind as BatchInput["kind"],
      date: requireDay(b.date),
      method: b.method ?? null,
      treasuryId: b.treasuryId || null,
      allocate: b.allocate !== false,
      description: b.description ?? null,
      rows: b.rows,
    };
    const commit = b.commit === true;
    let result: BatchResult;
    try {
      result = await prisma.$transaction(
        async (tx) => {
          const r = await runMoneyBatch(tx, input, actorOf(guard.access), commit);
          if (!r.committed) throw new BatchRollback(r);
          return r;
        },
        { timeout: 300_000 },
      );
    } catch (e) {
      if (!(e instanceof BatchRollback)) throw e;
      result = e.result;
      // شماره‌ی سند پیش‌نمایش واقعی نیست
      for (const r of result.rows) r.doc = null;
    }
    if (result.committed) {
      const label = input.kind === "RECEIPT" ? "دریافت" : "پرداخت";
      await logActivity({
        action: "CREATE",
        entity: "OTHER",
        entityId: result.batchId,
        entityTitle: `${label} گروهی`,
        summary: `${label} گروهی ${faNum(result.ok)} سند — ${formatAmount(BigInt(result.total))} تومان: ${result.rows
          .map((r) => `${faNum(r.doc?.number ?? 0)} ${r.party?.name ?? ""}`)
          .join("، ")
          .slice(0, 400)}`,
      });
    }
    return NextResponse.json(serialize(result));
  } catch (e) {
    return accErrorResponse(e, "[acc-money-batch]");
  }
}
