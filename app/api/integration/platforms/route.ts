import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integration/platforms — پلتفرم‌های فعال (برای فرم‌های ادمین)
export async function GET() {
  const platforms = await prisma.integPlatform.findMany({
    where:   { isActive: true },
    select:  { code: true, name: true, type: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ platforms });
}
