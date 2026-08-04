import { NextResponse } from "next/server";
import { validateFilters } from "@/lib/landing-pages";
import { parseCatalogQuery, fetchCatalog } from "@/lib/catalog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { categorySlug, filters } = await req.json();
  const check = await validateFilters(filters ?? {});
  if (!check.ok) return NextResponse.json({ ok: false, errors: check.errors, count: 0 });

  const cq = parseCatalogQuery({ ...filters, category: categorySlug }, { pageSize: 1 });
  const result = await fetchCatalog(cq);
  return NextResponse.json({ ok: true, errors: [], count: result.total });
}