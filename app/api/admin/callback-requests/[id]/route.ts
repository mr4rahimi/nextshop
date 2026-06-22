import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const { status, note } = body;

  const validStatuses = ["pending", "contacted", "done"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "وضعیت نامعتبر" }, { status: 400 });
  }

  const updated = await prisma.callbackRequest.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  });

  return NextResponse.json({ success: true, status: updated.status });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.callbackRequest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
