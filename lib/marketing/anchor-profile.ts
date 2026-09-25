/**
 * توزیع انکر و هشدارهایش — **توابع خالص**.
 *
 * سه قاعده‌ی بخش ۷.۴ مستندات:
 *
 * **۱. هشدار موقع ساختن گره می‌آید و عدد «بعد از افزودن» را می‌گوید**، نه عدد
 * فعلی را. سؤال کاربر «اگر این را بسازم چه می‌شود» است.
 *
 * **۲. هشدار هم روی کمپین و هم روی هر صفحه‌ی هدف است.** عدد کمپین می‌تواند
 * سالم باشد و یک صفحه صددرصد تطابق دقیق بگیرد.
 *
 * **۳. انکر ثبت‌نشده خودش را نشان می‌دهد** («ثبت‌نشده») و از مخرج حذف
 * نمی‌شود — حذفش توزیعِ ساختگیِ سالمی می‌سازد.
 */

import { anchorRanges, type LinkAnchorKind } from "./link-constants";

export type AnchorSlice = {
  kind: LinkAnchorKind | "UNSET";
  count: number;
  percent: number;
  /** بازه‌ی مرجع؛ `null` یعنی برای این نوع بازه‌ای تعریف نشده */
  range: [number, number] | null;
  verdict: "ok" | "high" | "low" | "none";
};

export function summarizeAnchors(
  rows: { anchorKind: LinkAnchorKind | null }[],
  profile?: string | null,
): AnchorSlice[] {
  const ranges = anchorRanges(profile);
  const total = rows.length;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.anchorKind ?? "UNSET";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([kind, count]) => {
      const percent = total === 0 ? 0 : Math.round((count / total) * 100);
      const range = kind === "UNSET" ? null : (ranges[kind as LinkAnchorKind] ?? null);
      let verdict: AnchorSlice["verdict"] = "none";
      if (range) {
        if (percent > range[1]) verdict = "high";
        else if (percent < range[0]) verdict = "low";
        else verdict = "ok";
      }
      return { kind: kind as AnchorSlice["kind"], count, percent, range, verdict };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * هشدار فرم گره: اگر این گره با این نوع انکر ساخته (یا به آن عوض) شود، سهم
 * همان نوع در کمپین و در صفحه‌ی هدفش چند می‌شود؟
 *
 * `current` گره‌های فعلی کمپین است، `editingId` گره‌ی در حال ویرایش (که
 * خودش در `current` هست و نباید دو بار شمرده شود).
 */
export function projectedAnchorWarnings(input: {
  current: { id: string; anchorKind: LinkAnchorKind | null; targetIds: string[] }[];
  editingId: string | null;
  anchorKind: LinkAnchorKind | null;
  targetIds: string[];
  targetLabels: Map<string, string>;
  profile?: string | null;
}): string[] {
  if (!input.anchorKind) return [];
  const range = anchorRanges(input.profile)[input.anchorKind];
  if (!range) return [];

  const others = input.current.filter((n) => n.id !== input.editingId);
  const warnings: string[] = [];
  const fa = (n: number) => n.toLocaleString("fa-IR");

  const share = (pool: { anchorKind: LinkAnchorKind | null }[]) => {
    const total = pool.length + 1;
    const count = pool.filter((n) => n.anchorKind === input.anchorKind).length + 1;
    return Math.round((count / total) * 100);
  };

  const campaignPercent = share(others);
  if (campaignPercent > range[1] && others.length >= 2) {
    warnings.push(
      `با این گره، سهم این نوع انکر در کل کمپین به ${fa(campaignPercent)}٪ می‌رسد — بازه‌ی سالم تا ${fa(range[1])}٪ است.`,
    );
  }

  for (const targetId of input.targetIds) {
    const pool = others.filter((n) => n.targetIds.includes(targetId));
    const percent = share(pool);
    if (percent > range[1] && pool.length >= 2) {
      warnings.push(
        `در صفحه‌ی «${input.targetLabels.get(targetId) ?? "هدف"}» سهمش ${fa(percent)}٪ می‌شود، هرچند عدد کل کمپین ممکن است سالم باشد.`,
      );
    }
  }

  return warnings;
}
