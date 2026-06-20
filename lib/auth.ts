import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const SECRET = process.env.JWT_SECRET as string;
if (!SECRET) throw new Error("JWT_SECRET env variable is not set");
const COOKIE_NAME = "auth_token";
const EXPIRES_IN = 60 * 60 * 24 * 30;
const BCRYPT_ROUNDS = 12;

function base64UrlEncode(data: Uint8Array): string {
  return Buffer.from(data).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function base64UrlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

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

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

async function sha256Hash(password: string): Promise<string> {
  const salt = process.env.PASSWORD_SALT;
  if (!salt) throw new Error("PASSWORD_SALT env variable is not set");
  const data = new TextEncoder().encode(password + salt);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(
  password: string,
  hash: string | null,
  userId?: string
): Promise<boolean> {
  if (!hash) return false;

  if (isLegacyHash(hash)) {
    const legacy = await sha256Hash(password);
    if (legacy !== hash) return false;
    if (userId) {
      const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    }
    return true;
  }

  return bcrypt.compare(password, hash);
}
