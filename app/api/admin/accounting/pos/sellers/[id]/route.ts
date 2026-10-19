import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { posGuard } from "@/lib/accounting/pos/api";
import { saveSeller, type SellerInput } from "@/lib/accounting/pos/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard(["ACC_POS_MANAGE"]);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const body = await readJson<SellerInput>(req);
    const seller = await prisma.$transaction((tx) => saveSeller(tx, id, body));
    return NextResponse.json(serialize({ ok: true, seller }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-seller]");
  }
}
