import { NextResponse } from "next/server";
import { importSPKI, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";

// Torob's public key for EdDSA JWT verification
const TOROB_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----`;

const PAGE_SIZE = 100;

// Cache the imported public key (module-level, reused across requests)
let _publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;
async function getPublicKey() {
  if (!_publicKey) _publicKey = await importSPKI(TOROB_PUBLIC_KEY_PEM, "EdDSA");
  return _publicKey;
}

async function verifyTorobJWT(req: Request): Promise<boolean> {
  const token = req.headers.get("x-torob-token");
  if (!token) return false;

  try {
    const host = new URL(req.url).host;
    const key = await getPublicKey();
    await jwtVerify(token, key, {
      algorithms: ["EdDSA"],
      audience: host,
    });
    return true;
  } catch {
    return false;
  }
}

function toAbsUrl(path: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function isAvailable(trackStock: boolean, stock: number): boolean {
  return !trackStock || stock > 0;
}

function formatDate(d: Date): string {
  return d.toISOString().replace("Z", "+03:30").replace(/\.\d{3}/, "");
}

function buildSpec(specs: { specItem: { title: string }; value: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const s of specs) result[s.specItem.title] = s.value;
  return result;
}

function slugToPageUnique(slug: string): string {
  return slug;
}

function productToPageUrl(slug: string): string {
  return `${SITE_URL}/products/${slug}`;
}

// Build product object in Torob v3 format
function formatProduct(p: {
  id: string; title: string; slug: string; shortDescription: string | null;
  price: bigint; salePrice: bigint | null; warranty: string | null;
  stock: number; trackStock: boolean; mainImage: string | null;
  createdAt: Date; updatedAt: Date;
  category: { title: string } | null;
  images: { url: string }[];
  specs: { specItem: { title: string }; value: string }[];
}) {
  const avail = isAvailable(p.trackStock, p.stock);
  const currentPrice = p.salePrice ?? p.price;
  const hasDiscount = p.salePrice !== null && p.salePrice < p.price;

  const imageLinks: string[] = [];
  if (p.mainImage) imageLinks.push(toAbsUrl(p.mainImage));
  for (const img of p.images) {
    const url = toAbsUrl(img.url);
    if (url && url !== imageLinks[0]) imageLinks.push(url);
  }

  const result: Record<string, unknown> = {
    page_unique: slugToPageUnique(p.slug),
    page_url: productToPageUrl(p.slug),
    title: p.title.slice(0, 500),
    current_price: avail ? Number(currentPrice) : 0,
    availability: avail,
    image_links: imageLinks,
    date_added: formatDate(p.createdAt),
    date_updated: formatDate(p.updatedAt),
  };

  if (hasDiscount) result.old_price = Number(p.price);
  if (p.category) result.category_name = p.category.title.slice(0, 200);
  if (p.shortDescription) result.short_desc = p.shortDescription.slice(0, 500);
  if (p.warranty) result.guarantee = p.warranty.slice(0, 200);

  const spec = buildSpec(p.specs);
  if (Object.keys(spec).length > 0) result.spec = spec;

  return result;
}

const productSelect = {
  id: true, title: true, slug: true, shortDescription: true,
  price: true, salePrice: true, warranty: true,
  stock: true, trackStock: true, mainImage: true,
  createdAt: true, updatedAt: true,
  category: { select: { title: true } },
  images: { orderBy: { sortOrder: "asc" as const }, select: { url: true } },
  specs: { select: { value: true, specItem: { select: { title: true } } } },
};

export async function POST(req: Request) {
  // JWT authentication
  const isValid = await verifyTorobJWT(req);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Mode 1: fetch by page_urls ─────────────────────────────────────────────
  if ("page_urls" in body) {
    const urls = body.page_urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "page_urls must be a non-empty array" }, { status: 400 });
    }

    // Extract slugs from URLs like https://site.com/products/some-slug
    const slugs = (urls as string[]).map((u) => {
      try { return new URL(u).pathname.replace(/^\/products\//, "").replace(/\/$/, ""); }
      catch { return ""; }
    }).filter(Boolean);

    const products = await prisma.product.findMany({
      where: { slug: { in: slugs }, isActive: true },
      select: productSelect,
    });

    return NextResponse.json({
      api_version: "torob_api_v3",
      current_page: 1,
      total: products.length,
      max_pages: 1,
      products: products.map(formatProduct),
    });
  }

  // ── Mode 2: fetch by page_uniques ──────────────────────────────────────────
  if ("page_uniques" in body) {
    const uniques = body.page_uniques;
    if (!Array.isArray(uniques) || uniques.length === 0) {
      return NextResponse.json({ error: "page_uniques must be a non-empty array" }, { status: 400 });
    }

    // page_unique = slug
    const products = await prisma.product.findMany({
      where: { slug: { in: uniques as string[] }, isActive: true },
      select: productSelect,
    });

    return NextResponse.json({
      api_version: "torob_api_v3",
      current_page: 1,
      total: products.length,
      max_pages: 1,
      products: products.map(formatProduct),
    });
  }

  // ── Mode 3: paginated list ─────────────────────────────────────────────────
  if (!("page" in body) || !("sort" in body)) {
    return NextResponse.json(
      { error: "Request must include page_urls, page_uniques, or both page and sort parameters" },
      { status: 400 }
    );
  }

  const page = typeof body.page === "number" ? body.page : parseInt(String(body.page), 10);
  const sort = body.sort as string;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  const validSorts = ["date_added_desc", "date_updated_desc"];
  if (!validSorts.includes(sort)) {
    return NextResponse.json({ error: "sort parameter is not provided" }, { status: 400 });
  }

  const orderBy = sort === "date_updated_desc"
    ? { updatedAt: "desc" as const }
    : { createdAt: "desc" as const };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: productSelect,
    }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  const maxPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    api_version: "torob_api_v3",
    current_page: page,
    total,
    max_pages: maxPages,
    products: products.map(formatProduct),
  });
}
