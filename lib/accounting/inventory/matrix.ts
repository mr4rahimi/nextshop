/**
 * ساخت ماتریسی کالا — مدل × رنگ × سایز — docs/plans/inventory-items.md بخش ۴.
 *
 * هر ترکیب یک `AccItem` با کد خودکار پشت‌سرهم (سؤال باز ۱ ← «عددی پشت‌سرهم»)،
 * عنوان «مدل + مقدارها» و قیمت مشترک. ترکیبی که در مدل هست دوباره ساخته نمی‌شود
 * (`@@unique([modelId, attrKey])`)؛ پس ماتریس روی مدل موجود فقط ترکیب‌های تازه را
 * اضافه می‌کند.
 */

import type { Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { ensureAxisValues } from "./catalog";
import { attrKeyOf, createItem, normalizeItemCode } from "./items";

type Tx = Prisma.TransactionClient;

export const MATRIX_MAX = 300;

export interface MatrixInput {
  /** مدل موجود، یا عنوان مدل تازه */
  modelId?: string | null;
  modelTitle?: string | null;
  groupId?: string | null;
  unit?: string | null;
  salePrice?: bigint | null;
  axes: { axisId: string; values: string[] }[];
  /** بازنویسی هر ردیف — کلید `key` پیش‌نمایش */
  rows?: Record<string, { title?: string; code?: string | null; barcode?: string | null; salePrice?: bigint | null; skip?: boolean }>;
}

export interface MatrixRow {
  /** «رنگ=آبی|سایز=L» — پایدار بین پیش‌نمایش و ثبت */
  key: string;
  values: { axis: string; value: string }[];
  title: string;
  /** کالای موجود همین ترکیب در مدل */
  existing: { id: string; code: string; title: string } | null;
}

function combos<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((a) => list.map((x) => [...a, x])), [[]]);
}

/**
 * پیش‌نمایش یا ثبت. ثبت در همان تراکنش مقدارهای تازه‌ی محور و مدل تازه را
 * می‌سازد؛ پیش‌نمایش هیچ چیز نمی‌نویسد (فراخوان تراکنش را برمی‌گرداند).
 */
export async function runMatrix(tx: Tx, input: MatrixInput, commit: boolean) {
  const axes = input.axes.filter((a) => a.values.some((v) => v.trim()));
  if (!axes.length) throw new AccError("دست‌کم یک ویژگی با یک مقدار انتخاب کنید");
  if (new Set(axes.map((a) => a.axisId)).size !== axes.length) throw new AccError("هر ویژگی یک بار");

  let model = input.modelId ? await tx.accItemModel.findUnique({ where: { id: input.modelId } }) : null;
  if (input.modelId && !model) throw new AccError("مدل پیدا نشد");
  const title = (model?.title ?? input.modelTitle ?? "").replace(/\s+/g, " ").trim();
  if (!title) throw new AccError("نام مدل را بنویسید");
  if (!model) model = await tx.accItemModel.findUnique({ where: { title } });

  // مقدارها: پیش‌نمایش هم می‌سازد ولی فراخوان پیش‌نمایش را برمی‌گرداند
  const resolved = [];
  for (const a of axes) resolved.push(await ensureAxisValues(tx, a.axisId, a.values));
  const all = combos(resolved.map((r) => r.values.map((v) => ({ axisId: r.axis.id, axis: r.axis.name, valueId: v.id, value: v.value }))));
  if (all.length > MATRIX_MAX) throw new AccError(`حداکثر ${MATRIX_MAX} ترکیب در یک بار — الان ${all.length}`);

  const existing = model
    ? new Map(
        (await tx.accItem.findMany({ where: { modelId: model.id }, select: { id: true, code: true, title: true, attrKey: true } })).map((i) => [i.attrKey, i]),
      )
    : new Map<string | null, { id: string; code: string; title: string }>();

  const rows: MatrixRow[] = all.map((c) => ({
    key: c.map((x) => `${x.axis}=${x.value}`).join("|"),
    values: c.map((x) => ({ axis: x.axis, value: x.value })),
    title: `${title} ${c.map((x) => x.value).join(" ")}`,
    existing: existing.get(attrKeyOf(c)) ?? null,
  }));
  if (!commit) return { model: model ? { id: model.id, title: model.title, isNew: false } : { id: null, title, isNew: true }, rows, created: [] };

  if (!model) model = await tx.accItemModel.create({ data: { title, groupId: input.groupId || null } });
  const created: { id: string; code: string; title: string }[] = [];
  // کد دستی ردیف‌ها پیش از ساخت کنترل می‌شود تا شمارنده برای ردیف دستی مصرف نشود
  const manual = Object.values(input.rows ?? {}).map((r) => normalizeItemCode(r.code)).filter((x): x is string => !!x);
  if (new Set(manual).size !== manual.length) throw new AccError("دو ردیف یک کد دارند");
  for (const [i, c] of all.entries()) {
    const row = rows[i];
    const o = input.rows?.[row.key];
    if (row.existing || o?.skip) continue;
    const item = await createItem(
      tx,
      {
        title: o?.title?.trim() || row.title,
        code: o?.code ?? null,
        unit: input.unit,
        salePrice: o?.salePrice ?? input.salePrice ?? null,
        groupId: input.groupId ?? model.groupId,
        barcodes: o?.barcode ? [o.barcode] : undefined,
      },
      { modelId: model.id, attrs: c.map((x) => ({ axisId: x.axisId, valueId: x.valueId })) },
    );
    created.push({ id: item.id, code: item.code, title: item.title });
  }
  if (!created.length) throw new AccError("ترکیب تازه‌ای نیست — همه‌ی این ترکیب‌ها در مدل هستند");
  return { model: { id: model.id, title: model.title, isNew: false }, rows, created };
}
