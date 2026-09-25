/**
 * گراف چارت لینک‌سازی — **توابع خالص**.
 *
 * آرایه می‌گیرند و آرایه می‌دهند و به prisma دست نمی‌زنند. سرور لایه و حلقه
 * و قفل پیش‌نیاز را با همین‌ها حساب می‌کند و بوم هم چیدمان خودکار را؛ دو
 * پیاده‌سازی از «لایه» یعنی روزی چارت یک چیز بگوید و گزارش چیز دیگری.
 *
 * آزمون: `scripts/link-graph-check.ts` — قبل و بعد از هر تغییر اجرا شود.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۷.۳
 */

/** یال: از یک گره، به گره‌ی دیگر یا به صفحه‌ی هدف — دقیقاً یکی از آن دو */
export type GraphEdge = {
  fromNodeId: string;
  toNodeId: string | null;
  toTargetId: string | null;
};

/**
 * عمق بیشتر از این در عمل اعتباری منتقل نمی‌کند و فقط کار می‌سازد. سقف
 * **نرم** است: هشدار می‌دهد، جلوی ذخیره را نمی‌گیرد.
 */
export const MAX_TIER = 4;

/**
 * لایه‌ی هر گره = کوتاه‌ترین مسیر تا نزدیک‌ترین صفحه‌ی هدف.
 *
 * لایه‌ی ۱ مستقیم به صفحه‌ی هدف لینک می‌دهد، لایه‌ی ۲ به لایه‌ی ۱. گره‌ی بدون
 * مسیر `null` می‌گیرد — «معلق»، که وسط کشیدن چارت طبیعی است و خطا نیست.
 *
 * BFS از صفحه‌های هدف به عقب؛ اولین رسیدن به گره کوتاه‌ترین مسیر است.
 */
export function computeTiers(nodeIds: string[], edges: GraphEdge[]): Map<string, number | null> {
  const sourcesOf = new Map<string, string[]>();
  const tierOneNodes: string[] = [];

  for (const edge of edges) {
    if (edge.toTargetId) {
      tierOneNodes.push(edge.fromNodeId);
      continue;
    }
    if (!edge.toNodeId) continue;
    const list = sourcesOf.get(edge.toNodeId);
    if (list) list.push(edge.fromNodeId);
    else sourcesOf.set(edge.toNodeId, [edge.fromNodeId]);
  }

  const tiers = new Map<string, number | null>();
  for (const id of nodeIds) tiers.set(id, null);

  let frontier = [...new Set(tierOneNodes)].filter((id) => tiers.has(id));
  let tier = 1;

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (tiers.get(id) !== null) continue;
      tiers.set(id, tier);
      for (const source of sourcesOf.get(id) ?? []) {
        if (tiers.has(source) && tiers.get(source) === null) next.push(source);
      }
    }
    frontier = next;
    tier += 1;
  }

  return tiers;
}

/**
 * آیا افزودن یال `from → to` حلقه می‌سازد؟ معادل: از `to` می‌شود به `from`
 * رسید؟ یالی که به صفحه‌ی هدف می‌رود هیچ‌وقت حلقه نمی‌سازد.
 */
export function wouldCreateCycle(edges: GraphEdge[], fromNodeId: string, toNodeId: string) {
  if (fromNodeId === toNodeId) return true;

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.toNodeId) continue;
    const list = outgoing.get(edge.fromNodeId);
    if (list) list.push(edge.toNodeId);
    else outgoing.set(edge.fromNodeId, [edge.toNodeId]);
  }

  const seen = new Set<string>();
  const stack = [toNodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromNodeId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

/**
 * گره‌هایی که پیش‌نیازشان هنوز `LIVE` نشده («در انتظار پیش‌نیاز»).
 *
 * لینک دادن به صفحه‌ای که هنوز وجود ندارد بی‌معنی است. گره‌ای که فقط به
 * صفحه‌ی هدف لینک می‌دهد همیشه آماده است — صفحه‌ی هدف مال خودمان است.
 */
export function blockedNodeIds(edges: GraphEdge[], liveNodeIds: Set<string>) {
  const blocked = new Set<string>();
  for (const edge of edges) {
    if (edge.toNodeId && !liveNodeIds.has(edge.toNodeId)) blocked.add(edge.fromNodeId);
  }
  return blocked;
}

// ─────────────────────────────────────────────────────────────────
// چیدمان خودکار بوم
// ─────────────────────────────────────────────────────────────────

/** ابعاد بوم — بوم و چیدمان باید یک عدد را ببینند */
export const LAYOUT = {
  nodeWidth: 244,
  nodeHeight: 80,
  targetWidth: 272,
  targetHeight: 96,
  columnGap: 330,
  rowGap: 104,
};

/** فاصله‌ی کمینه‌ی عمودی دو صفحه‌ی هدف */
const TARGET_GAP = LAYOUT.targetHeight + 28;

export type LayoutInput = {
  nodes: { id: string; code: number; tier: number | null }[];
  targets: { id: string }[];
  edges: GraphEdge[];
};

export type Placement = { id: string; kind: "node" | "target"; posX: number; posY: number };

const mean = (values: number[], fallback: number) =>
  values.length === 0 ? fallback : values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * چیدمان لایه‌ای: صفحه‌های هدف در ستون وسط، گره‌ها بر حسب لایه در ستون‌های
 * چپ و راست.
 *
 * - لایه‌ی ۱ یکی‌درمیان چپ و راست تا دو طرف هم‌وزن بمانند، مرتب بر حسب
 *   اولین صفحه‌ی هدفش تا گره‌های هر صفحه کنار هم بمانند.
 * - بالادست‌ها **طرف مقصدشان** را به ارث می‌برند، وگرنه فلش‌ها از وسط چارت
 *   رد می‌شوند.
 * - هر گره کنار **میانگین مقصدهایش** می‌نشیند نه بر حسب شناسه (مرتب‌سازی
 *   میانگین مرکز)؛ لایه‌ی ۲ به بعد روبه‌روی مقصدش.
 * - هر صفحه‌ی هدف وسط گره‌های لایه‌ی ۱ خودش.
 * - معلق‌ها یک ستون دورتر از عمیق‌ترین لایه، پایین بوم.
 */
export function autoLayout(input: LayoutInput): Placement[] {
  const { columnGap: COLUMN_GAP, rowGap: ROW_GAP } = LAYOUT;

  const destinationsOf = new Map<string, { nodes: string[]; targets: string[] }>();
  const sourcesOf = new Map<string, string[]>();
  for (const edge of input.edges) {
    const entry = destinationsOf.get(edge.fromNodeId) ?? { nodes: [], targets: [] };
    if (edge.toNodeId) entry.nodes.push(edge.toNodeId);
    if (edge.toTargetId) entry.targets.push(edge.toTargetId);
    destinationsOf.set(edge.fromNodeId, entry);
    if (edge.toNodeId) {
      const list = sourcesOf.get(edge.toNodeId);
      if (list) list.push(edge.fromNodeId);
      else sourcesOf.set(edge.toNodeId, [edge.fromNodeId]);
    }
  }

  const targetIndex = new Map(input.targets.map((t, i) => [t.id, i]));
  const tierOf = new Map(input.nodes.map((n) => [n.id, n.tier]));

  const firstTarget = (id: string) =>
    Math.min(999, ...(destinationsOf.get(id)?.targets ?? []).map((t) => targetIndex.get(t) ?? 0));
  const tierOne = input.nodes
    .filter((n) => n.tier === 1)
    .sort((a, b) => firstTarget(a.id) - firstTarget(b.id) || a.code - b.code)
    .map((n) => n.id);

  const side = new Map<string, number>();
  tierOne.forEach((id, i) => side.set(id, i % 2 === 0 ? 1 : -1));
  let frontier = [...tierOne];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const source of sourcesOf.get(id) ?? []) {
        if (side.has(source) || !tierOf.has(source)) continue;
        side.set(source, side.get(id)!);
        next.push(source);
      }
    }
    frontier = next;
  }

  const y = new Map<string, number>();
  const placements: Placement[] = [];
  const provisionalTargetY = (id: string) => (targetIndex.get(id) ?? 0) * TARGET_GAP;

  const deepest = Math.max(1, ...input.nodes.map((n) => n.tier ?? 0));
  for (const columnSide of [1, -1]) {
    for (let tier = 1; tier <= deepest; tier++) {
      const ids = input.nodes
        .filter((n) => n.tier === tier && (side.get(n.id) ?? 1) === columnSide)
        .map((n) => n.id);
      if (ids.length === 0) continue;

      const centerOf = (id: string) => {
        const dest = destinationsOf.get(id) ?? { nodes: [], targets: [] };
        return mean(
          [
            ...dest.targets.map(provisionalTargetY),
            ...dest.nodes.filter((n) => y.has(n)).map((n) => y.get(n)!),
          ],
          0,
        );
      };
      ids.sort((a, b) => centerOf(a) - centerOf(b) || a.localeCompare(b));
      if (tier === 1) {
        ids.forEach((id, i) => y.set(id, i * ROW_GAP));
      } else {
        let previous = -Infinity;
        for (const id of ids) {
          const at = Math.max(centerOf(id), previous + ROW_GAP);
          y.set(id, at);
          previous = at;
        }
      }
      ids.forEach((id) =>
        placements.push({ id, kind: "node", posX: columnSide * tier * COLUMN_GAP, posY: y.get(id)! }),
      );
    }
  }

  const targetYs = input.targets.map((target) => {
    const feeders = input.edges
      .filter((e) => e.toTargetId === target.id && tierOf.get(e.fromNodeId) === 1)
      .map((e) => y.get(e.fromNodeId))
      .filter((v): v is number => v !== undefined);
    return { id: target.id, y: mean(feeders, provisionalTargetY(target.id)) };
  });
  targetYs.sort((a, b) => a.y - b.y);
  for (let i = 1; i < targetYs.length; i++) {
    targetYs[i].y = Math.max(targetYs[i].y, targetYs[i - 1].y + TARGET_GAP);
  }
  const nodeYs = [...y.values()];
  if (targetYs.length > 0 && nodeYs.length > 0) {
    const shift =
      (Math.min(...nodeYs) + Math.max(...nodeYs)) / 2 -
      (targetYs[0].y + targetYs[targetYs.length - 1].y) / 2;
    const clamped = Math.abs(shift) > TARGET_GAP ? shift : 0;
    targetYs.forEach((entry) => (entry.y += clamped));
  }
  for (const entry of targetYs) {
    placements.push({ id: entry.id, kind: "target", posX: 0, posY: Math.round(entry.y) });
  }

  const orphans = input.nodes
    .filter((n) => n.tier === null)
    .map((n) => n.id)
    .sort();
  if (orphans.length > 0) {
    const bottom = Math.max(0, ...placements.map((p) => p.posY));
    orphans.forEach((id, i) => {
      placements.push({
        id,
        kind: "node",
        posX: (deepest + 1) * COLUMN_GAP,
        posY: Math.round(bottom + ROW_GAP * (i + 1)),
      });
    });
  }

  return placements;
}
