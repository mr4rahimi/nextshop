import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "شماره سریال یا موبایل را وارد کنید" }, { status: 400 });
  }

  const guaranties = await prisma.guaranty.findMany({
    where: {
      OR: [
        { serialNumber: query },
        { user: { phone: query } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      serialNumber: true,
      productTitle: true,
      startDate: true,
      endDate: true,
      durationDays: true,
    },
  });

  if (guaranties.length === 0) {
    return NextResponse.json({ error: "گارانتی برای شما ثبت نشده است" }, { status: 404 });
  }

  return NextResponse.json(serialize({ items: guaranties }));
}