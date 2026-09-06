import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getProvider, SmsApiError } from "@/lib/club/sms";
import type { Balance, AccountProfile } from "@/lib/club/sms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * وضعیت حساب پنل پیامک این کسب‌وکار
 *
 * منبع مشترک برای `/admin/sms` و تنظیمات باشگاه مشتریان. کلید از تنظیمات
 * فروشگاه خوانده می‌شود، پس هر سایت اعتبار پنل خودش را می‌بیند.
 */
export async function GET() {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let provider;
  try {
    provider = await getProvider();
  } catch (err) {
    return NextResponse.json(describe(err));
  }

  // مشخصات حساب نباید خرابی‌اش اعتبار را هم از بین ببرد — جدا رسیدگی می‌شود
  const [balanceRes, profileRes] = await Promise.allSettled([
    provider.getBalance(),
    provider.getProfile(),
  ]);

  if (balanceRes.status === "rejected") {
    return NextResponse.json(describe(balanceRes.reason));
  }

  const balance: Balance = balanceRes.value;
  const profile: AccountProfile | null =
    profileRes.status === "fulfilled" ? profileRes.value : null;

  return NextResponse.json({ balance, profile, error: null });
}

function describe(err: unknown): {
  balance: null;
  profile: null;
  error: { code: string; message: string; fixUrl?: string };
} {
  if (err instanceof SmsApiError) {
    return {
      balance: null,
      profile: null,
      error: {
        code: err.code,
        message: err.message,
        ...(err.fixUrl ? { fixUrl: err.fixUrl } : {}),
      },
    };
  }

  return {
    balance: null,
    profile: null,
    error: {
      code: "UNREACHABLE",
      message: err instanceof Error ? err.message : "خطای نامشخص در ارتباط با پنل پیامک",
    },
  };
}
