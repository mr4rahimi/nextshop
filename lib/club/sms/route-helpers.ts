import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPanel, SmsApiError, httpStatusFor, type SmsPanel } from "./index";

/**
 * پوسته‌ی مشترک مسیرهای `/api/admin/sms/*`
 *
 * سه کار را یک‌جا انجام می‌دهد تا در ۱۵ مسیر تکرار نشود: بررسی نقش ادمین،
 * ساختن پنل با کلید همان کسب‌وکار، و ترجمه‌ی `SmsApiError` به کد HTTP درست.
 *
 * ⚠️ عمداً passthrough عمومی نساختیم. هر قابلیت مسیر خودش را دارد تا کسی
 *    نتواند از ادمین ما هر endpoint دلخواهی روی پنل صدا بزند.
 */
export async function withPanel<T>(
  handler: (panel: SmsPanel) => Promise<T>
): Promise<NextResponse> {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let panel: SmsPanel;
  try {
    panel = await getPanel();
  } catch (err) {
    return errorResponse(err);
  }

  try {
    return NextResponse.json(await handler(panel));
  } catch (err) {
    return errorResponse(err);
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof SmsApiError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        ...(err.fixUrl ? { fixUrl: err.fixUrl } : {}),
      },
      { status: httpStatusFor(err.code) }
    );
  }

  return NextResponse.json(
    {
      error: err instanceof Error ? err.message : "خطای نامشخص در ارتباط با پنل پیامک",
      code: "UNREACHABLE",
    },
    { status: 502 }
  );
}

/** خواندن بدنه‌ی JSON با پیام خطای فارسی به‌جای throw خام */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SmsApiError("VALIDATION", "بدنه‌ی درخواست باید یک شیء باشد");
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof SmsApiError) throw err;
    throw new SmsApiError("VALIDATION", "بدنه‌ی درخواست نامعتبر است");
  }
}

export function intParam(url: URL, key: string, fallback: number): number {
  const n = Number(url.searchParams.get(key));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function strParam(url: URL, key: string): string | undefined {
  return url.searchParams.get(key)?.trim() || undefined;
}

export function requireString(body: Record<string, unknown>, key: string, label: string): string {
  const v = body[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new SmsApiError("VALIDATION", `${label} الزامی است`);
  }
  return v.trim();
}

export function requireNumber(body: Record<string, unknown>, key: string, label: string): number {
  const n = Number(body[key]);
  if (!Number.isFinite(n)) throw new SmsApiError("VALIDATION", `${label} نامعتبر است`);
  return n;
}

/** نرمال‌سازی شماره موبایل ایران — ورودی ادمین می‌تواند هر شکلی داشته باشد */
export function normalizeMobile(raw: string): string | null {
  const d = raw
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/\D/g, "");

  if (/^98\d{10}$/.test(d)) return `0${d.slice(2)}`;
  if (/^0?9\d{9}$/.test(d)) return d.length === 10 ? `0${d}` : d;
  return null;
}
