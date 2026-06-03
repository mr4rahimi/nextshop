import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECRET = process.env.JWT_SECRET || "mymonta-secret-key-change-in-production";

async function verifyToken(token: string): Promise<{ userId: string; role: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // صفحه لاگین ادمین — آزاد
  if (pathname === "/admin/login") return NextResponse.next();

  // محافظت از همه مسیرهای ادمین
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};