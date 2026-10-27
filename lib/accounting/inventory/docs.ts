/**
 * اسناد انبار — انبار و حواله. انبارگردانی در `counts.ts`، موجودی اول دوره در `opening.ts`
 * (هر دو از اینجا هم صادر می‌شوند تا ثبت بازساز سند انبارگردانی با هر بار بارگذاری همین فایل قطعی باشد).
 * docs/plans/accounting.md بخش ۸.
 *
 * هر کدام کاردکس را فقط از `applyMoves` / `removeMoves` تغییر می‌دهد و سند
 * حسابداری‌اش (اگر دارد) را بعد از بازسازی کاردکس از روی همان حرکت‌ها می‌سازد.
 */

import type { AccWarehouse, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import { GLOBAL_SEQ, nextNumber } from "../ledger/sequence";
import type { Actor } from "../ledger/post";
import { applyMoves, assertAvailable, removeMoves } from "./stock";
import { itemTitles } from "./items";
import { createAdjust, ensureReasons, voidAdjust } from "./adjust";
import { faNum } from "../money";

type Tx = Prisma.TransactionClient;

// ── انبار ─────────────────────────────────────────────────────────────

export async function ensureDefaultWarehouse(tx: Tx): Promise<AccWarehouse> {
  const existing = await tx.accWarehouse.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  const any = await tx.accWarehouse.findFirst({ orderBy: { code: "asc" } });
  if (any) return tx.accWarehouse.update({ where: { id: any.id }, data: { isDefault: true } });
  const code = await nextNumber(tx, GLOBAL_SEQ, "warehouse", 1);
  return tx.accWarehouse.create({ data: { code, name: "انبار اصلی", sellable: true, isDefault: true } });
}

export interface WarehouseInput {
  name?: string;
  address?: string | null;
  sellable?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  receiveConfirm?: boolean;
}

export async function saveWarehouse(tx: Tx, id: string | null, input: WarehouseInput): Promise<AccWarehouse> {
  const current = id ? await tx.accWarehouse.findUnique({ where: { id } }) : null;
  if (id && !current) throw new AccError("انبار پیدا نشد", 404);
  const name = input.name !== undefined ? input.name.trim() : current?.name;
  if (!name) throw new AccError("نام انبار را بنویسید");

  if (current && input.isActive === false) {
    if (current.isDefault) throw new AccError("انبار پیش‌فرض غیرفعال نمی‌شود؛ اول انبار دیگری را پیش‌فرض کنید");
    const left = await tx.accStock.findFirst({ where: { warehouseId: current.id, qty: { not: 0 } } });
    if (left) throw new AccError("این انبار هنوز کالا دارد؛ اول با حواله خالی‌اش کنید");
    const coming = await tx.accTransfer.count({ where: { ...IN_TRANSIT, toWarehouseId: current.id } });
    if (coming) throw new AccError(`${faNum(coming)} حواله‌ی در راه به این انبار هست؛ اول دریافت یا باطلش کنید`);
  }
  // قابل فروش بودن، موجودی سایت را جابه‌جا می‌کند — با کالای داخلش عوض نمی‌شود
  if (current && input.sellable !== undefined && input.sellable !== current.sellable) {
    const left = await tx.accStock.findFirst({ where: { warehouseId: current.id, qty: { not: 0 } } });
    if (left) throw new AccError("این انبار کالا دارد؛ «قابل فروش در سایت» فقط برای انبار خالی عوض می‌شود");
  }

  const data = {
    name,
    ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
    ...(input.sellable !== undefined ? { sellable: input.sellable } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.receiveConfirm !== undefined ? { receiveConfirm: input.receiveConfirm } : {}),
  };
  const saved = current
    ? await tx.accWarehouse.update({ where: { id: current.id }, data })
    : await tx.accWarehouse.create({ data: { ...data, code: await nextNumber(tx, GLOBAL_SEQ, "warehouse", 1) } });

  if (input.isDefault) {
    await tx.accWarehouse.updateMany({ where: { id: { not: saved.id } }, data: { isDefault: false } });
    return tx.accWarehouse.update({ where: { id: saved.id }, data: { isDefault: true, isActive: true } });
  }
  return saved;
}

// ── حواله‌ی انتقال ──────────────────────────────────────────────────────

/**
 * حواله به انباری که «دریافت با تأیید» دارد دو مرحله‌ای است (webhesab-parity.md بخش ۸):
 * ثبت فقط `TRANSFER_OUT` مبدأ را می‌زند و حواله «در راه» می‌ماند؛ `receiveTransfer` ورود مقصد را.
 * بها سراسری است، پس در راه بودن سند حسابداری نمی‌خواهد؛ گزارش ارزش موجودی آن را جزو مقصد می‌شمارد.
 */
export async function createTransfer(
  tx: Tx,
  input: { date: Date; fromWarehouseId: string; toWarehouseId: string; note?: string | null; lines: { productId: string; qty: number }[] },
  actor: Actor,
) {
  if (input.fromWarehouseId === input.toWarehouseId) throw new AccError("انبار مبدأ و مقصد یکی‌اند");
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new AccError("دست‌کم یک کالا با تعداد وارد کنید");
  const year = await assertPostable(tx, input.date);
  const to = await tx.accWarehouse.findUnique({ where: { id: input.toWarehouseId } });
  if (!to?.isActive) throw new AccError("انبار مقصد پیدا نشد یا غیرفعال است");
  const titles = await itemTitles(lines.map((l) => l.productId), tx);
  if (titles.size !== new Set(lines.map((l) => l.productId)).size) throw new AccError("کالا پیدا نشد");
  await assertAvailable(tx, lines.map((l) => ({ ...l, title: titles.get(l.productId) })), input.fromWarehouseId, input.date);

  const t = await tx.accTransfer.create({
    data: {
      yearId: year.id,
      number: await nextNumber(tx, year.id, "transfer"),
      date: input.date,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      note: input.note?.trim() || null,
      createdByName: actor.name,
      needsReceipt: to.receiveConfirm,
      lines: { create: lines.map((l) => ({ productId: l.productId, qty: l.qty })) },
    },
    include: { lines: true },
  });
  await applyMoves(
    tx,
    t.lines.flatMap((l) => [
      { productId: l.productId, warehouseId: t.fromWarehouseId, date: t.date, type: "TRANSFER_OUT" as const, qty: l.qty, sourceType: "AccTransfer", sourceId: t.id, sourceLineId: l.id },
      ...(t.needsReceipt
        ? []
        : [{ productId: l.productId, warehouseId: t.toWarehouseId, date: t.date, type: "TRANSFER_IN" as const, qty: l.qty, sourceType: "AccTransfer", sourceId: t.id, sourceLineId: l.id }]),
    ]),
    actor,
  );
  return t;
}

/** حواله‌ی در راه: ارسال‌شده، هنوز تأیید دریافت نشده */
export const IN_TRANSIT = { status: "POSTED", needsReceipt: true, receivedAt: null } satisfies Prisma.AccTransferWhereInput;

export type ShortageMode = "LOSS" | "RETURN";

export interface ReceiveInput {
  date: Date;
  /** تعداد رسیده‌ی هر ردیف؛ ردیفی که نیامده = همه رسیده */
  lines: { lineId: string; qty: number }[];
  /** کسری: LOSS = خروج دستی از مقصد با دلیل (پیش‌فرض «کسری»)، RETURN = برگشت به مبدأ */
  shortage?: ShortageMode;
  reasonId?: string | null;
  note?: string | null;
}

/** تأیید دریافت حواله‌ی در راه — ورود مقصد با تعداد رسیده و تعیین تکلیف کسری */
export async function receiveTransfer(tx: Tx, id: string, input: ReceiveInput, actor: Actor) {
  // قفل ردیف حواله — دو تأیید هم‌زمان دو بار وارد نکنند
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"acctransfer:" + id}))`;
  const t = await tx.accTransfer.findUnique({ where: { id }, include: { lines: true } });
  if (!t) throw new AccError("حواله پیدا نشد", 404);
  if (t.status !== "POSTED") throw new AccError("حواله باطل شده است");
  if (!t.needsReceipt) throw new AccError("این حواله یک‌مرحله‌ای است و تأیید دریافت ندارد");
  if (t.receivedAt) throw new AccError("دریافت این حواله قبلاً تأیید شده است");
  if (input.date < t.date) throw new AccError("تاریخ دریافت پیش از تاریخ حواله نمی‌شود");
  await assertPostable(tx, input.date);

  const got = new Map(input.lines.map((l) => [l.lineId, l.qty]));
  for (const k of got.keys()) if (!t.lines.some((l) => l.id === k)) throw new AccError("ردیف حواله پیدا نشد");
  const rows = t.lines.map((l) => {
    const qty = got.get(l.id) ?? l.qty;
    if (!Number.isInteger(qty) || qty < 0) throw new AccError("تعداد رسیده باید عدد صحیح باشد");
    if (qty > l.qty) throw new AccError("تعداد رسیده از تعداد حواله بیشتر نمی‌شود؛ اضافه را با «ورود و خروج» ثبت کنید");
    return { line: l, received: qty, short: l.qty - qty };
  });
  const short = rows.filter((r) => r.short > 0);
  const mode: ShortageMode | null = short.length ? (input.shortage ?? "LOSS") : null;
  if (mode && mode !== "LOSS" && mode !== "RETURN") throw new AccError("تکلیف کسری را انتخاب کنید");

  const base = { date: input.date, type: "TRANSFER_IN" as const, sourceType: "AccTransfer", sourceId: t.id };
  await applyMoves(
    tx,
    rows.flatMap((r) => {
      // کسریِ «از دست رفته» هم اول وارد مقصد می‌شود و بعد با خروج دستی بیرون می‌رود — ارزش کالای در راه مال مقصد است
      const inDest = mode === "LOSS" ? r.line.qty : r.received;
      return [
        ...(inDest ? [{ ...base, productId: r.line.productId, warehouseId: t.toWarehouseId, qty: inDest, sourceLineId: r.line.id }] : []),
        ...(mode === "RETURN" && r.short ? [{ ...base, productId: r.line.productId, warehouseId: t.fromWarehouseId, qty: r.short, sourceLineId: r.line.id, note: "برگشت کسری به مبدأ" }] : []),
      ];
    }),
    actor,
  );

  let shortageAdjustId: string | null = null;
  if (mode === "LOSS") {
    await ensureReasons(tx);
    const reason = input.reasonId
      ? await tx.accMoveReason.findUnique({ where: { id: input.reasonId } })
      : ((await tx.accMoveReason.findFirst({ where: { direction: "OUT", isActive: true, name: "کسری" } })) ??
        (await tx.accMoveReason.findFirst({ where: { direction: "OUT", isActive: true }, orderBy: { sortOrder: "asc" } })));
    if (!reason) throw new AccError("دلیل خروجی برای کسری تعریف نشده؛ از «ورود و خروج» یک دلیل خروج بسازید", 409);
    const adj = await createAdjust(
      tx,
      {
        date: input.date,
        direction: "OUT",
        reasonId: reason.id,
        warehouseId: t.toWarehouseId,
        note: `کسری دریافت حواله‌ی ${faNum(t.number)}`,
        lines: short.map((r) => ({ productId: r.line.productId, qty: r.short })),
      },
      actor,
    );
    shortageAdjustId = adj.id;
  }

  for (const r of rows) await tx.accTransferLine.update({ where: { id: r.line.id }, data: { receivedQty: r.received } });
  return tx.accTransfer.update({
    where: { id },
    data: { receivedAt: new Date(), receiveDate: input.date, receivedByName: actor.name, receiveNote: input.note?.trim() || null, shortageMode: mode, shortageAdjustId },
  });
}

export async function voidTransfer(tx: Tx, id: string, reason: string, actor: Actor) {
  const t = await tx.accTransfer.findUnique({ where: { id }, include: { lines: true } });
  if (!t) throw new AccError("حواله پیدا نشد", 404);
  if (t.status === "VOID") return t;
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  if (t.shortageAdjustId) await voidAdjust(tx, t.shortageAdjustId, `ابطال حواله‌ی ${faNum(t.number)}: ${reason.trim()}`, actor, { fromTransfer: true });
  // برگرداندن کالا به مبدأ یعنی خروج از هر انباری که ورود گرفته (مقصد، یا مبدأ برای کسری برگشتی) — باید آنجا مانده باشد.
  // حواله‌ی در راه ورودی ندارد و بی‌شرط برمی‌گردد.
  const ins = await tx.accStockMove.findMany({ where: { sourceType: "AccTransfer", sourceId: t.id, type: "TRANSFER_IN" }, select: { productId: true, warehouseId: true, qty: true } });
  const titles = await itemTitles(t.lines.map((l) => l.productId), tx);
  for (const wid of new Set(ins.map((m) => m.warehouseId))) {
    const need = ins.filter((m) => m.warehouseId === wid).map((m) => ({ productId: m.productId, qty: m.qty, title: titles.get(m.productId) }));
    await assertAvailable(tx, need, wid, null, {
      where: wid === t.toWarehouseId ? "انبار مقصد" : "انبار مبدأ",
      verb: "برگرداند (بخشی از آن فروخته یا جابه‌جا شده)",
    });
  }
  await removeMoves(tx, "AccTransfer", t.id, actor);
  return tx.accTransfer.update({ where: { id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
}

// ── انبارگردانی و اول دوره — فایل‌های خودشان ─────────────────────────────

export { OPENING_INV_SOURCE, openingInvKey, saveOpeningInventory, type OpeningInvLine } from "./opening";
export { createCount, postCount, voidCount } from "./counts";
export { createAdjust, voidAdjust };
