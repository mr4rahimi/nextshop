import { NextResponse } from "next/server";

/**
 * خطای قابل نمایش به کاربر — پیامش فارسی و بی‌خطر است و مستقیم در پاسخ API می‌رود.
 * هر خطای دیگری «خطای داخلی» نشان داده می‌شود و در لاگ می‌ماند.
 */
export class AccError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "AccError";
  }
}

export function accErrorResponse(e: unknown, tag = "[acc]"): NextResponse {
  if (e instanceof AccError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(tag, e);
  return NextResponse.json({ error: "خطای داخلی — دوباره امتحان کنید" }, { status: 500 });
}

/** ورودی مبلغ از JSON (رشته‌ی رقمی یا عدد صحیح نامنفی) → BigInt */
export function toAmount(v: unknown, field = "مبلغ"): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return BigInt(v.trim());
  if (v === null || v === undefined || v === "") return 0n;
  throw new AccError(`${field} نامعتبر است`);
}
