import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import {
  assetsOverview,
  ensureAssetChart,
  createAsset,
  disposeAsset,
  invoiceCandidates,
  monthlySummary,
  runMonthly,
  undisposeAsset,
  updateAsset,
  voidAsset,
  type AssetBody,
  type DisposeBody,
} from "@/lib/accounting/assets/fixed";
import {
  createDeposit,
  createPrepaid,
  expenseAccounts,
  finishPrepaid,
  prepaidOverview,
  returnDeposit,
  unreturnDeposit,
  voidDeposit,
  voidPrepaid,
  type DepositBody,
  type PrepaidBody,
} from "@/lib/accounting/assets/prepaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW = ["ACC_EXPENSE", "ACC_REPORTS", "ACC_SETTINGS"] as const;

/**
 * دارایی ثابت، پیش‌پرداخت هزینه و ودیعه — webhesab-parity.md بخش ۳۴.۵
 * GET              دفتر دارایی + پیش‌پرداخت‌ها + ودیعه‌ها، مانده‌ی حساب‌ها در برابر دفتر
 * GET ?candidates=1  ردیف‌های فاکتور خرید روی حساب دارایی که هنوز دارایی نشده‌اند
 * POST {action, …}   ثبت و تغییر — ACC_EXPENSE؛ «run» (استهلاک و سهم ماه همین حالا) ACC_EXPENSE یا ACC_SETTINGS
 */
export async function GET(req: Request) {
  const guard = await requirePermission([...VIEW]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    if (new URL(req.url).searchParams.get("candidates") === "1") return NextResponse.json(serialize({ items: await invoiceCandidates(prisma) }));
    // نصب قدیمی‌تر: حساب‌های ۲.۱۶۸.۰ همین‌جا ساخته می‌شوند تا فرم حساب دارایی داشته باشد
    const s = await prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } });
    if (s?.mode === "INTERNAL" && (await prisma.accAccount.count())) await prisma.$transaction((t) => ensureAssetChart(t));
    const [fixed, prepaid, expense] = await Promise.all([assetsOverview(prisma), prepaidOverview(prisma), expenseAccounts(prisma)]);
    return NextResponse.json(
      serialize({ ...fixed, ...prepaid, expenseAccounts: expense, can: { manage: can(guard.access, "ACC_EXPENSE"), run: can(guard.access, "ACC_EXPENSE") || can(guard.access, "ACC_SETTINGS") } }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-assets]");
  }
}

type Body = { action?: string; id?: string; reason?: string } & AssetBody & PrepaidBody & DepositBody & DisposeBody & { shortfallAccountId?: string | null };

export async function POST(req: Request) {
  const b = await readJson<Body>(req).catch(() => ({}) as Body);
  const guard = await requirePermission(b.action === "run" ? ["ACC_EXPENSE", "ACC_SETTINGS"] : "ACC_EXPENSE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const actor = actorOf(guard.access);
  const id = String(b.id ?? "");
  const tx = <T,>(fn: (t: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn, { timeout: 120_000 });
  const log = (action: "CREATE" | "UPDATE" | "DELETE", entityTitle: string, summary: string, entityId?: string) =>
    logActivity({ action, entity: "OTHER", entityId, entityTitle, summary });
  try {
    switch (b.action) {
      case "run": {
        const r = await tx((t) => runMonthly(t, actor));
        return NextResponse.json(serialize({ ok: true, result: { ...r, message: monthlySummary(r) } }));
      }
      case "asset.create": {
        const a = await tx((t) => createAsset(t, b, actor));
        await log("CREATE", `دارایی ${a.number}`, `دارایی ثابت «${a.name}» ثبت شد`, a.id);
        return NextResponse.json(serialize({ ok: true, asset: a }));
      }
      case "asset.update": {
        const a = await tx((t) => updateAsset(t, id, b));
        return NextResponse.json(serialize({ ok: true, asset: a }));
      }
      case "asset.dispose": {
        const a = await tx((t) => disposeAsset(t, id, b, actor));
        await log("UPDATE", `دارایی ${a.number}`, `دارایی «${a.name}» ${a.disposalAmount ? "فروخته" : "اسقاط"} شد`, a.id);
        return NextResponse.json(serialize({ ok: true, asset: a }));
      }
      case "asset.undispose": {
        const a = await tx((t) => undisposeAsset(t, id, actor));
        await log("UPDATE", `دارایی ${a.number}`, `فروش/اسقاط «${a.name}» برگشت`, a.id);
        return NextResponse.json(serialize({ ok: true, asset: a }));
      }
      case "asset.void": {
        const a = await tx((t) => voidAsset(t, id, String(b.reason ?? ""), actor));
        await log("DELETE", `دارایی ${a.number}`, `دارایی «${a.name}» باطل شد`, a.id);
        return NextResponse.json(serialize({ ok: true, asset: a }));
      }
      case "prepaid.create": {
        const p = await tx((t) => createPrepaid(t, b, actor));
        await log("CREATE", `پیش‌پرداخت ${p.number}`, `پیش‌پرداخت «${p.title}» برای ${faNum(p.months)} ماه ثبت شد`, p.id);
        return NextResponse.json(serialize({ ok: true, prepaid: p }));
      }
      case "prepaid.finish": {
        const p = await tx((t) => finishPrepaid(t, id, actor));
        await log("UPDATE", `پیش‌پرداخت ${p.number}`, `پیش‌پرداخت «${p.title}» زودتر تمام شد`, p.id);
        return NextResponse.json(serialize({ ok: true, prepaid: p }));
      }
      case "prepaid.void": {
        const p = await tx((t) => voidPrepaid(t, id, String(b.reason ?? ""), actor));
        await log("DELETE", `پیش‌پرداخت ${p.number}`, `پیش‌پرداخت «${p.title}» باطل شد`, p.id);
        return NextResponse.json(serialize({ ok: true, prepaid: p }));
      }
      case "deposit.create": {
        const d = await tx((t) => createDeposit(t, b, actor));
        await log("CREATE", `ودیعه ${d.number}`, `ودیعه‌ی «${d.title}» نزد ${d.counterparty} ثبت شد`, d.id);
        return NextResponse.json(serialize({ ok: true, deposit: d }));
      }
      case "deposit.return": {
        const d = await tx((t) => returnDeposit(t, id, b, actor));
        await log("UPDATE", `ودیعه ${d.number}`, `ودیعه‌ی «${d.title}» برگشت`, d.id);
        return NextResponse.json(serialize({ ok: true, deposit: d }));
      }
      case "deposit.unreturn": {
        const d = await tx((t) => unreturnDeposit(t, id, actor));
        return NextResponse.json(serialize({ ok: true, deposit: d }));
      }
      case "deposit.void": {
        const d = await tx((t) => voidDeposit(t, id, String(b.reason ?? ""), actor));
        await log("DELETE", `ودیعه ${d.number}`, `ودیعه‌ی «${d.title}» باطل شد`, d.id);
        return NextResponse.json(serialize({ ok: true, deposit: d }));
      }
      default:
        throw new AccError("درخواست نامعتبر است");
    }
  } catch (e) {
    return accErrorResponse(e, "[acc-assets]");
  }
}
