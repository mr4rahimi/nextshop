import {
  withPanel,
  readJson,
  intParam,
  strParam,
  normalizeMobile,
} from "@/lib/club/sms/route-helpers";
import { SmsApiError, MAX_BULK_CONTACTS } from "@/lib/club/sms";
import type { ContactInput, ContactPrefix } from "@/lib/club/sms/panel-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIXES: ContactPrefix[] = ["man", "woman", "co", "org"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bookId = Number(url.searchParams.get("phonebookId"));

  return withPanel((panel) =>
    panel.getContacts({
      phonebookId: Number.isFinite(bookId) && bookId > 0 ? bookId : 0,
      page: intParam(url, "page", 1),
      limit: intParam(url, "limit", 30),
      search: strParam(url, "search"),
    })
  );
}

/**
 * افزودن یک یا چند مخاطب
 *
 * ورودی همیشه به‌شکل آرایه دیده می‌شود تا مسیر تکی و دسته‌ای یکی باشد. شماره‌ها
 * اینجا نرمال می‌شوند (فارسی/عربی، +۹۸، بدون صفر) — پنل شماره‌ی بدشکل را با
 * پیام گنگ رد می‌کند.
 */
export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);

    const bookId = Number(body.phonebookId);
    if (!Number.isFinite(bookId) || bookId <= 0) {
      throw new SmsApiError("VALIDATION", "دفترچه‌ی مقصد انتخاب نشده است");
    }

    const raw = Array.isArray(body.contacts) ? body.contacts : [body];
    const contacts: ContactInput[] = [];
    const rejected: string[] = [];

    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;

      const mobileRaw = typeof r.mobile === "string" ? r.mobile : "";
      const mobile = normalizeMobile(mobileRaw);
      if (!mobile) {
        if (mobileRaw.trim()) rejected.push(mobileRaw.trim());
        continue;
      }

      contacts.push({
        mobile,
        ...(typeof r.name === "string" && r.name.trim() ? { name: r.name.trim() } : {}),
        ...(typeof r.prefix === "string" && PREFIXES.includes(r.prefix as ContactPrefix)
          ? { prefix: r.prefix as ContactPrefix }
          : {}),
        ...(Array.isArray(r.attributes)
          ? {
              attributes: r.attributes.flatMap((a) => {
                const x = a as Record<string, unknown>;
                const id = Number(x?.attributeId ?? x?.attribute_id);
                if (!Number.isFinite(id) || id <= 0) return [];
                return [{ attribute_id: id, value: String(x.value ?? "") }];
              }),
            }
          : {}),
      });
    }

    if (contacts.length === 0) {
      throw new SmsApiError("VALIDATION", "هیچ شماره‌ی معتبری در ورودی نبود");
    }

    // تکه‌تکه فرستادن — دسته‌ی بزرگ خود پنل را کند می‌کند و تایم‌اوت می‌دهد
    let added = 0;
    for (let i = 0; i < contacts.length; i += MAX_BULK_CONTACTS) {
      const chunk = contacts.slice(i, i + MAX_BULK_CONTACTS);
      if (chunk.length === 1) {
        await panel.addContact(bookId, chunk[0]);
      } else {
        await panel.addContactsBulk(bookId, chunk);
      }
      added += chunk.length;
    }

    return { success: true, added, rejected };
  });
}
