import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { guarantyId, description } = body;

  if (!guarantyId || !description || description.trim().length < 5) {
    return NextResponse.json({ error: "توضیحات را کامل وارد کنید" }, { status: 400 });
  }

  const guaranty = await prisma.guaranty.findUnique({ where: { id: guarantyId } });
  if (!guaranty) {
    return NextResponse.json({ error: "گارانتی یافت نشد" }, { status: 404 });
  }

  const request = await prisma.guarantyRequest.create({
    data: { guarantyId, description: description.trim() },
  });

  return NextResponse.json(serialize(request));
}