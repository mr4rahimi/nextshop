import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.JWT_SECRET || "mymonta-secret-key-change-in-production";
const COOKIE_NAME = "auth_token";
const EXPIRES_IN = 60 * 60 * 24 * 30; // 30 روز

// ── ابزار Base64URL ───────────────────────────────────────────────────────────
function base64UrlEncode(data: Uint8Array): string {
  return Buffer.from(data).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function base64UrlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

// ── ساخت JWT با HMAC-SHA256 ───────────────────────────────────────────────────
async function createHmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function signToken(payload: { userId: string; phone: string; role: string }): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + EXPIRES_IN })));
  const sig = await createHmac(`${header}.${body}`, SECRET);
  return `${header}.${body}.${sig}`;
}

export async function verifyToken(token: string): Promise<{ userId: string; phone: string; role: string } | null> {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expected = await createHmac(`${header}.${body}`, SECRET);
    if (expected !== sig) return null;
    const payload = JSON.parse(base64UrlDecode(body).toString("utf-8"));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload) return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, phone: true, firstName: true, lastName: true, email: true, avatarUrl: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRES_IN,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ── هش رمز عبور با SHA-256 ───────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + (process.env.PASSWORD_SALT || "mymonta-salt"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}