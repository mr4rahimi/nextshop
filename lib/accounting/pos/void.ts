/**
 * ابطال رسید صندوق — docs/plans/inventory-items.md بخش ۱۳.۳.
 *
 * رسید یک بسته است: فاکتور فروش و/یا برگشت از فروش، دریافت (نقد، کارت، کارت به کارت، کارت اشتراک،
 * بن)، سند پس دادن، دفتر اعتبار کارت اشتراک، گردش بن و مصرف کد تخفیف. ابطال فاکتور به‌تنهایی
 * ممکن نیست («دریافت ثبت شده؛ اول آن را جدا کنید») — این‌جا همه با هم، در یک تراکنش، برمی‌گردند.
 *
 * صندوقدار فقط «درخواست» می‌دهد؛ مدیر صندوق (`ACC_POS_MANAGE`) تأیید یا رد می‌کند، یا خودش مستقیم باطل می‌کند.
 * رسیدی که مرجوعی/تعویض بعدی دارد اول باید آن‌ها باطل شوند.
 *
 * ⚠️ رسید شیفت بسته: نقدِ دریافت از مانده‌ی دفتری صندوق کم می‌شود (شیفت بعد کسری نشان ندهد، پول باید واقعاً
 *    پس داده یا جابه‌جا شود). رابط همین را پیش از تأیید می‌گوید.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { voidVoucher, type Actor } from "../ledger/post";
import { voidMoneyDoc } from "../cash/docs";
import { voidInvoice } from "../invoices/service";
import { undoTicketGifts } from "../gift-cards";
import { faNum } from "../money";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const CLUB_REF_TYPES = ["pos", "pos_return_credit", "pos_return_earn"];

async function lockTicket(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "AccPosTicket" WHERE id = ${id} FOR UPDATE`;
  const t = await tx.accPosTicket.findUnique({ where: { id }, include: { shift: { select: { status: true, number: true } } } });
  if (!t) throw new AccError("رسید پیدا نشد", 404);
  if (t.voidedAt) throw new AccError(`رسید ${faNum(t.number)} قبلاً باطل شده`, 409);
  return t;
}

const cleanReason = (r: string) => {
  const t = r.trim().slice(0, 300);
  if (t.length < 3) throw new AccError("دلیل ابطال را بنویسید (مثلاً «کالا اشتباه اسکن شد»)");
  return t;
};

/** صندوقدار: درخواست ابطال برای تأیید مدیر */
export async function requestVoid(tx: Tx, id: string, reason: string, actor: Actor) {
  const t = await lockTicket(tx, id);
  const r = cleanReason(reason);
  if (t.voidRequestedAt) throw new AccError(`برای رسید ${faNum(t.number)} درخواست ابطال فرستاده شده؛ منتظر تأیید مدیر است`, 409);
  await assertNoLaterReturns(tx, t.id);
  return tx.accPosTicket.update({ where: { id }, data: { voidRequestedAt: new Date(), voidRequestedByName: actor.name, voidRequestReason: r, voidRejectNote: null } });
}

/** مدیر: رد درخواست */
export async function rejectVoid(tx: Tx, id: string, note: string, actor: Actor) {
  const t = await lockTicket(tx, id);
  if (!t.voidRequestedAt) throw new AccError("درخواست ابطالی برای این رسید نیست", 409);
  return tx.accPosTicket.update({
    where: { id },
    data: { voidRequestedAt: null, voidRejectNote: `${note.trim() || "رد شد"} — ${actor.name}` },
  });
}

async function assertNoLaterReturns(tx: Tx, id: string) {
  const later = await tx.accPosTicket.findMany({ where: { refTicketId: id, voidedAt: null }, select: { number: true } });
  if (later.length) {
    throw new AccError(`از این رسید مرجوعی/تعویض ثبت شده (رسید ${later.map((x) => faNum(x.number)).join("، ")})؛ اول آن را باطل کنید`, 409);
  }
}

/**
 * مدیر: ابطال کامل. ترتیب عکس ثبت — پول ← بن ← کارت اشتراک ← کد تخفیف ← فاکتورها (موجودی و سریال برمی‌گردد).
 */
export async function voidTicket(tx: Tx, id: string, reason: string, actor: Actor) {
  const t = await lockTicket(tx, id);
  const r = cleanReason(reason || t.voidRequestReason || "");
  await assertNoLaterReturns(tx, t.id);
  const why = `ابطال رسید صندوق ${faNum(t.number)}: ${r}`;

  if (t.receiptDocId) await voidMoneyDoc(tx, t.receiptDocId, why, actor);
  if (t.refundVoucherId) await voidVoucher(tx, t.refundVoucherId, why, actor, { fromSource: true });

  await undoTicketGifts(tx, t.id, r, actor);

  // دفتر اعتبار: ردیف‌های همین رسید حذف می‌شوند (انگار نبوده) — سوخت ثبت‌شده روی شارژ همین رسید هم
  const pts = await tx.pointTransaction.findMany({ where: { refId: t.id, refType: { in: CLUB_REF_TYPES } }, select: { id: true } });
  if (pts.length) {
    const ids = pts.map((p) => p.id);
    await tx.pointTransaction.deleteMany({ where: { OR: [{ id: { in: ids } }, { refType: "lot", refId: { in: ids } }] } });
  }

  const red = await tx.couponRedemption.findFirst({ where: { posTicketId: t.id } });
  if (red) {
    await tx.couponRedemption.delete({ where: { id: red.id } });
    await tx.coupon.update({ where: { id: red.couponId }, data: { usedCount: { decrement: 1 } } });
  }

  if (t.returnInvoiceId) await voidInvoice(tx, t.returnInvoiceId, why, actor);
  if (t.saleInvoiceId) await voidInvoice(tx, t.saleInvoiceId, why, actor);

  return tx.accPosTicket.update({
    where: { id },
    data: {
      voidedAt: new Date(),
      voidedByName: actor.name,
      voidReason: r,
      voidRequestedAt: null,
    },
  });
}

/** رسید صندوقِ یک فاکتور (فروش یا برگشت) — برای دکمه‌ی ابطال صفحه‌ی فاکتور */
export async function ticketOfInvoice(db: Db, invoiceId: string) {
  return db.accPosTicket.findFirst({
    where: { OR: [{ saleInvoiceId: invoiceId }, { returnInvoiceId: invoiceId }] },
    select: { id: true, number: true, voidedAt: true, voidRequestedAt: true, voidRequestedByName: true, voidRequestReason: true, voidRejectNote: true, shift: { select: { status: true } } },
  });
}

/** درخواست‌های منتظر تأیید — برای مدیر صندوق */
export async function pendingVoids(db: Db) {
  return db.accPosTicket.findMany({
    where: { voidRequestedAt: { not: null }, voidedAt: null },
    orderBy: { voidRequestedAt: "asc" },
    take: 100,
    select: {
      id: true,
      number: true,
      kind: true,
      createdAt: true,
      partyName: true,
      saleTotal: true,
      returnTotal: true,
      cash: true,
      card: true,
      transfer: true,
      credit: true,
      voidRequestedAt: true,
      voidRequestedByName: true,
      voidRequestReason: true,
      terminal: { select: { name: true } },
      shift: { select: { status: true, number: true } },
    },
  });
}
