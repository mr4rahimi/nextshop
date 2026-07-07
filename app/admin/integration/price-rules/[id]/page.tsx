import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RuleFormClient from "../RuleFormClient";

export const dynamic = "force-dynamic";

export default async function EditPriceRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rule = await prisma.integPriceRule.findUnique({
    where: { id },
    include: { tiers: { orderBy: { sortOrder: "asc" } } },
  });
  if (!rule) notFound();

  const initial = {
    id:              rule.id,
    name:            rule.name,
    description:     rule.description,
    isActive:        rule.isActive,
    priority:        rule.priority,
    targetPlatforms: rule.targetPlatforms,
    feePercent:      rule.feePercent,
    shippingType:    rule.shippingType,
    shippingValue:   rule.shippingValue,
    packagingType:   rule.packagingType,
    packagingValue:  rule.packagingValue,
    miscType:        rule.miscType,
    miscValue:       rule.miscValue,
    marginPercent:   rule.marginPercent,
    roundTo:         rule.roundTo,
    tiers: rule.tiers.map((t) => ({
      minStock:      t.minStock,
      maxStock:      t.maxStock,
      marginPercent: t.marginPercent,
    })),
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Link href="/admin/integration/price-rules"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← قوانین قیمت
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">ویرایش قانون</h1>
      </div>

      <RuleFormClient mode="edit" initial={initial} />
    </div>
  );
}