/**
 * الگوی کد خودکار کالا — docs/plans/inventory-items.md بخش ۱۲.
 *
 * الگو در `AccSettings.itemCodePattern`:
 *   {N}   شماره‌ی پشت‌سرهم سراسری (رفتار قبلی، شمارنده‌ی `acc_item_code_seq`)
 *   {G}   کد گروه کالا (`AccItemGroup.code`، نزدیک‌ترین گروه بالادستِ کددار)
 *   {M4}  شماره‌ی مدل با ۴ رقم — همه‌ی تنوع‌های یک مدل یک پیشوند دارند
 *   {V2}  شماره‌ی تنوع در مدل با ۲ رقم — همیشه آخر الگو
 * نمونه: `{G}{M4}{V2}` ← پیراهن (۱۱)، مدل ۲۳، تنوع ۴ = 11002304.
 *
 * ⚠️ شمارنده‌ها (`AccCodeCounter`، `AccItemModel.nextVariant`) فقط جلو می‌روند؛
 *    کدی که گرفته شده (کالا، کد قبلی کالا یا کد نرم‌افزار قبلی `AccLegacyItem`) رد
 *    می‌شود و شماره‌ی بعدی امتحان می‌شود.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { faNum } from "../money";

type Db = Prisma.TransactionClient | typeof prisma;

export const DEFAULT_CODE_PATTERN = "{N}";

export const CODE_PRESETS = [
  { pattern: "{N}", label: "شماره‌ی پشت‌سرهم", desc: "۱۰۰۱، ۱۰۰۲، … — ساده‌ترین" },
  { pattern: "{G}{M4}{V2}", label: "گروه + مدل + تنوع", desc: "۱۱ ۰۰۲۳ ۰۴ — همه‌ی رنگ و سایزهای یک مدل هم‌پیشوند" },
  { pattern: "{M5}{V2}", label: "مدل + تنوع", desc: "۰۰۰۲۳ ۰۴ — بی کد گروه" },
] as const;

type Token = { kind: "lit"; text: string } | { kind: "N" } | { kind: "G" } | { kind: "M"; width: number } | { kind: "V"; width: number };

/** الگو ← قطعه‌ها؛ الگوی نامعتبر AccError */
export function parsePattern(raw: string): Token[] {
  const p = raw.trim();
  if (!p) throw new AccError("الگوی کد خالی است");
  const out: Token[] = [];
  const re = /\{([A-Za-z])(\d?)\}|([^{}]+)/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(p))) {
    consumed += m[0].length;
    if (m[3] !== undefined) {
      if (!/^[A-Za-z0-9\-_.]+$/.test(m[3])) throw new AccError("در الگو فقط حرف و رقم لاتین، «-» و «_» بنویسید");
      out.push({ kind: "lit", text: m[3].toUpperCase() });
      continue;
    }
    const k = m[1].toUpperCase();
    const w = m[2] ? Number(m[2]) : 0;
    if (k === "N") out.push({ kind: "N" });
    else if (k === "G") out.push({ kind: "G" });
    else if (k === "M") out.push({ kind: "M", width: w || 4 });
    else if (k === "V") out.push({ kind: "V", width: w || 2 });
    else throw new AccError(`«{${m[1]}}» در الگو شناخته نیست — فقط {N}، {G}، {M}، {V}`);
  }
  if (consumed !== p.length) throw new AccError("الگوی کد آکولاد ناقص دارد");
  const has = (k: Token["kind"]) => out.filter((t) => t.kind === k).length;
  if (has("N") > 1 || has("G") > 1 || has("M") > 1 || has("V") > 1) throw new AccError("هر بخش الگو یک بار");
  if (!has("N") && !has("M")) throw new AccError("الگو باید {N} یا {M} داشته باشد تا کدها تکراری نشوند");
  if (has("N") && has("M")) throw new AccError("{N} و {M} با هم نمی‌آیند");
  if (has("V") && !has("M")) throw new AccError("{V} فقط همراه {M}");
  if (has("V") && out[out.length - 1].kind !== "V") throw new AccError("{V} باید آخر الگو باشد");
  return out;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

function render(tokens: Token[], v: { n?: string; g?: string; m?: number; variant?: number }) {
  return tokens
    .map((t) => {
      if (t.kind === "lit") return t.text;
      if (t.kind === "N") return v.n ?? "";
      if (t.kind === "G") return v.g ?? "";
      if (t.kind === "M") return pad(v.m ?? 0, t.width);
      return pad(v.variant ?? 0, t.width);
    })
    .join("");
}

/** نمونه‌ی خوانا برای فرم تنظیمات */
export function patternExample(raw: string): string {
  const t = parsePattern(raw);
  return render(t, { n: "1001", g: "11", m: 23, variant: 4 });
}

export async function getCodePattern(db: Db = prisma): Promise<string> {
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { itemCodePattern: true } });
  return s?.itemCodePattern || DEFAULT_CODE_PATTERN;
}

/** کد کالا، کد قبلی کالا، یا کد نرم‌افزار قبلی (برچسبش هنوز روی جنس است) */
async function codeTaken(db: Db, code: string) {
  const [i, a, l] = await Promise.all([
    db.accItem.findUnique({ where: { code }, select: { id: true } }),
    db.accItemAlias.findFirst({ where: { code }, select: { id: true } }),
    db.accLegacyItem.findUnique({ where: { code }, select: { code: true } }),
  ]);
  return !!(i || a || l);
}

/** کد نزدیک‌ترین گروه کددار (خود گروه یا بالادست) */
export async function groupCodeOf(db: Db, groupId: string | null | undefined): Promise<string | null> {
  let cur = groupId ?? null;
  for (let i = 0; cur && i < 20; i++) {
    const g: { code: string | null; parentId: string | null } | null = await db.accItemGroup.findUnique({ where: { id: cur }, select: { code: true, parentId: true } });
    if (!g) return null;
    if (g.code) return g.code;
    cur = g.parentId;
  }
  return null;
}

async function bump(db: Db, key: string): Promise<number> {
  const [r] = await db.$queryRaw<{ value: number }[]>`
    INSERT INTO "AccCodeCounter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "AccCodeCounter"."value" + 1
    RETURNING "value"`;
  return Number(r.value);
}

/** پیشوند مدل (الگو بی {V}) — شماره‌ی مدل تازه از شمارنده‌ی گروه */
async function newModelPrefix(db: Db, tokens: Token[], groupId: string | null | undefined): Promise<string> {
  const usesG = tokens.some((t) => t.kind === "G");
  const g = usesG ? ((await groupCodeOf(db, groupId)) ?? "00") : "";
  const head = tokens.filter((t) => t.kind !== "V");
  for (let i = 0; i < 1000; i++) {
    const m = await bump(db, usesG ? `M:${g}` : "M");
    const prefix = render(head, { g, m });
    const clash = await db.accItemModel.findUnique({ where: { code: prefix }, select: { id: true } });
    if (!clash) return prefix;
  }
  throw new AccError("کد مدل آزاد پیدا نشد — الگوی کد را بزرگ‌تر کنید");
}

/**
 * کد مدل طبق الگو — مدلی که کد دارد همان را نگه می‌دارد. الگوی {N} کد مدل نمی‌خواهد (null).
 */
export async function ensureModelCode(db: Prisma.TransactionClient, modelId: string, pattern?: string): Promise<string | null> {
  const tokens = parsePattern(pattern ?? (await getCodePattern(db)));
  if (!tokens.some((t) => t.kind === "M")) return null;
  const model = await db.accItemModel.findUnique({ where: { id: modelId }, select: { code: true, groupId: true } });
  if (!model) throw new AccError("مدل پیدا نشد");
  if (model.code) return model.code;
  const code = await newModelPrefix(db, tokens, model.groupId);
  await db.accItemModel.update({ where: { id: modelId }, data: { code } });
  return code;
}

/**
 * کد خودکار کالای تازه. کالای مدل‌دار پیشوند مدل + شماره‌ی تنوع بعدی؛ کالای
 * بی‌مدل در الگوی {M} یک شماره‌ی مدل تازه با تنوع صفر می‌گیرد.
 */
export async function allocItemCode(db: Prisma.TransactionClient, opts: { groupId?: string | null; modelId?: string | null }): Promise<string> {
  const pattern = await getCodePattern(db);
  const tokens = parsePattern(pattern);
  if (tokens.some((t) => t.kind === "N")) {
    for (let i = 0; i < 1000; i++) {
      const [r] = await db.$queryRaw<{ c: string }[]>`SELECT acc_next_item_code() AS c`;
      const g = (await groupCodeOf(db, opts.groupId)) ?? "00";
      const code = pattern.trim() === "{N}" ? r.c : render(tokens, { n: r.c, g });
      if (!(await codeTaken(db, code))) return code;
    }
    throw new AccError("کد آزاد پیدا نشد");
  }
  const hasV = tokens.some((t) => t.kind === "V");
  const vTok = tokens.find((t) => t.kind === "V") as { width: number } | undefined;
  if (opts.modelId && hasV) {
    const prefix = await ensureModelCode(db, opts.modelId, pattern);
    for (let i = 0; i < 1000; i++) {
      const m = await db.accItemModel.update({ where: { id: opts.modelId }, data: { nextVariant: { increment: 1 } }, select: { nextVariant: true } });
      const v = m.nextVariant - 1;
      const code = `${prefix}${pad(v, vTok!.width)}`;
      if (!(await codeTaken(db, code))) return code;
    }
    throw new AccError(`تنوع‌های مدل از ${faNum(10 ** vTok!.width - 1)} گذشت — رقم‌های {V} را بیشتر کنید`);
  }
  for (let i = 0; i < 1000; i++) {
    const prefix = await newModelPrefix(db, tokens, opts.groupId);
    const code = hasV ? `${prefix}${pad(0, vTok!.width)}` : prefix;
    if (!(await codeTaken(db, code))) return code;
  }
  throw new AccError("کد آزاد پیدا نشد");
}

/** جای خالی فرم کالا — الگوی ساده شماره‌ی بعدی، بقیه «خودکار» */
export async function peekCodeHint(db: Db = prisma): Promise<string> {
  const pattern = await getCodePattern(db);
  if (pattern.trim() !== "{N}") return "خودکار";
  const [r] = await db.$queryRaw<{ c: string }[]>`SELECT acc_peek_item_code() AS c`;
  return r.c;
}

/** کد گروه‌های بی‌کد — پشت‌سرهم از بزرگ‌ترین کد عددی موجود (حداقل ۱۱) */
export async function autoGroupCodes(db: Prisma.TransactionClient): Promise<number> {
  const groups = await db.accItemGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, code: true } });
  const nums = groups.map((g) => (g.code && /^\d+$/.test(g.code) ? Number(g.code) : 0));
  let next = Math.max(10, ...nums) + 1;
  let n = 0;
  for (const g of groups) {
    if (g.code) continue;
    await db.accItemGroup.update({ where: { id: g.id }, data: { code: String(next++) } });
    n++;
  }
  return n;
}
