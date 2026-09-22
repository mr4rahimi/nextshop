/**
 * روش‌های ارسال و باربری‌های پیش‌فرض.
 *
 *   pnpm tsx scripts/seed-shipping-methods.ts                      # = --preset=core
 *   pnpm tsx scripts/seed-shipping-methods.ts --preset=mahamprint  # + باربری‌های شهرستان
 *
 * این جدول **تنها منبع حقیقتِ روش ارسال** است و دو مصرف‌کننده دارد: چک‌اوت
 * سایت و انتخابگر باربریِ کارتابل. تا پیش از این، باربری‌ها آرایه‌ی ثابتی در
 * `lib/worklist/types.ts` بودند و کسب‌وکار دیگر نمی‌توانست عوضشان کند.
 *
 * اسکریپت idempotent است: روش ارسالِ موجود (با همان عنوان) دست نمی‌خورد تا
 * کرایه و محدوده‌ی شهری که ادمین تنظیم کرده از بین نرود.
 *
 * مستندات: docs/plans/business-config.md بخش ۱
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import type { ShippingFeePayer, ShippingType } from "@prisma/client";

type Preset = "core" | "mahamprint";

interface MethodSeed {
  title: string;
  type: ShippingType;
  feePayer: ShippingFeePayer;
  /** مهلت تعهدشده بر حسب دقیقه — خالی یعنی تعهد زمانی ندارد */
  slaMinutes?: number;
  cities?: string[];
  fee?: number;
  description?: string;
  /** در سبد خرید سایت دیده شود */
  useInCheckout?: boolean;
  /** به‌عنوان باربری در کارتابل دیده شود */
  useInWorklist?: boolean;
  preset?: Preset;
}

const METHODS: MethodSeed[] = [
  // ── هسته: هر فروشگاهی این سه را دارد ────────────────────────
  {
    title: "پست",
    type: "STANDARD",
    feePayer: "COLLECT",
    description: "ارسال با پست به سراسر کشور",
  },
  {
    title: "تحویل حضوری",
    type: "STANDARD",
    feePayer: "FREE",
    description: "مشتری خودش از محل تحویل می‌گیرد",
  },
  {
    title: "پیک موتوری",
    type: "EXPRESS",
    feePayer: "PREPAID",
    slaMinutes: 120,
    description: "ارسال دوساعته در محدوده‌ی شهر",
  },

  // ── مهام‌پرینت: باربری‌های شهرستان، همه پس‌کرایه ──────────────
  // انتخاب باربری با **مشتری** است و کرایه هم با او. برای همین هیچ‌کدام
  // در سبد خرید سایت نمی‌آیند — فقط هماهنگی تلفنیِ کارتابل.
  {
    title: "تیپاکس",
    type: "STANDARD",
    feePayer: "COLLECT",
    slaMinutes: 1440,
    useInCheckout: false,
    preset: "mahamprint",
  },
  {
    title: "چاپار",
    type: "STANDARD",
    feePayer: "COLLECT",
    slaMinutes: 1440,
    useInCheckout: false,
    preset: "mahamprint",
  },
  {
    title: "بار هوایی",
    type: "STANDARD",
    feePayer: "COLLECT",
    slaMinutes: 1440,
    useInCheckout: false,
    preset: "mahamprint",
  },
  {
    title: "ترمینال باربری",
    type: "STANDARD",
    feePayer: "COLLECT",
    slaMinutes: 1440,
    useInCheckout: false,
    preset: "mahamprint",
  },
];

function readPreset(): Preset {
  const arg = process.argv.find((a) => a.startsWith("--preset="));
  if (!arg) return "core";
  const value = arg.slice("--preset=".length);
  if (value === "core" || value === "mahamprint") return value;
  throw new Error(`پیش‌تنظیم ناشناخته: ${value} — core یا mahamprint`);
}

async function main() {
  const preset = readPreset();
  const selected = METHODS.filter((m) => !m.preset || m.preset === preset);

  console.log(`پیش‌تنظیم: ${preset} · ${selected.length} روش ارسال\n`);

  let created = 0;
  let kept = 0;

  for (const [index, seed] of selected.entries()) {
    // ⚠️ عنوان یکتا نیست، پس `findFirst` — و همین کافی است: دو روش ارسال
    // با یک عنوان در عمل وجود ندارد و ساختنِ دوباره‌اش خطای کاربر است.
    const existing = await prisma.shippingMethod.findFirst({
      where: { title: seed.title },
      select: { id: true },
    });
    if (existing) {
      kept++;
      continue;
    }

    await prisma.shippingMethod.create({
      data: {
        title: seed.title,
        type: seed.type,
        feePayer: seed.feePayer,
        slaMinutes: seed.slaMinutes ?? null,
        cities: seed.cities ?? [],
        fee: BigInt(seed.fee ?? 0),
        description: seed.description ?? null,
        useInCheckout: seed.useInCheckout ?? true,
        useInWorklist: seed.useInWorklist ?? true,
        sortOrder: index,
      },
    });
    created++;
    console.log(`+ ${seed.title}`);
  }

  console.log(`\nساخته‌شده ${created} · از قبل موجود ${kept} · مجموع ${selected.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
