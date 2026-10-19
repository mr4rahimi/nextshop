/**
 * انتقال کالاهای موجود از نرم‌افزار قبلی با «کد قبلی چندتنوعی» — docs/plans/inventory-items.md بخش ۱۲.
 *
 *   npx tsx scripts/import-legacy-items.ts <data.json> [--pattern "{G}{M4}{V2}"]
 *
 * ورودی JSON (از خروجی نرم‌افزار قبلی ساخته می‌شود؛ داده‌ی مشتری در مخزن نمی‌ماند):
 *   { source, variantAxes: ["سایز","رنگ",…], fullAxes: ["سایز","رنگ"],
 *     groups: [{name, code?}],
 *     items: [{code, title, group, unit, qty, price (تومان), attrs: {محور: مقدار}, specs: {نام: مقدار}}] }
 *
 * - کد قبلی‌ای که همه‌ی `fullAxes` را دارد یک تنوع کامل است: کالا با کد خودکار تازه
 *   ساخته می‌شود، زیر مدل مشترکِ (گروه + مشخصه‌ها) و کد قبلی `AccItemAlias` آن می‌شود.
 * - بقیه (همه‌ی رنگ/سایزها زیر یک کد) فقط مدل و `AccLegacyItem` می‌گیرند؛ تنوع‌ها در
 *   صفحه‌ی «برچسب‌گذاری دوباره» ساخته می‌شوند.
 * - موجودی وارد کاردکس نمی‌شود (فروش تا روز شروع در نرم‌افزار قبلی است)؛ فقط `legacyQty`.
 * - اجرای دوباره کد قبلیِ واردشده را رد می‌کند.
 */

import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { attrKeyOf, createItem, normalizeItemCode } from "../lib/accounting/inventory/items";
import { autoGroupCodes, ensureModelCode, parsePattern } from "../lib/accounting/inventory/codes";

type Tx = Prisma.TransactionClient;

interface LegacyRow {
  code: string;
  title: string;
  group?: string;
  unit?: string;
  qty: number;
  price?: number | null;
  attrs: Record<string, string>;
  specs: Record<string, string>;
}
interface Data {
  source: string;
  variantAxes: string[];
  fullAxes: string[];
  groups: { name: string; code?: string }[];
  items: LegacyRow[];
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const pi = args.indexOf("--pattern");
const pattern = pi >= 0 ? args[pi + 1] : null;
if (!file) {
  console.error("usage: tsx scripts/import-legacy-items.ts <data.json> [--pattern P]");
  process.exit(1);
}

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** عنوان پایه: نام قبلی، مگر فهرست مشخصه‌ها با «,» باشد که از گروه و مشخصه ساخته می‌شود */
function baseTitle(r: LegacyRow): string {
  if (!r.title.includes(",")) return clean(r.title.replace(/،/g, " ")) || clean(r.group) || r.code;
  const parts = [r.group, r.specs["طرح"], r.specs["مدل"], r.specs["تامین کننده"] ?? r.specs["برند"]].map(clean).filter(Boolean);
  return [...new Set(parts)].join(" ") || r.code;
}

async function main() {
  const data = JSON.parse(readFileSync(file!, "utf8")) as Data;
  if (pattern) parsePattern(pattern);
  const source = clean(data.source) || "نرم‌افزار قبلی";
  console.log(`${data.items.length} کد قبلی، ${data.groups.length} گروه`);

  // ── تنظیم، گروه‌ها و محورها ─────────────────────────────────────────
  const groupIds = new Map<string, string>();
  const axisIds = new Map<string, string>();
  const values = new Map<string, Map<string, string>>(); // axisId ← (مقدار ← id)
  await prisma.$transaction(
    async (tx) => {
      await tx.accSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
      if (pattern) await tx.accSettings.update({ where: { id: "singleton" }, data: { itemCodePattern: pattern } });
      for (const g of data.groups) {
        const name = clean(g.name);
        if (!name) continue;
        const hit = (await tx.accItemGroup.findFirst({ where: { parentId: null, name } })) ?? (await tx.accItemGroup.create({ data: { name } }));
        if (g.code && !hit.code && !(await tx.accItemGroup.findUnique({ where: { code: g.code } }))) await tx.accItemGroup.update({ where: { id: hit.id }, data: { code: g.code } });
        groupIds.set(name, hit.id);
      }
      const coded = await autoGroupCodes(tx);
      if (coded) console.log(`${coded} گروه کد خودکار گرفت`);
      let order = (await tx.accAxis.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
      for (const n of data.variantAxes) {
        const a = (await tx.accAxis.findUnique({ where: { name: n } })) ?? (await tx.accAxis.create({ data: { name: n, sortOrder: ++order } }));
        axisIds.set(n, a.id);
      }
    },
    { timeout: 60_000 },
  );
  for (const [, id] of axisIds) {
    const vs = await prisma.accAxisValue.findMany({ where: { axisId: id } });
    values.set(id, new Map(vs.map((v) => [v.value, v.id])));
  }
  const axisOrder = new Map((await prisma.accAxis.findMany()).map((a) => [a.id, a.sortOrder]));

  async function valueId(tx: Tx, axisId: string, raw: string): Promise<string> {
    const v = clean(raw);
    const m = values.get(axisId)!;
    const hit = m.get(v);
    if (hit) return hit;
    const max = (await tx.accAxisValue.aggregate({ where: { axisId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const created = await tx.accAxisValue.create({ data: { axisId, value: v, sortOrder: max + 1 } });
    m.set(v, created.id);
    return created.id;
  }

  // ── کدهای قبلی ─────────────────────────────────────────────────────
  const done = new Set((await prisma.accLegacyItem.findMany({ select: { code: true } })).map((l) => l.code));
  const modelOf = new Map<string, string>(); // کلید مدل مشترک ← id
  const stats = { full: 0, mixed: 0, dup: 0, skipped: 0, items: 0 };
  const rows = data.items.filter((r) => {
    const c = normalizeItemCode(r.code);
    if (!c || done.has(c)) {
      stats.skipped++;
      return false;
    }
    return true;
  });

  // گذر ۱: مدل و ردیف کد قبلی برای همه — پیش از ساخت هر کد تازه، تا کد خودکار
  // هیچ‌وقت با یک کد قبلی (که برچسبش هنوز روی جنس است) یکی نشود
  const CHUNK = 50;
  const pending: { code: string; modelId: string; title: string; groupId: string | null; unit: string; price: bigint | null; pairs: { axisId: string; valueId: string; value: string }[] }[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await prisma.$transaction(
      async (tx) => {
        for (const r of chunk) {
          const code = normalizeItemCode(r.code)!;
          const groupId = r.group ? (groupIds.get(clean(r.group)) ?? null) : null;
          const base = baseTitle(r);
          const unit = clean(r.unit) || "عدد";
          const price = r.price && r.price > 0 ? BigInt(Math.round(r.price)) : null;
          const pairs: { axisId: string; valueId: string; value: string }[] = [];
          for (const n of data.variantAxes) {
            const v = clean(r.attrs?.[n]);
            if (v) pairs.push({ axisId: axisIds.get(n)!, valueId: await valueId(tx, axisIds.get(n)!, v), value: v });
          }
          pairs.sort((a, b) => (axisOrder.get(a.axisId) ?? 0) - (axisOrder.get(b.axisId) ?? 0));
          const specs = Object.fromEntries(Object.entries(r.specs ?? {}).map(([k, v]) => [clean(k), clean(v)]).filter(([, v]) => v));
          const full = data.fullAxes.every((n) => clean(r.attrs?.[n]));
          const key = full ? `full|${groupId}|${unit}|${base}|${JSON.stringify(Object.entries(specs).sort())}` : `legacy|${code}`;

          let modelId = modelOf.get(key);
          if (!modelId) {
            let title = `${base} · ${code}`;
            for (let k = 2; await tx.accItemModel.findUnique({ where: { title } }); k++) title = `${base} · ${code}-${k}`;
            const m = await tx.accItemModel.create({ data: { title, groupId, specs: { base, unit, specs } } });
            await ensureModelCode(tx, m.id);
            modelId = m.id;
            modelOf.set(key, modelId);
          }
          const title = r.title.includes(",") ? [base, ...pairs.map((p) => p.value)].join(" ") : base;
          await tx.accLegacyItem.create({
            data: {
              code,
              source,
              title,
              modelId,
              attrs: pairs.map(({ axisId, valueId }) => ({ axisId, valueId })),
              legacyQty: Math.max(0, Math.round(r.qty || 0)),
              salePrice: price,
            },
          });
          if (full) pending.push({ code, modelId, title: [base, ...pairs.map((p) => p.value)].join(" "), groupId, unit, price, pairs });
          else stats.mixed++;
        }
      },
      { timeout: 120_000 },
    );
    process.stdout.write(`\rمدل‌ها ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`);
  }
  console.log();

  // گذر ۲: کالای کدهای قبلیِ تنوع کامل، با کد تازه؛ کد قبلی ← کد قبلیِ همان کالا
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    await prisma.$transaction(
      async (tx) => {
        for (const p of chunk) {
          const attrs = p.pairs.map(({ axisId, valueId }) => ({ axisId, valueId }));
          const existing = await tx.accItem.findUnique({ where: { modelId_attrKey: { modelId: p.modelId, attrKey: attrKeyOf(attrs) } }, select: { id: true } });
          let itemId = existing?.id;
          if (itemId) stats.dup++;
          else {
            itemId = (await createItem(tx, { title: p.title, groupId: p.groupId, unit: p.unit, salePrice: p.price }, { modelId: p.modelId, attrs })).id;
            stats.items++;
          }
          await tx.accItemAlias.upsert({ where: { source_code: { source, code: p.code } }, create: { itemId, code: p.code, source }, update: { itemId } });
          await tx.accLegacyItem.update({ where: { code: p.code }, data: { itemId } });
          stats.full++;
        }
      },
      { timeout: 120_000 },
    );
    process.stdout.write(`\rکالاها ${Math.min(i + CHUNK, pending.length)} / ${pending.length}`);
  }
  console.log(
    `\nتنوع کامل: ${stats.full} (کالای تازه ${stats.items}، تکراری ${stats.dup}) · چند رنگ/سایزی: ${stats.mixed} · ردشده (قبلاً وارد شده): ${stats.skipped}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
