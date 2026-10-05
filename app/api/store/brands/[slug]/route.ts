import { NextResponse } from "next/server";
import { getBrandData } from "@/lib/brand-data";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const brand = await getBrandData(slug);
  if (!brand) {
    return NextResponse.json({ message: "برند یافت نشد" }, { status: 404 });
  }
  return NextResponse.json(brand);
}
