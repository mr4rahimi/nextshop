/**
 * بررسی توابع خالص گراف لینک‌سازی و توزیع انکر — بدون دیتابیس
 *
 *   npx tsx scripts/link-graph-check.ts
 *
 * ترجمه‌ی ۲۱ آزمون برتر (`link-graph.test.ts`) به‌علاوه‌ی توزیع انکر.
 * پروژه تست‌رانر ندارد؛ قرارداد همان اسکریپت‌های smoke است.
 * **قبل و بعد از هر دست‌زدن به `lib/marketing/link-graph.ts` اجرا شود.**
 */

import {
  autoLayout,
  blockedNodeIds,
  computeTiers,
  wouldCreateCycle,
  type GraphEdge,
} from "../lib/marketing/link-graph";
import { summarizeAnchors, projectedAnchorWarnings } from "../lib/marketing/anchor-profile";

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`, detail ?? "");
  }
}

const toTarget = (fromNodeId: string, toTargetId = "t1"): GraphEdge => ({
  fromNodeId,
  toNodeId: null,
  toTargetId,
});
const toNode = (fromNodeId: string, toNodeId: string): GraphEdge => ({
  fromNodeId,
  toNodeId,
  toTargetId: null,
});
const n = (id: string, tier: number | null, code = 1) => ({ id, tier, code });

console.log("محاسبه‌ی لایه");
check("گره‌ی متصل به صفحه‌ی هدف لایه‌ی ۱ است", computeTiers(["a"], [toTarget("a")]).get("a") === 1);
{
  const t = computeTiers(["a", "b", "c"], [toTarget("a"), toNode("b", "a"), toNode("c", "b")]);
  check("زنجیره لایه‌ها را پشت سر هم می‌شمارد", t.get("a") === 1 && t.get("b") === 2 && t.get("c") === 3);
}
check(
  "گره‌ی بدون مسیر معلق می‌ماند، نه خطا",
  computeTiers(["a", "orphan"], [toTarget("a")]).get("orphan") === null,
);
check(
  "کوتاه‌ترین مسیر برنده است",
  computeTiers(["a", "b", "c"], [toTarget("a"), toNode("b", "a"), toNode("c", "b"), toTarget("c")]).get(
    "c",
  ) === 1,
);
check(
  "چند صفحه‌ی هدف: نزدیک‌ترین مبناست",
  computeTiers(["a", "b"], [toTarget("a", "t1"), toNode("b", "a"), toTarget("b", "t2")]).get("b") === 1,
);
check(
  "دو یال به دو صفحه‌ی هدف همچنان لایه‌ی ۱",
  computeTiers(["a"], [toTarget("a", "t1"), toTarget("a", "t2")]).get("a") === 1,
);
check(
  "گره‌ای که در فهرست نیست وارد نتیجه نمی‌شود",
  !computeTiers(["a"], [toTarget("a"), toNode("ghost", "a")]).has("ghost"),
);

console.log("تشخیص حلقه");
check("یال به خود گره حلقه است", wouldCreateCycle([], "a", "a"));
check("برگشت مستقیم حلقه است", wouldCreateCycle([toNode("a", "b")], "b", "a"));
check("برگشت با واسطه حلقه است", wouldCreateCycle([toNode("a", "b"), toNode("b", "c")], "c", "a"));
check("یال موازی حلقه نیست", !wouldCreateCycle([toNode("a", "b"), toNode("a", "c")], "b", "c"));
check("یال به صفحه‌ی هدف دخالت نمی‌کند", !wouldCreateCycle([toTarget("a"), toTarget("b")], "a", "b"));

console.log("پیش‌نیاز");
check("مقصدِ زنده‌نشده مسدود می‌کند", blockedNodeIds([toNode("b", "a")], new Set()).has("b"));
check("فقط به صفحه‌ی هدف = هیچ‌وقت مسدود نیست", !blockedNodeIds([toTarget("a")], new Set()).has("a"));
check("مقصد زنده شد، گره آزاد", !blockedNodeIds([toNode("b", "a")], new Set(["a"])).has("b"));

console.log("چیدمان خودکار");
{
  const p = autoLayout({ nodes: [], targets: [{ id: "t1" }], edges: [] });
  check("صفحه‌ی هدف در ستون وسط", p[0]?.id === "t1" && p[0].kind === "target" && p[0].posX === 0);
}
{
  const p = autoLayout({
    nodes: [n("a", 1), n("b", 2)],
    targets: [{ id: "t1" }],
    edges: [toTarget("a"), toNode("b", "a")],
  });
  const a = p.find((x) => x.id === "a")!;
  const b = p.find((x) => x.id === "b")!;
  check("لایه‌ی دورتر ستون دورتر", Math.abs(b.posX) > Math.abs(a.posX));
  check("گره و بالادستش یک طرف", Math.sign(a.posX) === Math.sign(b.posX));
  check("لایه‌ی ۲ روبه‌روی مقصدش", a.posY === b.posY, { a: a.posY, b: b.posY });
}
{
  const p = autoLayout({
    nodes: [n("a", 1, 1), n("b", 1, 2)],
    targets: [{ id: "t1" }],
    edges: [toTarget("a"), toTarget("b")],
  });
  const sides = new Set(p.filter((x) => x.kind === "node").map((x) => Math.sign(x.posX)));
  check("لایه‌ی ۱ بین دو طرف پخش می‌شود", sides.size === 2);
}
check(
  "گره‌ی معلق هم جا می‌گیرد",
  !!autoLayout({ nodes: [n("orphan", null)], targets: [{ id: "t1" }], edges: [] }).find(
    (x) => x.id === "orphan",
  ),
);
{
  const p = autoLayout({
    nodes: [n("a", 1), n("b", 2), n("c", null)],
    targets: [{ id: "t1" }, { id: "t2" }],
    edges: [toTarget("a"), toNode("b", "a")],
  });
  check("هر گره و صفحه دقیقاً یک جایگاه", p.length === 5 && new Set(p.map((x) => x.id)).size === 5);
}

console.log("توزیع انکر");
{
  const s = summarizeAnchors([
    { anchorKind: "EXACT" },
    { anchorKind: "EXACT" },
    { anchorKind: "BRAND" },
    { anchorKind: null },
  ]);
  const exact = s.find((x) => x.kind === "EXACT")!;
  const unset = s.find((x) => x.kind === "UNSET")!;
  check("تطابق دقیق ۵۰٪ بالاتر از بازه‌ی فروشگاهی است", exact.percent === 50 && exact.verdict === "high");
  check("ثبت‌نشده در مخرج می‌ماند و بازه ندارد", unset.percent === 25 && unset.range === null);
}
{
  const current = [
    { id: "1", anchorKind: "BRAND" as const, targetIds: ["t1"] },
    { id: "2", anchorKind: "BRAND" as const, targetIds: ["t2"] },
    { id: "3", anchorKind: "EXACT" as const, targetIds: ["t2"] },
    { id: "4", anchorKind: "GENERIC" as const, targetIds: ["t1"] },
  ];
  const labels = new Map([
    ["t1", "دسته"],
    ["t2", "محصول"],
  ]);
  const w = projectedAnchorWarnings({
    current,
    editingId: null,
    anchorKind: "EXACT",
    targetIds: ["t2"],
    targetLabels: labels,
  });
  check("هشدار عدد «بعد از افزودن» را می‌گوید (۲ از ۵ = ۴۰٪)", w.some((x) => x.includes("۴۰")), w);
  check("هشدار سطح صفحه هم می‌آید", w.some((x) => x.includes("«محصول»")), w);
  const edit = projectedAnchorWarnings({
    current,
    editingId: "3",
    anchorKind: "EXACT",
    targetIds: ["t2"],
    targetLabels: labels,
  });
  check("گره‌ی در حال ویرایش دو بار شمرده نمی‌شود (۱ از ۴ = ۲۵٪)", edit.some((x) => x.includes("۲۵")), edit);
  check(
    "نوع بدون بازه هشدار نمی‌دهد",
    projectedAnchorWarnings({ current, editingId: null, anchorKind: "IMAGE", targetIds: [], targetLabels: labels })
      .length === 0,
  );
}

console.log(`\n${passed} درست، ${failed} غلط`);
process.exit(failed ? 1 : 0);
