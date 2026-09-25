"use client";

/**
 * اعداد کمپین — الگوبرداری از `link-campaign-stats.tsx` برتر.
 *
 * این اعداد **کنار چارت‌اند نه در صفحه‌ی دیگر**: تصمیم درباره‌ی توزیع انکر
 * وقتی گرفته می‌شود که آدم دارد به چارت نگاه می‌کند.
 *
 * نمودارها از `components/admin/reports/charts.tsx` می‌آیند؛ کتابخانه‌ی
 * نموداری تازه اضافه نشد.
 */

import { TriangleAlert } from "lucide-react";
import { DonutChart, HBarChart } from "@/components/admin/reports/charts";
import {
  ANCHOR_KIND_LABELS,
  ANCHOR_PROFILE_LABELS,
  NODE_STATUS_LABELS,
  NODE_STATUS_SVG,
} from "@/lib/marketing/link-constants";
import { card, cn, fa } from "./ui";
import type { AnchorSliceDto, CampaignStatsDto } from "./link-client-types";

const PALETTE = ["#6366f1", "#0891b2", "#16a34a", "#d97706", "#e11d48", "#8b5cf6", "#0d9488", "#64748b"];

const money = (v: number) =>
  v >= 1_000_000 ? `${fa(Math.round(v / 100_000) / 10)} میلیون تومان` : `${fa(v)} تومان`;

const anchorLabel = (kind: string) =>
  kind === "UNSET" ? "ثبت‌نشده" : (ANCHOR_KIND_LABELS[kind as keyof typeof ANCHOR_KIND_LABELS] ?? kind);

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "negative";
}) {
  return (
    <div
      className={cn(
        card,
        "p-3.5",
        tone === "primary" && "border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5",
        tone === "negative" && "border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5",
      )}
    >
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[10.5px] text-gray-400">{hint}</p>}
    </div>
  );
}

/** یک ردیف توزیع انکر با مقایسه‌ی بازه */
function AnchorRow({ slice }: { slice: AnchorSliceDto }) {
  const tone =
    slice.verdict === "high"
      ? "text-red-600 dark:text-red-400"
      : slice.verdict === "low"
        ? "text-amber-600 dark:text-amber-400"
        : "text-gray-500";
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className="w-24 shrink-0 font-bold text-gray-700 dark:text-gray-200">{anchorLabel(slice.kind)}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
        <div
          className={cn("h-full rounded-full", slice.verdict === "high" ? "bg-red-500" : "bg-blue-500")}
          style={{ width: `${Math.min(100, slice.percent)}%` }}
        />
      </div>
      <span className={cn("w-28 shrink-0 text-left tabular-nums", tone)} dir="rtl">
        {fa(slice.percent)}٪
        {slice.range && (
          <span className="text-gray-400">
            {" "}
            (هدف {fa(slice.range[0])}–{fa(slice.range[1])})
          </span>
        )}
      </span>
    </div>
  );
}

export default function LinkCampaignStats({ stats }: { stats: CampaignStatsDto | null }) {
  if (!stats || stats.total === 0) return null;

  // هشدار وقتی می‌آید که یک نوع انکر از سقف بازه‌اش بیرون زده باشد
  const overused = stats.anchors.filter((s) => s.verdict === "high");
  // کمپین صددرصد فالو خودش نشانه‌ی مصنوعی‌بودن است
  const allFollow = stats.follow.nofollow === 0 && stats.total > 2;
  const unset = stats.anchors.find((s) => s.kind === "UNSET");
  const badTargets = stats.perTarget.filter(
    (t) => t.total > 2 && t.anchors.some((s) => s.verdict === "high"),
  );
  const live = stats.byStatus.find((r) => r.status === "LIVE")?.count ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatCard
          label="پیشرفت"
          value={`${fa(stats.progressPercent)}٪`}
          hint={`${fa(live)} از ${fa(stats.total)} لینک فعال`}
          tone="primary"
        />
        <StatCard label="کل گره‌ها" value={fa(stats.total)} />
        <StatCard
          label="فالو"
          value={`${fa(stats.total === 0 ? 0 : Math.round((stats.follow.follow / stats.total) * 100))}٪`}
          hint={`${fa(stats.follow.nofollow)} نوفالو`}
          tone={allFollow ? "negative" : undefined}
        />
        <StatCard
          label="هزینه"
          value={stats.totalCost === 0 ? "—" : money(stats.totalCost)}
          hint={stats.totalCost === 0 ? "ثبت نشده" : undefined}
        />
      </div>

      {(overused.length > 0 || allFollow || badTargets.length > 0) && (
        <div className="space-y-1 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/5 p-3.5">
          <p className="flex items-center gap-1.5 text-[12px] font-black text-red-600 dark:text-red-400">
            <TriangleAlert className="h-4 w-4" />
            توزیع انکر
          </p>
          {overused.map((s) => (
            <p key={s.kind} className="text-[11.5px] leading-6 text-gray-700 dark:text-gray-200">
              انکر «{anchorLabel(s.kind)}» {fa(s.percent)}٪ است و از بازه‌ی سالم ({fa(s.range![0])} تا{" "}
              {fa(s.range![1])}٪) بالاتر رفته
            </p>
          ))}
          {badTargets.map((t) => (
            <p key={t.id} className="text-[11.5px] leading-6 text-gray-700 dark:text-gray-200">
              صفحه‌ی «{t.label}» به‌تنهایی توزیع ناسالمی دارد، هرچند عدد کل کمپین خوب باشد
            </p>
          ))}
          {allFollow && (
            <p className="text-[11.5px] leading-6 text-gray-700 dark:text-gray-200">
              همه‌ی لینک‌ها فالو هستند — پروفایل طبیعی مخلوطی از فالو و نوفالو است
            </p>
          )}
          <p className="pt-1 text-[11px] leading-6 text-gray-500">این‌ها هشدارند نه سد؛ بازه است نه عدد جادویی.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn(card, "p-4")}>
          <h3 className="mb-3 text-[12.5px] font-black text-gray-900 dark:text-white">
            توزیع انکر
            <span className="mr-1.5 text-[10.5px] font-bold text-gray-400">
              بازه‌ی {ANCHOR_PROFILE_LABELS[stats.anchorProfile] ?? stats.anchorProfile}
            </span>
          </h3>
          {unset && unset.percent > 33 && (
            <p className="mb-2 text-[11px] leading-5 text-amber-600 dark:text-amber-400">
              {fa(unset.percent)}٪ گره‌ها نوع انکر ندارند — تا ثبت نشود این گزارش ناقص است
            </p>
          )}
          <div className="space-y-2">
            {stats.anchors.map((s) => (
              <AnchorRow key={s.kind} slice={s} />
            ))}
          </div>
        </div>

        <div className={cn(card, "p-4")}>
          <h3 className="mb-3 text-[12.5px] font-black text-gray-900 dark:text-white">نوع لینک</h3>
          <DonutChart
            size={150}
            items={stats.byType.map((t, i) => ({ label: t.title, value: t.count, color: PALETTE[i % PALETTE.length] }))}
          />
        </div>

        <div className={cn(card, "p-4")}>
          <h3 className="mb-3 text-[12.5px] font-black text-gray-900 dark:text-white">لایه</h3>
          <HBarChart
            items={stats.byTier.map((r) => ({
              label: r.tier === null ? "معلق" : `لایه ${fa(r.tier)}`,
              value: r.count,
              color: r.tier === null ? "#f59e0b" : "#6366f1",
            }))}
          />
        </div>

        <div className={cn(card, "p-4")}>
          <h3 className="mb-3 text-[12.5px] font-black text-gray-900 dark:text-white">وضعیت</h3>
          <HBarChart
            items={stats.byStatus.map((r) => ({
              label: NODE_STATUS_LABELS[r.status],
              value: r.count,
              color: NODE_STATUS_SVG[r.status].stroke,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
