import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/seller/:path*",
    "/api/seller/:path*",
  ],
};