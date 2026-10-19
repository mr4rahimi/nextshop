import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { posGuard } from "@/lib/accounting/pos/api";
import { saveSeller, type SellerInput } from "@/lib/accounting/pos/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await posGuard();
  if (!g.ok) return g.res;
  const sellers = await prisma.accPosSeller.findMany({ where: g.manage ? {} : { isActive: true }, orderBy: { code: "asc" } });
  return NextResponse.json(serialize({ sellers }));
}

export async function POST(req: Request) {
  const g = await posGuard(["ACC_POS_MANAGE"]);
  if (!g.ok) return g.res;
  try {
    const body = await readJson<SellerInput>(req);
    const seller = await prisma.$transaction((tx) => saveSeller(tx, null, body));
    return NextResponse.json(serialize({ ok: true, seller }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-seller]");
  }
}
