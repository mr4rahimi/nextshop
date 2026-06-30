import { prisma } from "@/lib/prisma";
import type { IntegProductInfo } from "@/lib/integration/types";

// ── نرمال‌سازی متن فارسی ─────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/ي/g, "ی")            // ی عربی
    .replace(/ك/g, "ک")            // ک عربی
    .replace(/[ً-ٰٟ]/g, "")  // حذف اعراب
    .toLowerCase();
}

// ── Bigram similarity (Sørensen–Dice) — مناسب برای فارسی ────────────

function bigrams(text: string): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) s.add(text.slice(i, i + 2));
  return s;
}

export function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const ba = bigrams(na);
  const bb = bigrams(nb);
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  return (2 * inter) / (ba.size + bb.size);
}

// ── نوع محصول فروشگاه برای matching ──────────────────────────────────

interface ShopProductForMatch {
  id:              string;
  title:           string;
  normalizedTitle: string;
  brandName:       string | null;
}

// ── بهترین match برای یک محصول پلتفرم ───────────────────────────────

interface BestMatch {
  shopProductId: string;
  confidence:    number;
  reason:        string;
}

function findBestMatch(
  hp: IntegProductInfo,
  shopList: ShopProductForMatch[],
): BestMatch | null {
  const hNorm  = normalizeText(hp.title);
  const hBrand = hp.brandName ? normalizeText(hp.brandName) : null;

  let best: BestMatch | null = null;

  for (const sp of shopList) {
    let confidence = 0;
    let reason = "";

    if (sp.normalizedTitle === hNorm) {
      confidence = 0.85;
      reason = "title_exact";
    } else {
      const sim = bigramSimilarity(hp.title, sp.title);
      if (sim >= 0.80) {
        confidence = 0.55 + sim * 0.10; // 0.63–0.65 محدوده
        reason = "title_fuzzy";

        if (hBrand && sp.brandName && normalizeText(sp.brandName).includes(hBrand)) {
          confidence += 0.10;
          reason += "+brand";
        }
      }
    }

    if (confidence > 0 && (!best || confidence > best.confidence)) {
      best = { shopProductId: sp.id, confidence, reason };
    }
  }

  return best;
}

// ── اجرای auto-match روی آرایه‌ای از محصولات پلتفرم ─────────────────

export async function runAutoMatch(
  platformCode: string,
  platformProducts: IntegProductInfo[],
): Promise<{ autoMapped: number; suggested: number; skipped: number }> {
  if (!platformProducts.length) return { autoMapped: 0, suggested: 0, skipped: 0 };

  // بارگذاری محصولات فروشگاه
  const raw = await prisma.product.findMany({
    where:  { isActive: true },
    select: { id: true, title: true, brand: { select: { title: true } } },
  });

  const shopList: ShopProductForMatch[] = raw.map((p) => ({
    id:              p.id,
    title:           p.title,
    normalizedTitle: normalizeText(p.title),
    brandName:       p.brand?.title ?? null,
  }));

  // آنچه قبلاً mapping یا suggestion دارد
  const [existingMaps, existingSugs] = await Promise.all([
    prisma.integProductMapping.findMany({
      where:  { platformCode },
      select: { platformProductId: true },
    }),
    prisma.integMappingSuggestion.findMany({
      where:  { platformCode, status: "PENDING" },
      select: { platformProductId: true },
    }),
  ]);

  const alreadyMapped    = new Set(existingMaps.map((m) => m.platformProductId));
  const alreadySuggested = new Set(existingSugs.map((s) => s.platformProductId));

  let autoMapped = 0;
  let suggested  = 0;
  let skipped    = 0;

  for (const hp of platformProducts) {
    if (alreadyMapped.has(hp.platformId) || alreadySuggested.has(hp.platformId)) {
      skipped++;
      continue;
    }

    const best = findBestMatch(hp, shopList);
    if (!best) { skipped++; continue; }

    if (best.confidence >= 0.95) {
      // auto-approve
      const existingForShop = await prisma.integProductMapping.findFirst({
        where: { shopProductId: best.shopProductId, platformCode },
      });
      if (!existingForShop) {
        await prisma.integProductMapping.create({
          data: {
            shopProductId:     best.shopProductId,
            platformCode,
            platformProductId: hp.platformId,
            platformTitle:     hp.title,
            isActive:          true,
          },
        });
        alreadyMapped.add(hp.platformId);
        autoMapped++;
      }
    } else if (best.confidence >= 0.60) {
      await prisma.integMappingSuggestion.create({
        data: {
          shopProductId:     best.shopProductId,
          platformCode,
          platformProductId: hp.platformId,
          platformTitle:     hp.title,
          confidence:        best.confidence,
          matchReason:       best.reason,
        },
      });
      alreadySuggested.add(hp.platformId);
      suggested++;
    } else {
      skipped++;
    }
  }

  return { autoMapped, suggested, skipped };
}

// ── تأیید یک suggestion → تبدیل به mapping ───────────────────────────

export async function approveSuggestion(suggestionId: string): Promise<void> {
  const sug = await prisma.integMappingSuggestion.findUniqueOrThrow({
    where: { id: suggestionId },
  });

  await prisma.$transaction([
    prisma.integProductMapping.create({
      data: {
        shopProductId:     sug.shopProductId,
        platformCode:      sug.platformCode,
        platformProductId: sug.platformProductId,
        platformTitle:     sug.platformTitle,
        isActive:          true,
      },
    }),
    prisma.integMappingSuggestion.update({
      where: { id: suggestionId },
      data:  { status: "APPROVED", reviewedAt: new Date() },
    }),
  ]);
}

// ── رد یک suggestion ──────────────────────────────────────────────────

export async function rejectSuggestion(suggestionId: string): Promise<void> {
  await prisma.integMappingSuggestion.update({
    where: { id: suggestionId },
    data:  { status: "REJECTED", reviewedAt: new Date() },
  });
}
