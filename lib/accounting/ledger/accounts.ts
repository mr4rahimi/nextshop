/**
 * سرفصل حساب‌ها — docs/plans/accounting.md بخش ۶.۲ و ۷.
 *
 * ⚠️ کد حساب در کد برنامه hardcode نمی‌شود؛ حساب‌های سیستمی فقط با
 *    `accountByKey` پیدا می‌شوند تا کسب‌وکار بتواند کدگذاری خودش را داشته باشد.
 */

import type { AccAccount, AccClass, AccDetailKind, AccNature, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { DEFAULT_CHART, REQUIRED_KEYS } from "../chart";

type Db = Prisma.TransactionClient | typeof prisma;

export async function accountByKey(db: Db, key: string): Promise<AccAccount> {
  const acc = await db.accAccount.findUnique({ where: { systemKey: key } });
  if (!acc) throw new AccError(await missingAccountMessage(db, [key]));
  return acc;
}

/**
 * متن خطای «حساب سیستمی نیست». بیشترِ وقت‌ها علتش این است که حسابداری داخلی
 * هنوز راه‌اندازی نشده و اصلاً سرفصلی ساخته نشده — همان را به زبان ساده بگو.
 */
export async function missingAccountMessage(db: Db, keys: string[]): Promise<string> {
  const settings = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } });
  if (settings?.mode !== "INTERNAL" || !(await db.accAccount.count())) {
    return "حسابداری داخلی هنوز راه‌اندازی نشده و سرفصل حساب‌ها ساخته نشده است؛ از «حسابداری ← راه‌اندازی» یک بار راه‌اندازی کنید، بعد دوباره ثبت کنید.";
  }
  const names = new Map(DEFAULT_CHART.filter((r) => r[6]).map((r) => [r[6] as string, r[1]]));
  const list = keys.map((k) => `«${names.get(k) ?? k}»`).join("، ");
  return `حساب سیستمی ${list} در سرفصل حساب‌ها نیست. در «حسابداری ← سرفصل حساب‌ها» ببینید این حساب حذف یا جابه‌جا نشده باشد؛ اگر کدش را حساب دیگری گرفته، با پشتیبانی تماس بگیرید.`;
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

/**
 * حساب سیستمی تازه برای نصب‌های قدیمی‌تر از ردیف سرفصل پیش‌فرض — زیر کل `parentCode`
 * (نبودش: اولین کل همان کلاس). شماره‌ی تکراری جابه‌جا نمی‌شود؛ کد خودکار زیر پدر.
 */
export async function ensureSystemAccount(
  db: Db,
  s: { key: string; name: string; parentCode: string; cls: AccClass; nature: AccNature },
): Promise<AccAccount> {
  const hit = await db.accAccount.findUnique({ where: { systemKey: s.key } });
  if (hit) return hit;
  const parent =
    (await db.accAccount.findFirst({ where: { code: s.parentCode, level: "LEDGER" } })) ??
    (await db.accAccount.findFirst({ where: { class: s.cls, level: "LEDGER" }, orderBy: { code: "asc" } }));
  if (!parent) throw new AccError(`سرفصل مناسب برای حساب «${s.name}» پیدا نشد؛ آن را دستی بسازید`);
  const acc = await createAccount(db, { parentId: parent.id, name: s.name });
  return db.accAccount.update({ where: { id: acc.id }, data: { systemKey: s.key, nature: s.nature, detailKind: "NONE" } });
}

/**
 * ردیف‌های تازه‌ی سرفصل پیش‌فرض برای نصب‌های موجود (بخش ۳۴.۵) — idempotent.
 * کد آزاد ← همان کد؛ کد گرفته‌شده ← کد خودکار زیر همان پدر (شماره‌ی کسی جابه‌جا نمی‌شود).
 * گروهی که کدش را گروه کلاس دیگری گرفته ← فرزندانش زیر اولین گروه همان کلاس.
 */
export async function ensureChartRows(db: Db, codes: string[]): Promise<number> {
  const want = new Set(codes);
  const all = await db.accAccount.findMany({ select: { id: true, code: true, level: true, class: true, systemKey: true } });
  if (!all.length) return 0;
  const byCode = new Map(all.map((a) => [a.code, a]));
  const byKey = new Map(all.filter((a) => a.systemKey).map((a) => [a.systemKey as string, a.id]));
  const placed = new Map<string, string>();
  let created = 0;

  for (const [code, name, level, cls, nature, detailKind, systemKey] of DEFAULT_CHART) {
    const hit = byCode.get(code);
    const fits = !!hit && hit.level === level && hit.class === cls;
    if (!want.has(code)) {
      if (fits) placed.set(code, hit!.id);
      continue;
    }
    if (systemKey && byKey.has(systemKey)) {
      placed.set(code, byKey.get(systemKey)!);
      continue;
    }
    if (fits && !systemKey) {
      placed.set(code, hit!.id);
      continue;
    }
    if (level === "GROUP") {
      if (!hit) {
        const g = await db.accAccount.create({ data: { code, name, level, class: cls, nature, detailKind, systemKey } });
        placed.set(code, g.id);
        created++;
      } else {
        const g = await db.accAccount.findFirst({ where: { class: cls, level: "GROUP" }, orderBy: { code: "asc" } });
        if (g) placed.set(code, g.id);
      }
      continue;
    }
    const pc = level === "LEDGER" ? code.slice(0, 1) : code.slice(0, 2);
    const parentId =
      placed.get(pc) ??
      (await db.accAccount.findFirst({ where: { class: cls, level: level === "LEDGER" ? "GROUP" : "LEDGER" }, orderBy: { code: "asc" } }))?.id;
    if (!parentId) continue;
    const row = !hit
      ? await db.accAccount.create({ data: { code, name, level, class: cls, nature, detailKind, systemKey, parentId } })
      : await db.accAccount.update({ where: { id: (await createAccount(db, { parentId, name })).id }, data: { nature, detailKind, systemKey } });
    byCode.set(row.code, { id: row.id, code: row.code, level: row.level, class: row.class, systemKey: row.systemKey });
    if (systemKey) byKey.set(systemKey, row.id);
    placed.set(code, row.id);
    created++;
  }
  return created;
}
