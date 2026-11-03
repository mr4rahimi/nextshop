/**
 * شماره سریال کالا — docs/plans/webhesab-parity.md بخش ۱۴.
 *
 * فقط کالای `hasSerial`. هر واحد یک `AccSerial` (یکتا در هر کالا) و هر گردشش یک
 * `AccSerialMove` با همان منبعی که کاردکس دارد (فاکتور، حواله، ورود و خروج دستی) یا
 * `REGISTER` (ثبت سریال برای موجودی‌ای که بی‌سریال آمده بود).
 *
 *   ورود (خرید، برگشت از فروش، ورود دستی، ثبت)  ← سریال نباید در انبار یا در راه باشد
 *   خروج (فروش، برگشت از خرید، خروج دستی، حواله)  ← سریال در همان انبار، یا سریال تازه به
 *                                                  شرط «موجودی بی‌سریال» (تعداد کاردکس − سریال‌های در انبار)
 *
 * وضعیت هر سریال (`status`, `warehouseId`, …) از آخرین گردشش حساب و نگه داشته می‌شود؛
 * گارانتی سایت هم از همان (`syncWarranty`).
 *
 * ⚠️ همه از `postSerials` می‌گذرند: مجموعه‌ی سریال‌های یک منبع **جایگزین** می‌شود. گردشی که
 *    می‌ماند در جای خودش به‌روز می‌شود؛ گردشی که حذف یا عوض می‌شود نباید گردش بعدیِ سند
 *    دیگری داشته باشد (فروخته‌شده‌ی یک خرید با ابطال خرید بی‌صاحب نمی‌شود).
 * ⚠️ فراخوان پیش از `postSerials` کاردکس را ثبت کرده است (`applyMoves`) — بررسی موجودی
 *    بی‌سریال روی `AccStock` بعد از همین سند است.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import type { Actor } from "../ledger/post";
import { faNum, toLatinDigits } from "../money";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type SerialMoveType =
  | "REGISTER"
  | "PURCHASE"
  | "SALE"
  | "SALE_RETURN"
  | "PURCHASE_RETURN"
  | "ADJUST_IN"
  | "ADJUST_OUT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

export const SERIAL_MOVE_LABELS: Record<SerialMoveType, string> = {
  REGISTER: "ثبت برای موجودی",
  PURCHASE: "خرید",
  SALE: "فروش",
  SALE_RETURN: "برگشت از فروش",
  PURCHASE_RETURN: "برگشت از خرید",
  ADJUST_IN: "ورود دستی",
  ADJUST_OUT: "خروج دستی",
  TRANSFER_OUT: "حواله — خروج",
  TRANSFER_IN: "حواله — ورود",
};

export const SERIAL_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "در انبار",
  TRANSIT: "در راه",
  OUT: "خارج‌شده",
  NEW: "بی‌گردش",
};

const INBOUND: SerialMoveType[] = ["REGISTER", "PURCHASE", "SALE_RETURN", "ADJUST_IN"];
const OUTBOUND: SerialMoveType[] = ["SALE", "PURCHASE_RETURN", "ADJUST_OUT", "TRANSFER_OUT"];

export const REGISTER_SOURCE = "AccSerial";
export const MAX_SERIAL_LEN = 60;
/** سقف سریال در یک بار ثبت (ترتیبی یا اکسل) */
export const MAX_BATCH = 5000;

/** ارقام لاتین، بی فاصله‌ی سر و ته، حروف بزرگ — مثل کد کالا */
export function normalizeSerial(s: unknown): string | null {
  const v = toLatinDigits(String(s ?? ""))
    .replace(/[‌‏‎]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return v || null;
}

/** فهرست سریال از ورودی (آرایه یا متن چندخطی/ویرگولی) — تکراری خطاست */
export function cleanSerialList(raw: unknown, at = ""): string[] {
  const parts = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\n,،;]+/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const v = normalizeSerial(p);
    if (!v) continue;
    if (v.length > MAX_SERIAL_LEN) throw new AccError(`${at}شماره سریال «${v.slice(0, 20)}…» بیش از ${faNum(MAX_SERIAL_LEN)} نویسه است`);
    if (seen.has(v)) throw new AccError(`${at}سریال «${v}» دو بار آمده است`);
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** ساخت ترتیبی مثل وب حساب: پیشوند + از تا، با صفر جلو به طول «از» */
export function sequentialSerials(prefix: string, from: string, to: string): string[] {
  const a = toLatinDigits(from).trim();
  const b = toLatinDigits(to).trim();
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) throw new AccError("«از» و «تا» باید عدد باشند");
  const x = BigInt(a);
  const y = BigInt(b);
  if (y < x) throw new AccError("«تا» از «از» کوچک‌تر است");
  if (y - x + 1n > BigInt(MAX_BATCH)) throw new AccError(`در یک بار حداکثر ${faNum(MAX_BATCH)} سریال ساخته می‌شود`);
  const pad = a.length;
  const p = normalizeSerial(prefix) ?? "";
  const out: string[] = [];
  for (let i = x; i <= y; i++) out.push(p + i.toString().padStart(pad, "0"));
  return out;
}

export interface SerialEntry {
  productId: string;
  warehouseId: string;
  type: SerialMoveType;
  serials: string[];
  sourceLineId?: string | null;
  partyId?: string | null;
  /** برای پیام خطا: «ردیف ۲» */
  label?: string;
  /** برگشتی: فقط سریال‌های ردیف مرجع (اگر ردیف مرجع سریال داشت) */
  allowed?: string[] | null;
}

export interface SerialSource {
  sourceType: string;
  sourceId: string;
  date: Date;
}

type MoveRow = { id: string; serialId: string; date: Date; createdAt: Date; type: string; warehouseId: string; partyId: string | null; sourceType: string; sourceId: string };

const after = (a: MoveRow, b: MoveRow) => a.date > b.date || (a.date.getTime() === b.date.getTime() && (a.createdAt > b.createdAt || (a.createdAt.getTime() === b.createdAt.getTime() && a.id > b.id)));

async function lockItems(tx: Tx, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"accserial:" + id}))`;
}

/** متن کوتاه یک گردش برای پیام: «فروش (فاکتور)» */
async function describe(tx: Tx, m: MoveRow): Promise<string> {
  const label = SERIAL_MOVE_LABELS[m.type as SerialMoveType] ?? m.type;
  if (m.sourceType === "AccInvoice") {
    const inv = await tx.accInvoice.findUnique({ where: { id: m.sourceId }, select: { number: true } });
    return inv?.number ? `${label} شماره‌ی ${faNum(inv.number)}` : label;
  }
  if (m.sourceType === "AccTransfer") {
    const t = await tx.accTransfer.findUnique({ where: { id: m.sourceId }, select: { number: true } });
    return t ? `حواله‌ی ${faNum(t.number)}` : label;
  }
  if (m.sourceType === "AccStockAdjust") {
    const d = await tx.accStockAdjust.findUnique({ where: { id: m.sourceId }, select: { number: true } });
    return d ? `${label} شماره‌ی ${faNum(d.number)}` : label;
  }
  return label;
}

/** وضعیت هر سریال از آخرین گردشش؛ سریال بی‌گردش پاک می‌شود. بعد گارانتی. */
async function resync(tx: Tx, serialIds: string[], keep?: Set<string>) {
  const ids = [...new Set(serialIds)];
  if (!ids.length) return;
  const moves = await tx.accSerialMove.findMany({ where: { serialId: { in: ids } } });
  const last = new Map<string, MoveRow>();
  for (const m of moves) {
    const cur = last.get(m.serialId);
    if (!cur || after(m, cur)) last.set(m.serialId, m);
  }
  const dead: string[] = [];
  for (const id of ids) {
    const m = last.get(id);
    if (!m) {
      if (keep?.has(id)) await tx.accSerial.update({ where: { id }, data: { status: "NEW", warehouseId: null, lastType: null, lastDate: null, partyId: null } });
      else dead.push(id);
      continue;
    }
    const t = m.type as SerialMoveType;
    const status = t === "TRANSFER_OUT" ? "TRANSIT" : t === "TRANSFER_IN" || INBOUND.includes(t) ? "IN_STOCK" : "OUT";
    await tx.accSerial.update({ where: { id }, data: { status, warehouseId: m.warehouseId, lastType: t, lastDate: m.date, partyId: m.partyId } });
  }
  await syncWarranty(tx, ids, last);
  if (dead.length) await tx.accSerial.deleteMany({ where: { id: { in: dead } } });
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/**
 * گارانتی سایت (`Guaranty`) هر سریال: آخرین گردش «فروش» به شخصی با موبایل، روی کالای با مدت
 * گارانتی ← یک گارانتی با `sourceKey` = همان گردش. غیر آن، گارانتی خودکار برداشته می‌شود
 * (اگر درخواست گارانتی ندارد). گارانتی دستی (`sourceKey` خالی) دست نمی‌خورد.
 */
async function syncWarranty(tx: Tx, ids: string[], last: Map<string, MoveRow>) {
  const serials = await tx.accSerial.findMany({ where: { id: { in: ids } }, select: { id: true, serial: true, item: { select: { title: true, warrantyDays: true } } } });
  const existing = new Map(
    (await tx.guaranty.findMany({ where: { serialNumber: { in: serials.map((s) => s.serial) } }, include: { _count: { select: { requests: true } } } })).map((g) => [g.serialNumber, g]),
  );
  for (const s of serials) {
    const m = last.get(s.id);
    const g = existing.get(s.serial);
    const days = s.item.warrantyDays ?? 0;
    const userId = m?.type === "SALE" && days > 0 && m.partyId ? await warrantyUser(tx, m.partyId) : null;
    if (g && !g.sourceKey) continue;
    if (!userId) {
      if (g && !g._count.requests) await tx.guaranty.delete({ where: { id: g.id } });
      continue;
    }
    const data = { userId, productTitle: s.item.title, durationDays: days, startDate: m!.date, endDate: addDays(m!.date, days), sourceKey: m!.id };
    if (g) {
      if (g.sourceKey !== m!.id || g.userId !== userId || g.durationDays !== days) await tx.guaranty.update({ where: { id: g.id }, data });
    } else {
      await tx.guaranty.create({ data: { ...data, serialNumber: s.serial } });
    }
  }
}

/** کاربر سایتِ شخص: وصل‌شده، وگرنه با همان موبایل (ساخته می‌شود، مثل ثبت دستی گارانتی) */
async function warrantyUser(tx: Tx, partyId: string): Promise<string | null> {
  const p = await tx.accParty.findUnique({ where: { id: partyId }, select: { userId: true, mobile: true, name: true } });
  if (!p) return null;
  if (p.userId) return p.userId;
  const phone = p.mobile ? toLatinDigits(p.mobile).replace(/\D/g, "") : "";
  if (!/^09\d{9}$/.test(phone)) return null;
  const u = await tx.user.findUnique({ where: { phone }, select: { id: true } });
  if (u) return u.id;
  const created = await tx.user.create({ data: { phone, firstName: p.name, passwordHash: "", role: "CUSTOMER" }, select: { id: true } });
  return created.id;
}

/**
 * جایگزینی گردش‌های سریال یک منبع. `entries` خالی = برداشتن همه (ابطال).
 * ترتیب `entries` مهم است: «حواله — خروج» پیش از «حواله — ورود» همان سریال.
 */
export async function postSerials(tx: Tx, src: SerialSource, entries: SerialEntry[], actor: Actor): Promise<void> {
  const old = await tx.accSerialMove.findMany({ where: { sourceType: src.sourceType, sourceId: src.sourceId } });
  const wanted = entries.filter((e) => e.serials.length);
  if (!old.length && !wanted.length) return;

  const oldSerials = old.length ? await tx.accSerial.findMany({ where: { id: { in: [...new Set(old.map((m) => m.serialId))] } }, select: { id: true, itemId: true, serial: true } }) : [];
  await lockItems(tx, [...wanted.map((e) => e.productId), ...oldSerials.map((s) => s.itemId)]);

  const items = new Map(
    (await tx.accItem.findMany({ where: { id: { in: [...new Set(wanted.map((e) => e.productId))] } }, select: { id: true, title: true, hasSerial: true } })).map((i) => [i.id, i]),
  );
  const whNames = new Map((await tx.accWarehouse.findMany({ select: { id: true, name: true } })).map((w) => [w.id, w.name]));
  const wh = (id: string | null | undefined) => (id ? whNames.get(id) ?? "?" : "?");

  // ── سریال‌ها (ساخت آن‌هایی که نیستند) ──
  const byKey = new Map(oldSerials.map((s) => [`${s.itemId}|${s.serial}`, s.id]));
  for (const e of wanted) {
    const it = items.get(e.productId);
    if (!it) throw new AccError(`${e.label ?? ""}: کالا پیدا نشد`);
    if (!it.hasSerial) throw new AccError(`${e.label ? e.label + ": " : ""}«${it.title}» سریال‌دار نیست`);
  }
  const need = wanted.flatMap((e) => e.serials.map((s) => ({ itemId: e.productId, serial: s })));
  const found = need.length
    ? await tx.accSerial.findMany({ where: { OR: [...groupBy(need, (n) => n.itemId)].map(([itemId, list]) => ({ itemId, serial: { in: list.map((n) => n.serial) } })) }, select: { id: true, itemId: true, serial: true } })
    : [];
  for (const s of found) byKey.set(`${s.itemId}|${s.serial}`, s.id);
  for (const n of need) {
    const k = `${n.itemId}|${n.serial}`;
    if (byKey.has(k)) continue;
    const s = await tx.accSerial.create({ data: { itemId: n.itemId, serial: n.serial, createdByName: actor.name }, select: { id: true } });
    byKey.set(k, s.id);
  }

  // ── گردش‌های دلخواه ──
  type Want = { serialId: string; serial: string; e: SerialEntry };
  const want: Want[] = [];
  const dup = new Set<string>();
  for (const e of wanted) {
    for (const s of e.serials) {
      const serialId = byKey.get(`${e.productId}|${s}`)!;
      const k = `${serialId}|${e.type}`;
      if (dup.has(k)) throw new AccError(`سریال «${s}» در این سند دو بار آمده است`);
      dup.add(k);
      want.push({ serialId, serial: s, e });
    }
  }
  const oldBy = new Map(old.map((m) => [`${m.serialId}|${m.type}`, m]));
  const serialText = new Map([...byKey].map(([k, id]) => [id, k.split("|").slice(1).join("|")]));

  /** گردش بعدیِ سند دیگری روی همین سریال — نشان می‌دهد این گردش دیگر جابه‌جا نمی‌شود */
  const assertNoLater = async (m: MoveRow) => {
    const others = await tx.accSerialMove.findMany({ where: { serialId: m.serialId, NOT: { sourceType: src.sourceType, sourceId: src.sourceId } } });
    const later = others.filter((o) => after(o, m)).sort((a, b) => (after(a, b) ? 1 : -1))[0];
    if (later) throw new AccError(`سریال «${serialText.get(m.serialId) ?? ""}» بعد از این سند در «${await describe(tx, later)}» آمده؛ اول آن را باطل یا ویرایش کنید`, 409);
  };

  // برداشته‌ها
  const keep = new Set(want.map((w) => `${w.serialId}|${w.e.type}`));
  const removed = old.filter((m) => !keep.has(`${m.serialId}|${m.type}`));
  for (const m of removed) await assertNoLater(m);
  if (removed.length) {
    await tx.accSerialMove.deleteMany({ where: { id: { in: removed.map((m) => m.id) } } });
    await resync(tx, removed.map((m) => m.serialId), new Set(want.map((w) => w.serialId)));
  }

  const untracked = new Map<string, { productId: string; warehouseId: string; serial: string }>();
  for (const w of want) {
    const { e } = w;
    const at = e.label ? `${e.label}: ` : "";
    const prev = oldBy.get(`${w.serialId}|${e.type}`);
    const data = { date: src.date, warehouseId: e.warehouseId, partyId: e.partyId ?? null, sourceLineId: e.sourceLineId ?? null };
    if (prev) {
      if (prev.warehouseId !== e.warehouseId || prev.date.getTime() !== src.date.getTime()) await assertNoLater(prev);
      await tx.accSerialMove.update({ where: { id: prev.id }, data });
      await resync(tx, [w.serialId]);
      continue;
    }
    if (e.allowed?.length && !e.allowed.includes(w.serial)) throw new AccError(`${at}سریال «${w.serial}» در فاکتور مرجع نیست`);
    const s = await tx.accSerial.findUniqueOrThrow({ where: { id: w.serialId } });
    const title = items.get(e.productId)!.title;
    if (INBOUND.includes(e.type)) {
      if (s.status === "IN_STOCK") throw new AccError(`${at}سریال «${w.serial}» (${title}) از قبل در انبار «${wh(s.warehouseId)}» است`, 409);
      if (s.status === "TRANSIT") throw new AccError(`${at}سریال «${w.serial}» (${title}) در راه است`, 409);
    } else if (e.type === "TRANSFER_IN") {
      if (s.status !== "TRANSIT") throw new AccError(`${at}سریال «${w.serial}» در راه نیست`, 409);
    } else if (OUTBOUND.includes(e.type)) {
      if (s.status === "IN_STOCK" && s.warehouseId !== e.warehouseId) throw new AccError(`${at}سریال «${w.serial}» (${title}) در انبار «${wh(s.warehouseId)}» است، نه «${wh(e.warehouseId)}»`, 409);
      if (s.status === "TRANSIT") throw new AccError(`${at}سریال «${w.serial}» (${title}) در راه است`, 409);
      if (s.status === "OUT") {
        const lastMove = await tx.accSerialMove.findFirst({ where: { serialId: s.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
        throw new AccError(`${at}سریال «${w.serial}» (${title}) در انبار نیست — ${lastMove ? await describe(tx, lastMove) : "خارج شده"}`, 409);
      }
      // سریالی که هنوز ثبت نشده: از موجودی بی‌سریال همان انبار
      if (s.status === "NEW") untracked.set(`${e.productId}|${e.warehouseId}`, { productId: e.productId, warehouseId: e.warehouseId, serial: w.serial });
    }
    await tx.accSerialMove.create({
      data: { serialId: w.serialId, type: e.type, ...data, sourceType: src.sourceType, sourceId: src.sourceId, createdByName: actor.name },
    });
    await resync(tx, [w.serialId]);
    if (e.type === "REGISTER") untracked.set(`${e.productId}|${e.warehouseId}`, { productId: e.productId, warehouseId: e.warehouseId, serial: w.serial });
  }

  // سریال‌های در انبار از موجودی کاردکس بیشتر نمی‌شوند (برای سریال تازه‌ای که بیرون رفت یا ثبت شد)
  for (const u of untracked.values()) {
    const [inStock, stock] = await Promise.all([
      tx.accSerial.count({ where: { itemId: u.productId, warehouseId: u.warehouseId, status: "IN_STOCK" } }),
      tx.accStock.findUnique({ where: { productId_warehouseId: { productId: u.productId, warehouseId: u.warehouseId } }, select: { qty: true } }),
    ]);
    const qty = stock?.qty ?? 0;
    if (inStock > Math.max(0, qty)) {
      throw new AccError(
        `سریال «${u.serial}» (${items.get(u.productId)?.title ?? ""}) ثبت نشده و موجودی بی‌سریال «${wh(u.warehouseId)}» کافی نیست — ${faNum(Math.max(0, qty))} عدد در کاردکس، ${faNum(inStock)} سریال در انبار`,
        409,
      );
    }
  }
  // سریال‌های ساخته‌شده‌ای که گردشی نگرفتند (خطای قبل از ثبت جلویش را می‌گیرد؛ این برای اطمینان)
  await tx.accSerial.deleteMany({ where: { id: { in: [...byKey.values()] }, status: "NEW", moves: { none: {} } } });
}

/** برداشتن همه‌ی گردش‌های سریال یک منبع (ابطال) */
export function clearSerials(tx: Tx, sourceType: string, sourceId: string, actor: Actor) {
  return postSerials(tx, { sourceType, sourceId, date: new Date() }, [], actor);
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    const a = m.get(k);
    if (a) a.push(x);
    else m.set(k, [x]);
  }
  return m;
}

// ── ثبت برای موجودی، پاک کردن ───────────────────────────────────────────

/**
 * ثبت سریال برای موجودی فعلی یک انبار (کالایی که بی‌سریال وارد شده، اول دوره).
 * هر بار یک منبع تازه (`REGISTER_SOURCE` + شناسه‌ی دسته) — تا جدا جدا پاک شوند.
 */
export async function registerSerials(tx: Tx, input: { itemId: string; warehouseId: string; date: Date; serials: string[] }, actor: Actor) {
  if (!input.serials.length) throw new AccError("دست‌کم یک شماره سریال بنویسید");
  if (input.serials.length > MAX_BATCH) throw new AccError(`در یک بار حداکثر ${faNum(MAX_BATCH)} سریال ثبت می‌شود`);
  const wh = await tx.accWarehouse.findUnique({ where: { id: input.warehouseId } });
  if (!wh?.isActive) throw new AccError("انبار را انتخاب کنید");
  const batch = `reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await postSerials(tx, { sourceType: REGISTER_SOURCE, sourceId: batch, date: input.date }, [{ productId: input.itemId, warehouseId: input.warehouseId, type: "REGISTER", serials: input.serials }], actor);
  return { count: input.serials.length };
}

/** پاک کردن سریالی که فقط «ثبت برای موجودی» دارد (اشتباه تایپی) */
export async function deleteRegistered(tx: Tx, serialId: string, actor: Actor) {
  const s = await tx.accSerial.findUnique({ where: { id: serialId }, include: { moves: true } });
  if (!s) throw new AccError("سریال پیدا نشد", 404);
  if (s.moves.some((m) => m.sourceType !== REGISTER_SOURCE)) throw new AccError("این سریال گردش دارد (فاکتور، حواله …)؛ فقط سریالِ ثبت‌شده برای موجودی پاک می‌شود — سند آن را ویرایش یا باطل کنید", 409);
  await lockItems(tx, [s.itemId]);
  await tx.accSerialMove.deleteMany({ where: { serialId } });
  await resync(tx, [serialId]);
  return { ok: true, by: actor.name };
}

// ── خواندن ─────────────────────────────────────────────────────────────

export interface SerialFilter {
  q?: string | null;
  itemId?: string | null;
  warehouseId?: string | null;
  status?: string | null;
  take?: number;
}

export async function listSerials(db: Db, f: SerialFilter) {
  const q = normalizeSerial(f.q);
  const where: Prisma.AccSerialWhereInput = {
    ...(f.itemId ? { itemId: f.itemId } : {}),
    ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
    ...(f.status && f.status !== "all" ? { status: f.status } : {}),
    ...(q ? { OR: [{ serial: { contains: q } }, { item: { title: { contains: f.q!.trim(), mode: "insensitive" } } }, { item: { code: q } }] } : {}),
  };
  const take = Math.min(f.take ?? 500, 2000);
  const [rows, total, byStatus] = await Promise.all([
    db.accSerial.findMany({ where, orderBy: [{ updatedAt: "desc" }, { serial: "asc" }], take, include: { item: { select: { id: true, code: true, title: true } } } }),
    db.accSerial.count({ where }),
    db.accSerial.groupBy({ by: ["status"], where: { ...where, status: undefined }, _count: { _all: true } }),
  ]);
  const parties = new Map(
    (await db.accParty.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.partyId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
  );
  return {
    rows: rows.map((r) => ({ ...r, partyName: r.partyId ? parties.get(r.partyId) ?? null : null })),
    total,
    capped: total > rows.length,
    counts: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])),
  };
}

/** سابقه‌ی یک سریال با لینک هر گردش */
export async function serialHistory(db: Db, serialId: string) {
  const s = await db.accSerial.findUnique({ where: { id: serialId }, include: { item: { select: { id: true, code: true, title: true, warrantyDays: true } }, moves: { orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }] } } });
  if (!s) throw new AccError("سریال پیدا نشد", 404);
  const ids = (t: string) => [...new Set(s.moves.filter((m) => m.sourceType === t).map((m) => m.sourceId))];
  const [invoices, transfers, adjusts, parties, whs, guaranty] = await Promise.all([
    db.accInvoice.findMany({ where: { id: { in: ids("AccInvoice") } }, select: { id: true, type: true, number: true } }),
    db.accTransfer.findMany({ where: { id: { in: ids("AccTransfer") } }, select: { id: true, number: true } }),
    db.accStockAdjust.findMany({ where: { id: { in: ids("AccStockAdjust") } }, select: { id: true, number: true } }),
    db.accParty.findMany({ where: { id: { in: [...new Set(s.moves.map((m) => m.partyId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } }),
    db.accWarehouse.findMany({ select: { id: true, name: true } }),
    db.guaranty.findUnique({ where: { serialNumber: s.serial }, select: { id: true, endDate: true, sourceKey: true } }),
  ]);
  const inv = new Map(invoices.map((i) => [i.id, i]));
  const tr = new Map(transfers.map((t) => [t.id, t]));
  const adj = new Map(adjusts.map((a) => [a.id, a]));
  const pn = new Map(parties.map((p) => [p.id, p.name]));
  const wn = new Map(whs.map((w) => [w.id, w.name]));
  return {
    serial: { id: s.id, serial: s.serial, status: s.status, warehouseName: s.warehouseId ? wn.get(s.warehouseId) ?? null : null, item: s.item },
    guaranty: guaranty ? { endDate: guaranty.endDate, auto: !!guaranty.sourceKey } : null,
    moves: s.moves.map((m) => {
      let doc: { label: string; href: string | null } = { label: "", href: null };
      if (m.sourceType === "AccInvoice") {
        const i = inv.get(m.sourceId);
        doc = { label: i?.number ? `شماره‌ی ${faNum(i.number)}` : "فاکتور", href: `/admin/accounting/invoices/${m.sourceId}` };
      } else if (m.sourceType === "AccTransfer") {
        const t = tr.get(m.sourceId);
        doc = { label: t ? `حواله‌ی ${faNum(t.number)}` : "حواله", href: `/admin/accounting/inventory/transfers?id=${m.sourceId}` };
      } else if (m.sourceType === "AccStockAdjust") {
        const a = adj.get(m.sourceId);
        doc = { label: a ? `سند ${faNum(a.number)}` : "ورود و خروج", href: `/admin/accounting/inventory/adjustments/${m.sourceId}` };
      }
      return {
        id: m.id,
        date: m.date,
        type: m.type,
        label: SERIAL_MOVE_LABELS[m.type as SerialMoveType] ?? m.type,
        warehouseName: wn.get(m.warehouseId) ?? null,
        party: m.partyId ? { id: m.partyId, name: pn.get(m.partyId) ?? "" } : null,
        doc,
        createdByName: m.createdByName,
      };
    }),
  };
}

/** سریال‌های در انبار یک کالا در یک انبار — پیشنهاد فرم فروش و صندوق */
export async function availableSerials(db: Db, itemId: string, warehouseId: string, take = 200) {
  const rows = await db.accSerial.findMany({ where: { itemId, warehouseId, status: "IN_STOCK" }, orderBy: { serial: "asc" }, take, select: { serial: true } });
  return rows.map((r) => r.serial);
}

/** یافتن کالا با شماره سریال — اسکن صندوق و جستجو. اول سریال در همین انبار. */
export async function findBySerial(db: Db, raw: string, warehouseId?: string | null) {
  const serial = normalizeSerial(raw);
  if (!serial) return [];
  const rows = await db.accSerial.findMany({ where: { serial }, select: { id: true, itemId: true, serial: true, status: true, warehouseId: true } });
  return rows.sort((a, b) => Number(b.status === "IN_STOCK" && b.warehouseId === warehouseId) - Number(a.status === "IN_STOCK" && a.warehouseId === warehouseId));
}

/** خلاصه‌ی سریال یک کالا — کاردکس */
export async function serialSummary(db: Db, itemId: string) {
  const rows = await db.accSerial.groupBy({ by: ["status", "warehouseId"], where: { itemId }, _count: { _all: true } });
  const stock = await db.accStock.findMany({ where: { productId: itemId }, select: { warehouseId: true, qty: true } });
  const whs = new Map((await db.accWarehouse.findMany({ select: { id: true, name: true } })).map((w) => [w.id, w.name]));
  const inStock = new Map<string, number>();
  for (const r of rows) if (r.status === "IN_STOCK" && r.warehouseId) inStock.set(r.warehouseId, r._count._all);
  return {
    inStock: [...inStock.values()].reduce((a, b) => a + b, 0),
    transit: rows.filter((r) => r.status === "TRANSIT").reduce((a, r) => a + r._count._all, 0),
    out: rows.filter((r) => r.status === "OUT").reduce((a, r) => a + r._count._all, 0),
    /** هر انبار: موجودی کاردکس و سریال‌دار — اختلاف = بی‌سریال (یا سریال بیش از موجودی) */
    warehouses: [...new Set([...stock.map((s) => s.warehouseId), ...inStock.keys()])].map((w) => ({
      warehouseId: w,
      name: whs.get(w) ?? "",
      qty: stock.find((s) => s.warehouseId === w)?.qty ?? 0,
      serials: inStock.get(w) ?? 0,
    })),
  };
}
