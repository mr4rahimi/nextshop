/**
 * حسابداری داخلی — مصرف‌کننده‌ی رویدادها.
 *
 * هر نوع رویداد در فاز خودش وصل می‌شود (docs/plans/accounting.md بخش ۵ و ۲۰).
 * تا آن وقت رویداد «مسدود» می‌ماند، نه «ثبت‌شده»: اگر حالت داخلی زودتر از
 * مصرف‌کننده روشن شود، رویداد گم نمی‌شود و بعد از وصل شدن خودش پردازش می‌شود.
 */

import type { AccEvent } from "@prisma/client";
import type { AccountingProvider, ApplyResult } from "../port";

type Handler = (event: AccEvent) => Promise<ApplyResult>;

const HANDLERS: Partial<Record<string, Handler>> = {};

export const internalProvider: AccountingProvider = {
  async apply(event) {
    const handler = HANDLERS[event.type];
    if (!handler) {
      return { kind: "blocked", reason: "حسابداری داخلی هنوز این نوع رویداد را ثبت نمی‌کند" };
    }
    return handler(event);
  },
};
