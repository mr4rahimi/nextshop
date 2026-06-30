import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import { prisma } from "@/lib/prisma";
import { encryptCredentials } from "@/lib/integration/core/crypto";

export const dynamic = "force-dynamic";

// POST /api/integration/connections/test
// body: { platformCode, credentials }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    platformCode: string;
    credentials:  Record<string, string>;
  };

  if (!body.platformCode || !body.credentials) {
    return NextResponse.json({ error: "platformCode و credentials الزامی هستند" }, { status: 400 });
  }

  const adapter = getAdapter(body.platformCode);
  if (!adapter) {
    return NextResponse.json({ error: `پلتفرم "${body.platformCode}" پشتیبانی نمی‌شود` }, { status: 404 });
  }

  const result = await adapter.testConnection(body.credentials);

  // آپدیت وضعیت در DB
  const encrypted = encryptCredentials(body.credentials);
  const existing = await prisma.integConnection.findFirst({
    where: { platformCode: body.platformCode, siteId: null },
  });

  if (existing) {
    await prisma.integConnection.update({
      where: { id: existing.id },
      data: {
        credentials:  encrypted,
        status:       result.success ? "CONNECTED" : "ERROR",
        lastErrorAt:  result.success ? undefined : new Date(),
        lastError:    result.success ? undefined : result.message,
        updatedAt:    new Date(),
      },
    });
  } else {
    await prisma.integConnection.create({
      data: {
        platformCode: body.platformCode,
        credentials:  encrypted,
        status:       result.success ? "CONNECTED" : "ERROR",
        lastError:    result.success ? undefined : result.message,
      },
    });
  }

  return NextResponse.json(result);
}
