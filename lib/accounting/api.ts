/**
 * کمکی‌های مشترک routeهای حسابداری.
 */

import type { StaffAccess } from "@/lib/permissions";
import type { Actor } from "./ledger/post";
import { AccError } from "./errors";
import { parseDay } from "./dates";

export function actorOf(access: StaffAccess): Actor {
  return { id: access.userId, name: access.name };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new AccError("درخواست نامعتبر است");
  return body as T;
}

export function requireDay(v: unknown, label = "تاریخ"): Date {
  const d = parseDay(v);
  if (!d) throw new AccError(`${label} را انتخاب کنید`);
  return d;
}

/** بازه‌ی گزارش از query — هر دو اختیاری */
export function rangeFrom(url: URL): { from: Date | null; to: Date | null } {
  return { from: parseDay(url.searchParams.get("from")), to: parseDay(url.searchParams.get("to")) };
}
