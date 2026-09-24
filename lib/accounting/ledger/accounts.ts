/**
 * سرفصل حساب‌ها — docs/plans/accounting.md بخش ۶.۲ و ۷.
 *
 * ⚠️ کد حساب در کد برنامه hardcode نمی‌شود؛ حساب‌های سیستمی فقط با
 *    `accountByKey` پیدا می‌شوند تا کسب‌وکار بتواند کدگذاری خودش را داشته باشد.
 */

import type { AccAccount, AccDetailKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { DEFAULT_CHART, REQUIRED_KEYS } from "../chart";

type Db = Prisma.TransactionClient | typeof prisma;

export async function accountByKey(db: Db, key: string): Promise<AccAccount> {
  const acc = await db.accAccount.findUnique({ where: { systemKey: key } });
  if (!acc) throw new AccError(`حساب سیستمی «${key}» در سرفصل نیست — سرفصل پیش‌فرض را دوباره بسازید`);
  return acc;
}

/**
 * ساخت سرفصل پیش‌فرض — idempotent: ردیفی که کدش هست دست نمی‌خورد (نامی که
 * کسب‌وکار عوض کرده می‌ماند)، فقط ردیف‌های نبوده ساخته می‌شوند.
 */
export async function seedDefaultChart(db: Db): Promise<number> {
  let created = 0;
  const idByCode = new Map<string, string>();
  for (const a of await db.accAccount.findMany({ select: { id: true, code: true } })) idByCode.set(a.code, a.id);

  for (const [code, name, level, cls, nature, detailKind, systemKey] of DEFAULT_CHART) {
    if (idByCode.has(code)) continue;
    // کلید سیستمی ممکن است روی حسابی با کد دیگر نشسته باشد (کدگذاری خود کسب‌وکار)
    if (systemKey && (await db.accAccount.findUnique({ where: { systemKey } }))) continue;
    const parentCode = level === "GROUP" ? null : level === "LEDGER" ? code.slice(0, 1) : code.slice(0, 2);
    const row = await db.accAccount.create({
      data: {
        code,
        name,
        level,
        class: cls,
        nature,
        detailKind,
        systemKey,
        parentId: parentCode ? idByCode.get(parentCode) ?? null : null,
      },
    });
    idByCode.set(code, row.id);
    created++;
  }
  return created;
}

export async function missingSystemKeys(db: Db = prisma): Promise<string[]> {
  const rows = await db.accAccount.findMany({ where: { systemKey: { in: REQUIRED_KEYS } }, select: { systemKey: true } });
  const have = new Set(rows.map((r) => r.systemKey));
  return REQUIRED_KEYS.filter((k) => !have.has(k));
}

/** حساب تازه زیر یک گروه (← کل) یا یک کل (← معین). کد خودکار: کد پدر + دو رقم. */
export async function createAccount(
  db: Db,
  input: { parentId: string; name: string; code?: string; detailKind?: AccDetailKind },
): Promise<AccAccount> {
  const parent = await db.accAccount.findUnique({ where: { id: input.parentId } });
  if (!parent) throw new AccError("حساب بالادستی پیدا نشد", 404);
  if (parent.level === "SUBLEDGER") throw new AccError("زیر حساب معین نمی‌شود حساب ساخت");
  const name = input.name.trim();
  if (!name) throw new AccError("نام حساب را بنویسید");

  const level = parent.level === "GROUP" ? "LEDGER" : "SUBLEDGER";
  let code = input.code?.trim();
  if (code) {
    if (!/^\d+$/.test(code) || !code.startsWith(parent.code) || code.length <= parent.code.length) {
      throw new AccError(`کد باید عددی و با کد حساب بالادستی (${parent.code}) شروع شود`);
    }
  } else {
    const siblings = await db.accAccount.findMany({ where: { parentId: parent.id }, select: { code: true } });
    const width = level === "LEDGER" ? 1 : 2;
    let n = 1;
    const used = new Set(siblings.map((s) => s.code));
    while (used.has(parent.code + String(n).padStart(width, "0"))) n++;
    code = parent.code + String(n).padStart(width, "0");
  }
  if (await db.accAccount.findUnique({ where: { code } })) throw new AccError(`کد ${code} قبلاً استفاده شده است`, 409);

  return db.accAccount.create({
    data: {
      code,
      name,
      level,
      parentId: parent.id,
      class: parent.class,
      nature: parent.nature,
      detailKind: level === "SUBLEDGER" ? input.detailKind ?? "NONE" : "NONE",
    },
  });
}

export async function updateAccount(
  db: Db,
  id: string,
  input: { name?: string; detailKind?: AccDetailKind; isActive?: boolean },
): Promise<AccAccount> {
  const acc = await db.accAccount.findUnique({ where: { id } });
  if (!acc) throw new AccError("حساب پیدا نشد", 404);
  const data: Prisma.AccAccountUpdateInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AccError("نام حساب خالی نمی‌شود");
    data.name = name;
  }
  if (input.detailKind !== undefined && input.detailKind !== acc.detailKind) {
    if (acc.systemKey) throw new AccError("تفصیلی حساب سیستمی قابل تغییر نیست");
    if (acc.level !== "SUBLEDGER") throw new AccError("تفصیلی فقط روی حساب معین معنا دارد");
    // تغییر تفصیلی روی حسابی که ردیف دارد، ناوردای ۳ ردیف‌های قبلی را می‌شکند
    if (await db.accVoucherLine.count({ where: { accountId: id } })) {
      throw new AccError("این حساب سند دارد؛ نوع تفصیلی‌اش عوض نمی‌شود. یک حساب تازه بسازید");
    }
    data.detailKind = input.detailKind;
  }
  if (input.isActive !== undefined && input.isActive !== acc.isActive) {
    if (acc.systemKey && !input.isActive) throw new AccError("حساب سیستمی غیرفعال نمی‌شود");
    data.isActive = input.isActive;
  }
  return db.accAccount.update({ where: { id }, data });
}
