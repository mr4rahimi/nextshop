import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { parseCatalogQuery, fetchCatalog } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cq = parseCatalogQuery(url.searchParams);
  const rawSize = parseInt(url.searchParams.get("pageSize") ?? "12");
  cq.pageSize = Math.min(48, Math.max(1, Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 12));

  const legacy = url.searchParams.getAll("attr").filter(Boolean);
  const result = await fetchCatalog(cq, legacy);
  return NextResponse.json(serialize(result));
}