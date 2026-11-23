import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { orgGuard } from "@/lib/accounting/org-api";
import { orgQuote } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?orgId&partyId&amount — برآورد: پورسانت، قسط ماهانه، جدول، سقف‌ها و ایرادها (صندوق و فاکتور) */
export async function GET(req: Request) {
  const g = await orgGuard();
  if (!g.ok) return g.res;
  try {
    const u = new URL(req.url).searchParams;
    const orgId = u.get("orgId") ?? "";
    const raw = (u.get("amount") ?? "0").replace(/\D/g, "");
    if (!orgId) throw new AccError("سازمان را انتخاب کنید");
    return NextResponse.json(serialize({ quote: await orgQuote(prisma, orgId, u.get("partyId") || null, BigInt(raw || "0")) }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-quote]");
  }
}
