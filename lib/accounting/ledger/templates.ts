/**
 * ورودی سریع (سند الگو) — docs/plans/webhesab-parity.md بخش ۱۹.
 *
 * الگو چند ردیف با حساب و قاعده‌ی مبلغ دارد؛ ثبت آن یک سند دستی عادی می‌سازد
 * (`source=MANUAL`, `sourceId=template:<id>`) که ابطال و معکوسش مثل هر سند دستی است.
 */

import type { AccVoucher, AccTemplateAmount, AccTemplateSide, Prisma, PrismaClient } from "@prisma/client";
import { AccError, toAmount } from "../errors";
import { faNum } from "../money";
import { postVoucher, type Actor, type LineInput } from "./post";
import { calcTemplate, parsePercent, templateShapeError, usesBase } from "./template-calc";

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaClient;

export const TEMPLATE_SOURCE = "template:";
export const templateSourceId = (id: string) => `${TEMPLATE_SOURCE}${id}`;

const SIDES: AccTemplateSide[] = ["DEBIT", "CREDIT"];
const KINDS: AccTemplateAmount[] = ["BASE", "PERCENT", "FIXED", "ASK", "REMAINDER"];

export const TEMPLATE_INCLUDE = {
  lines: {
    orderBy: { seq: "asc" },
    include: {
      account: { select: { id: true, code: true, name: true, detailKind: true } },
      party: { select: { id: true, code: true, name: true, mobile: true } },
      treasury: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AccVoucherTemplateInclude;

export interface TemplateLineBody {
  accountId?: string;
  side?: string;
  kind?: string;
  percent?: unknown;
  fixedAmount?: unknown;
  partyId?: string | null;
  treasuryId?: string | null;
  description?: string | null;
}

export interface TemplateBody {
  name?: string;
  description?: string;
  baseLabel?: string;
  baseAmount?: unknown;
  lines?: TemplateLineBody[];
}

async function parseBody(db: Db, b: TemplateBody) {
  const name = String(b.name ?? "").trim();
  if (!name) throw new AccError("نام الگو را بنویسید");
  if (name.length > 100) throw new AccError("نام الگو طولانی است");
  const description = String(b.description ?? "").trim();
  if (!description) throw new AccError("شرح سند را بنویسید");
  if (!Array.isArray(b.lines)) throw new AccError("ردیف‌های الگو نیامده");

  const baseAmount = toAmount(b.baseAmount, "مبلغ پیش‌فرض");
  if (baseAmount < 0n) throw new AccError("مبلغ پیش‌فرض منفی نمی‌شود");

  const lines = b.lines.map((l, i) => {
    const at = `ردیف ${faNum(i + 1)}`;
    if (!l.accountId) throw new AccError(`${at}: حساب انتخاب نشده`);
    if (!SIDES.includes(l.side as AccTemplateSide)) throw new AccError(`${at}: بدهکار یا بستانکار بودن را مشخص کنید`);
    if (!KINDS.includes(l.kind as AccTemplateAmount)) throw new AccError(`${at}: نوع مبلغ نامعتبر است`);
    const kind = l.kind as AccTemplateAmount;

    let percentBps: number | null = null;
    if (kind === "PERCENT") {
      percentBps = parsePercent(l.percent);
      if (percentBps === null || percentBps <= 0 || percentBps > 10000) throw new AccError(`${at}: درصد باید بیشتر از صفر و تا ۱۰۰ باشد (تا دو رقم اعشار)`);
    }
    let fixedAmount: bigint | null = null;
    if (kind === "FIXED") {
      fixedAmount = toAmount(l.fixedAmount, `${at}: مبلغ`);
      if (fixedAmount <= 0n) throw new AccError(`${at}: مبلغ ثابت را بنویسید`);
    }
    return {
      seq: i + 1,
      accountId: l.accountId,
      side: l.side as AccTemplateSide,
      kind,
      percentBps,
      fixedAmount,
      partyId: l.partyId || null,
      treasuryId: l.treasuryId || null,
      description: l.description?.trim() || null,
    };
  });

  const shape = templateShapeError(lines.map((l) => ({ ...l, key: String(l.seq) })));
  if (shape) throw new AccError(shape);

  const accounts = new Map((await db.accAccount.findMany({ where: { id: { in: lines.map((l) => l.accountId) } } })).map((a) => [a.id, a]));
  lines.forEach((l, i) => {
    const at = `ردیف ${faNum(i + 1)}`;
    const a = accounts.get(l.accountId);
    if (!a) throw new AccError(`${at}: حساب پیدا نشد`);
    if (a.level !== "SUBLEDGER") throw new AccError(`${at}: «${a.name}» حساب معین نیست`);
    if (!a.isActive) throw new AccError(`${at}: حساب «${a.name}» غیرفعال است`);
    // تفصیلی ناسازگار با حساب نگه داشته نمی‌شود
    if (a.detailKind !== "PARTY") l.partyId = null;
    if (a.detailKind !== "TREASURY") l.treasuryId = null;
  });

  return {
    data: {
      name,
      description,
      baseLabel: String(b.baseLabel ?? "").trim() || "مبلغ",
      baseAmount,
    },
    lines,
  };
}

async function assertNameFree(db: Db, name: string, exceptId: string | null) {
  const other = await db.accVoucherTemplate.findUnique({ where: { name }, select: { id: true } });
  if (other && other.id !== exceptId) throw new AccError("الگویی با همین نام هست", 409);
}

export async function createTemplate(tx: Tx, body: TemplateBody, actor: Actor) {
  const { data, lines } = await parseBody(tx, body);
  await assertNameFree(tx, data.name, null);
  return tx.accVoucherTemplate.create({
    data: { ...data, createdById: actor.id ?? null, createdByName: actor.name, lines: { create: lines } },
    include: TEMPLATE_INCLUDE,
  });
}

export async function updateTemplate(tx: Tx, id: string, body: TemplateBody) {
  if (!(await tx.accVoucherTemplate.findUnique({ where: { id }, select: { id: true } }))) throw new AccError("الگو پیدا نشد", 404);
  const { data, lines } = await parseBody(tx, body);
  await assertNameFree(tx, data.name, id);
  await tx.accVoucherTemplateLine.deleteMany({ where: { templateId: id } });
  return tx.accVoucherTemplate.update({ where: { id }, data: { ...data, lines: { create: lines } }, include: TEMPLATE_INCLUDE });
}

export interface TemplateRunInput {
  date: Date;
  base: bigint;
  description?: string | null;
  /** `updatedAt` الگویی که فرم با آن پر شد */
  version?: string | null;
  lines: { id?: string; amount?: unknown; partyId?: string | null; treasuryId?: string | null }[];
}

/** ثبت سند از روی الگو — باید داخل تراکنش صدا زده شود */
export async function runTemplate(tx: Tx, id: string, input: TemplateRunInput, actor: Actor): Promise<AccVoucher> {
  const t = await tx.accVoucherTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
  if (!t) throw new AccError("الگو پیدا نشد", 404);
  // ردیف‌ها با ویرایش الگو از نو ساخته می‌شوند؛ عددی که کاربر دیده دیگر معتبر نیست
  if (input.version && input.version !== t.updatedAt.toISOString()) throw new AccError("این الگو همین حالا ویرایش شد؛ صفحه را تازه کنید و دوباره بررسی کنید", 409);
  if (input.base < 0n) throw new AccError("مبلغ پایه منفی نمی‌شود");
  if (usesBase(t.lines) && input.base === 0n) throw new AccError(`${t.baseLabel} را وارد کنید`);

  const given = new Map(input.lines.filter((l) => l.id).map((l) => [l.id!, l]));
  const asked: Record<string, bigint> = {};
  for (const l of t.lines) {
    if (l.kind !== "ASK") continue;
    const amount = toAmount(given.get(l.id)?.amount, `مبلغ «${l.account.name}»`);
    if (amount < 0n) throw new AccError(`مبلغ «${l.account.name}» منفی نمی‌شود`);
    asked[l.id] = amount;
  }

  const calc = calcTemplate(
    t.lines.map((l) => ({ key: l.id, side: l.side, kind: l.kind, percentBps: l.percentBps, fixedAmount: l.fixedAmount })),
    input.base,
    asked,
  );
  if (calc.negativeRemainder) throw new AccError("با این مبلغ‌ها ردیف «مانده» منفی می‌شود؛ مبلغ‌ها را بررسی کنید");

  const lines: LineInput[] = t.lines
    .filter((l) => calc.amounts[l.id] > 0n)
    .map((l) => {
      const g = given.get(l.id);
      const amount = calc.amounts[l.id];
      return {
        accountId: l.accountId,
        partyId: l.account.detailKind === "PARTY" ? g?.partyId || l.partyId : null,
        treasuryId: l.account.detailKind === "TREASURY" ? g?.treasuryId || l.treasuryId : null,
        debit: l.side === "DEBIT" ? amount : 0n,
        credit: l.side === "CREDIT" ? amount : 0n,
        description: l.description,
      };
    });

  return postVoucher(tx, {
    date: input.date,
    description: input.description?.trim() || t.description,
    source: "MANUAL",
    sourceId: templateSourceId(t.id),
    lines,
    actor,
  });
}

/** تعداد سند معتبر و تاریخ آخرین ثبت هر الگو */
export async function templateUsage(db: Db): Promise<Map<string, { count: number; last: Date | null }>> {
  const rows = await db.accVoucher.groupBy({
    by: ["sourceId"],
    where: { source: "MANUAL", status: "POSTED", sourceId: { startsWith: TEMPLATE_SOURCE } },
    _count: { _all: true },
    _max: { date: true },
  });
  return new Map(rows.map((r) => [r.sourceId!.slice(TEMPLATE_SOURCE.length), { count: r._count._all, last: r._max.date }]));
}
