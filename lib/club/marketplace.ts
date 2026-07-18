import { normalizePhone } from "./phone";
import { upsertClubCustomer } from "./profile";

/**
 * عضویت خودکار مشتریان مارکت‌پلیس در باشگاه
 *
 * ⚠️ این تابع **هرگز throw نمی‌کند**. اگر عضویت با خطا مواجه شود، فقط لاگ
 * می‌شود. ثبت سفارش هیچ‌وقت نباید به‌خاطر باشگاه مشتریان شکست بخورد.
 *
 * رضایت پیامک تبلیغاتی همیشه `false` است — این افراد در پلتفرم دیگری خرید
 * کرده‌اند و هرگز به ما رضایت صریح نداده‌اند.
 */

export interface MarketplaceEnrollInput {
  /** کد پلتفرم مطابق IntegPlatform.code — مثل "basalam" یا "tapsi_shop" */
  platformCode: string;
  phone?: string | null;
  name?: string | null;
}

export async function enrollMarketplaceCustomer(
  input: MarketplaceEnrollInput
): Promise<void> {
  try {
    const phone = normalizePhone(input.phone);
    if (!phone) return; // شماره ندارد یا نامعتبر است — بی‌صدا رد شو

    const { firstName, lastName } = splitName(input.name);

    const result = await upsertClubCustomer({
      phone,
      firstName,
      lastName,
      source: "MARKETPLACE",
      sourcePlatform: input.platformCode,
      smsConsent: false, // ← رضایت صریح نداده‌اند
    });

    if (result.isNewProfile) {
      console.log(
        `[club] عضو جدید از ${input.platformCode}: ${maskForLog(phone)}`
      );
    }
  } catch (err) {
    console.error("[club] عضویت خودکار مارکت‌پلیس ناموفق:", err);
  }
}

/**
 * تفکیک نام کامل به نام و نام خانوادگی.
 * اولین بخش = نام، بقیه = نام خانوادگی (مناسب نام‌های فارسی).
 */
function splitName(full?: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  const t = full?.trim().replace(/\s+/g, " ");
  if (!t) return { firstName: null, lastName: null };

  const parts = t.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: null };

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function maskForLog(phone: string): string {
  return `${phone.slice(0, 4)}***${phone.slice(7)}`;
}
