import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { matchPath, shouldSkip, normalizePath } from "@/lib/redirects";
import { getRules, internalBase, INTERNAL_HEADER, internalToken } from "@/lib/redirectCache";

const SECRET = process.env.JWT_SECRET ?? "";

type TokenPayload = { userId: string; phone: string; role: string; exp: number };

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

/**
 * اعتبارسنجی امضای توکن و برگرداندن payload.
 * برخلاف نسخه قبل که فقط boolean برمی‌گرداند، اینجا نقش را هم لازم داریم
 * چون مسیرهای فروشنده هم ADMIN و هم SELLER را می‌پذیرند.
 */
async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sig) as BufferSource,
      enc.encode(`${header}.${body}`)
    );

    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body))
    ) as TokenPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

async function hasRole(token: string | undefined, roles: string[]): Promise<boolean> {
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!payload && roles.includes(payload.role);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;

  // ── Admin API routes ─────────────────────────────────────────────
  if (pathname.startsWith("/api/admin/")) {
    if (pathname === "/api/admin/auth/login") return NextResponse.next();

    if (!(await hasRole(token, ["ADMIN"]))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Admin page routes ────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();

    if (!(await hasRole(token, ["ADMIN"]))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // ── Seller API routes ────────────────────────────────────────────
  // ادمین هم دسترسی دارد تا برای تست نیاز به حساب جدا نباشد
  if (pathname.startsWith("/api/seller/")) {
    if (pathname === "/api/seller/auth/login") return NextResponse.next();

    if (!(await hasRole(token, ["ADMIN", "SELLER"]))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Seller page routes ───────────────────────────────────────────
  if (pathname.startsWith("/seller")) {
    if (pathname === "/seller/login") return NextResponse.next();

    if (!(await hasRole(token, ["ADMIN", "SELLER"]))) {
      return NextResponse.redirect(new URL("/seller/login", request.url));
    }
    return NextResponse.next();
  }

  // ── ریدایرکت‌های مدیریت‌شده از پنل ادمین ──────────────────────────
  // بعد از همه‌ی بررسی‌های احراز هویت می‌آید تا هرگز جلوی صفحه‌ی ورود را نگیرد.
  return handleRedirects(request);
}

/**
 * ریدایرکت‌های تعریف‌شده در `/admin/seo/redirects`.
 *
 * قواعد از یک مسیر داخلی گرفته و در حافظه کش می‌شوند (`lib/redirectCache.ts`)،
 * پس این تابع در حالت عادی هیچ I/O ندارد و فقط یک جستجوی درون‌حافظه‌ای است.
 *
 * ریدایرکت‌های حجیم مهاجرت بهتر است در nginx بمانند؛ این لایه برای قواعد
 * جاری است که ادمین اضافه می‌کند.
 */
async function handleRedirects(request: NextRequest) {
  const { pathname, origin, search } = request.nextUrl;

  if (shouldSkip(pathname)) return NextResponse.next();

  let rules;
  try {
    rules = await getRules();
  } catch {
    return NextResponse.next(); // هرگز نباید صفحه را بشکند
  }
  if (!rules.length) return NextResponse.next();

  const hit = matchPath(pathname, rules);
  if (!hit) return NextResponse.next();

  if (hit.rule.statusCode === 410) {
    void countHit(hit.rule.id);
    return new NextResponse("Gone", { status: 410 });
  }

  const isExternal = /^https?:\/\//i.test(hit.destination);

  // جلوگیری از حلقه‌ی بی‌نهایت اگر مقصد همان مسیر فعلی باشد
  if (!isExternal && normalizePath(hit.destination) === normalizePath(pathname)) {
    return NextResponse.next();
  }

  const target = isExternal
    ? hit.destination
    : new URL(hit.destination + search, origin).toString();

  void countHit(hit.rule.id);
  return NextResponse.redirect(target, hit.rule.statusCode);
}

/**
 * شمارش بازدید هر قاعده. عمداً await نمی‌شود — کاربر نباید منتظر یک UPDATE
 * آماری بماند و شکست آن نباید جلوی ریدایرکت را بگیرد.
 */
function countHit(id: string) {
  return fetch(`${internalBase()}/api/internal/redirects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [INTERNAL_HEADER]: internalToken() },
    body: JSON.stringify({ id }),
    cache: "no-store",
  }).catch(() => {});
}

export const config = {
  /**
   * قبلاً فقط مسیرهای ادمین و فروشنده را می‌گرفت؛ حالا برای ریدایرکت‌ها باید
   * صفحات فروشگاه را هم ببیند. فایل‌های استاتیک و مسیرهای داخلی بیرون نگه
   * داشته می‌شوند تا proxy بی‌دلیل روی هر تصویر اجرا نشود.
   *
   * `shouldSkip` همین را دوباره چک می‌کند: این matcher برای صرفه‌جویی در
   * فراخوانی است، آن یکی برای درستی.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads/|upload/|assets/|api/internal/).*)",
  ],
};