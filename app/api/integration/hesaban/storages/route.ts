import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import { decryptCredentials } from "@/lib/integration/core/crypto";
import type { HesabanAdapter } from "@/lib/integration/adapters/accounting/hesaban.adapter";

export const dynamic = "force-dynamic";

// GET /api/integration/hesaban/storages — لیست انبارها برای انتخاب انبار فاکتور
export async function GET() {
  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: "hesaban", status: { in: ["CONNECTED", "SYNCING"] } },
  });
  if (!connection) {
    return NextResponse.json({ error: "اتصال حسابداری برقرار نیست" }, { status: 400 });
  }

  const adapter = getAdapter("hesaban") as HesabanAdapter | null;
  if (!adapter?.getStorages) {
    return NextResponse.json({ error: "آداپتور حسابداری یافت نشد" }, { status: 500 });
  }

  try {
    const storages = await adapter.getStorages(decryptCredentials(connection.credentials));
    return NextResponse.json({ storages });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطا" }, { status: 500 });
  }
}
