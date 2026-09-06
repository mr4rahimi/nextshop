import { withPanel, readJson } from "@/lib/club/sms/route-helpers";
import { SmsApiError } from "@/lib/club/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** حداقل و حداکثر شارژ در یک تراکنش (تومان) */
const MIN_AMOUNT = 10_000;
const MAX_AMOUNT = 50_000_000;

/**
 * شارژ کیف پول پنل پیامک
 *
 * آدرس بازگشت از روی خودِ درخواست ساخته می‌شود، نه از بدنه — وگرنه هر کسی که
 * به این مسیر برسد می‌تواند کاربر را بعد از پرداخت به دامنه‌ی دلخواه ببرد.
 */
export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new SmsApiError("VALIDATION", "مبلغ نامعتبر است");
    }
    if (amount < MIN_AMOUNT) {
      throw new SmsApiError(
        "VALIDATION",
        `حداقل مبلغ شارژ ${MIN_AMOUNT.toLocaleString("fa-IR")} تومان است`
      );
    }
    if (amount > MAX_AMOUNT) {
      throw new SmsApiError(
        "VALIDATION",
        `حداکثر مبلغ شارژ ${MAX_AMOUNT.toLocaleString("fa-IR")} تومان است`
      );
    }

    const origin = new URL(req.url).origin;
    const result = await panel.chargeWallet(amount, `${origin}/admin/sms/wallet?charged=1`);

    if (!result.payUrl) {
      throw new SmsApiError(
        "BAD_RESPONSE",
        "پنل آدرس درگاه پرداخت را برنگرداند. شارژ از خود پنل ایران‌پیامک انجام دهید."
      );
    }

    return { payUrl: result.payUrl };
  });
}
