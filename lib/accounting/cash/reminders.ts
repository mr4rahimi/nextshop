/**
 * یادآوری سررسید چک — docs/plans/accounting.md بخش ۹.۲.
 *
 * چک دریافتیِ نزد ما یا در جریان وصول، و چک صادره‌ی منتظر، که سررسیدش فردا
 * (یا گذشته) است ← اعلان درون‌پنلی برای کسانی که مجوز چک دارند، و اگر کارتابل
 * روشن است، یک کار «پیگیری پرداخت» برای ثبت‌کننده‌ی چک.
 *
 * ⚠️ مرز «دو بار نفرست» `reminderSentAt` است و **قبل از** اعلان با تصاحب اتمی
 *    نوشته می‌شود — همان الگوی اقساط اعتباری (`lib/worklist/credit.ts`).
 */

import { prisma } from "@/lib/prisma";
import { formatJalali } from "@/lib/club/jalali";
import { notify, usersWithPermission } from "@/lib/marketing/notifications";
import { FOLLOW_UP_TYPE_SLUG } from "@/lib/worklist/credit";
import { todayKey } from "../dates";
import { formatAmount, faNum } from "../money";

const DAY_MS = 86_400_000;
const TEHRAN_OFFSET_MS = 3.5 * 3_600_000;

export async function runChequeReminders(): Promise<{ notified: number; tasks: number }> {
  const tomorrow = new Date(todayKey().getTime() + DAY_MS);
  const due = await prisma.accCheque.findMany({
    where: {
      reminderSentAt: null,
      dueDate: { lte: tomorrow },
      OR: [{ direction: "RECEIVED", status: { in: ["IN_HAND", "IN_COLLECTION"] } }, { direction: "ISSUED", status: "ISSUED" }],
    },
    include: { party: { select: { name: true } } },
    take: 100,
  });
  if (!due.length) return { notified: 0, tasks: 0 };

  const [recipients, type, store] = await Promise.all([
    usersWithPermission("ACC_CHEQUE"),
    prisma.staffTaskType.findUnique({ where: { slug: FOLLOW_UP_TYPE_SLUG }, select: { id: true, domain: true, channel: true, isActive: true } }),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { worklistEnabled: true } }),
  ]);

  let notified = 0;
  let tasks = 0;
  for (const c of due) {
    const claimed = await prisma.accCheque.updateMany({ where: { id: c.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (!claimed.count) continue;

    const received = c.direction === "RECEIVED";
    const when = c.dueDate < todayKey() ? `سررسید گذشته (${formatJalali(c.dueDate)})` : `سررسید ${formatJalali(c.dueDate)}`;
    const title = received
      ? `وصول چک ${faNum(c.serialNo)} از ${c.party.name} — ${formatAmount(c.amount)} تومان`
      : `پاس شدن چک ${faNum(c.serialNo)} به ${c.party.name} — ${formatAmount(c.amount)} تومان`;
    const body = received
      ? `${when}. ${c.status === "IN_HAND" ? "چک هنوز نزد شماست؛ به بانک بسپارید." : "در جریان وصول است؛ نتیجه را ثبت کنید."}`
      : `${when}. موجودی حساب ${c.bankName} را برای پاس شدن چک بررسی کنید.`;
    const url = `/admin/accounting/cheques/${c.id}`;

    notified += await notify({ userIds: recipients.map((r) => r.id), type: "ACC_CHEQUE", entityId: c.id, title, body, url });

    // کار پیگیری — برای ثبت‌کننده‌ی چک اگر کارمند است، وگرنه اولین کسی که مجوز چک دارد
    if (store?.worklistEnabled && type?.isActive) {
      const owner = (c.createdById && recipients.find((r) => r.id === c.createdById)) || recipients[0];
      if (owner) {
        try {
          const task = await prisma.staffTask.create({
            data: {
              typeId: type.id,
              domain: type.domain,
              channel: type.channel,
              source: "RECURRING",
              title,
              ownerId: owner.id,
              ownerName: owner.name,
              createdByName: "سیستم",
              status: "OPEN",
              priority: c.dueDate < todayKey() ? "URGENT" : "NORMAL",
              amount: c.amount,
              linkUrl: url,
              note: body,
              dueAt: new Date(c.dueDate.getTime() + DAY_MS - TEHRAN_OFFSET_MS - 1),
              occurredAt: new Date(),
              runKey: `cheque:${c.id}:${c.dueDate.toISOString().slice(0, 10)}`,
            },
            select: { id: true },
          });
          await prisma.accCheque.update({ where: { id: c.id }, data: { followUpTaskId: task.id } });
          tasks++;
        } catch (e) {
          if ((e as { code?: string }).code !== "P2002") console.error("[acc-cheque] ساخت کار پیگیری ناموفق:", e);
        }
      }
    }
  }
  return { notified, tasks };
}
