import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addAttributeValue, VariantError } from "@/lib/variants-admin";

export const runtime = "nodejs";

/** POST { attributeId, value, colorHex } — مقدار تازه‌ی ویژگی (رنگ/سایز) از ویرایش تنوع */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const v = await prisma.$transaction((tx) => addAttributeValue(tx, String(b.attributeId ?? ""), String(b.value ?? ""), b.colorHex ?? null));
    return NextResponse.json({ ok: true, value: { id: v.id, value: v.value, colorHex: v.colorHex } });
  } catch (e) {
    if (e instanceof VariantError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[variant-value]", e);
    return NextResponse.json({ error: "ساخته نشد" }, { status: 500 });
  }
}
