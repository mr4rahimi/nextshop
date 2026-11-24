import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/integration/core/adapter-registry";

export const dynamic = "force-dynamic";

// GET /api/integration/platforms — پلتفرم‌های فعال (برای فرم‌های ادمین)
export async function GET() {
  const platforms = await prisma.integPlatform.findMany({
    where:   { isActive: true },
    select:  { code: true, name: true, type: true },
    orderBy: { code: "asc" },
  });
  // سرویس خاموش یا بی‌آداپتور در فرم‌ها (مثل ویزارد نگاشت) نمی‌آید
  return NextResponse.json({ platforms: platforms.filter((p) => getAdapter(p.code)) });
}
