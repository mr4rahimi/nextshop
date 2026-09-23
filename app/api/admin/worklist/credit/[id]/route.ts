import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { creditScope, payInstallment, postponeInstallment } from "@/lib/worklist/credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ثبت واریز یا تمدید یک موعد.
 *
 * `{ action: "pay", amount?, note? }` — مبلغ خالی یعنی همان مبلغ موعد
 * `{ action: "postpone", date: "YYYY-MM-DD" }`
 *
 * مجوز `CREDIT_MANAGE`، و بدون `CREDIT_VIEW_ALL` فقط موعدهای مشتریان خودش.
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission("CREDIT_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const scope = creditScope(guard.access);
  const visible = await prisma.orderCreditInstallment.count({ where: { AND: [{ id }, ...(scope ? [scope] : [])] } });
  if (!visible) return NextResponse.json({ error: "موعد پیدا نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  try {
    if (body?.action === "pay") {
      const r = await payInstallment(id, { amount: body.amount, note: body.note }, guard.access);
      return NextResponse.json({ ok: true, ...r });
    }
    if (body?.action === "postpone") {
      await postponeInstallment(id, String(body.date ?? ""), guard.access);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "عمل نامعتبر" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "انجام نشد" }, { status: 400 });
  }
}
