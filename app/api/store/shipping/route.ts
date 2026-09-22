import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? "";

  // ⚠️ `useInCheckout` فیلترِ لازم است: روش‌هایی مثل «تیپاکس پس‌کرایه» فقط
  // برای هماهنگی تلفنیِ کارتابل تعریف می‌شوند و نباید در سبد خرید دیده شوند.
  const methods = await prisma.shippingMethod.findMany({
    where: { isActive: true, useInCheckout: true },
    orderBy: [{ sortOrder: "asc" }],
  });

  const filtered = methods.filter(m =>
    m.cities.length === 0 || m.cities.some(c => c === city)
  );

  return NextResponse.json(serialize(filtered));
}
