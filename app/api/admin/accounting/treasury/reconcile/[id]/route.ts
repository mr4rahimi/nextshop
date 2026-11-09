import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { autoMatchRecon, closeRecon, deleteRecon, importStatement, loadRecon, postBankFee, reopenRecon, tickLines, untickLines, updateRecon, type StatementInput } from "@/lib/accounting/cash/recon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    return NextResponse.json(serialize(await loadRecon(prisma, id)));
  } catch (e) {
    return accErrorResponse(e, "[acc-recon]");
  }
}

interface Body extends StatementInput {
  action?: string;
  lineIds?: string[];
  rowId?: string | null;
  days?: number;
  statementDate?: string;
  fromDate?: string;
  openingBalance?: unknown;
  closingBalance?: unknown;
  note?: string | null;
}

/** POST `{action}` — tick، untick، auto، import، fee، update، close، reopen */
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<Body>(req);
    const actor = actorOf(guard.access);
    const result = await prisma.$transaction(
      async (tx): Promise<Record<string, unknown>> => {
        switch (b.action) {
          case "tick":
            return { ticked: await tickLines(tx, id, b.lineIds ?? [], b.rowId ?? null) };
          case "untick":
            return { removed: await untickLines(tx, id, b.lineIds ?? []) };
          case "auto":
            return { matched: await autoMatchRecon(tx, id, b.days ?? 3) };
          case "import":
            return await importStatement(tx, id, b);
          case "fee":
            return { voucher: await postBankFee(tx, id, String(b.rowId ?? ""), actor) };
          case "update":
            await updateRecon(tx, id, {
              statementDate: b.statementDate ? (parseDay(b.statementDate) ?? undefined) : undefined,
              fromDate: b.fromDate ? (parseDay(b.fromDate) ?? undefined) : undefined,
              openingBalance: b.openingBalance === undefined ? undefined : toAmount(b.openingBalance, "مانده‌ی آغاز"),
              closingBalance: b.closingBalance === undefined ? undefined : toAmount(b.closingBalance, "مانده‌ی پایان"),
              note: b.note,
            });
            return {};
          case "close":
            await closeRecon(tx, id, actor);
            return {};
          case "reopen":
            await reopenRecon(tx, id);
            return {};
          default:
            throw new AccError("عملیات نامعتبر است");
        }
      },
      { timeout: 30000 },
    );
    if (b.action === "close" || b.action === "reopen" || b.action === "fee") {
      const label = b.action === "close" ? "بسته شد" : b.action === "reopen" ? "دوباره باز شد" : "کارمزد بانکی ثبت شد";
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: "تطبیق بانک", summary: `تطبیق بانک: ${label}` });
    }
    return NextResponse.json(serialize({ ok: true, ...result }));
  } catch (e) {
    return accErrorResponse(e, "[acc-recon]");
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    await prisma.$transaction((tx) => deleteRecon(tx, id));
    await logActivity({ action: "DELETE", entity: "OTHER", entityId: id, entityTitle: "تطبیق بانک", summary: "تطبیق بانک باز حذف شد" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-recon]");
  }
}
