/**
 * صحت‌سنجی امتیاز عملکرد — فقط خواندنی.
 *
 *   npx tsx scripts/smoke-score.ts             # ماه قبل
 *   npx tsx scripts/smoke-score.ts 1405-06     # ماه مشخص
 *
 * دو بخش دارد:
 *  ۱. حالت‌های ساختگیِ الگوریتم خالص — قاعده‌هایی که در برتر یک بار شکستند
 *  ۲. اجرای واقعی روی دیتابیس: هر امتیاز بین ۰ و ۱۰۰، بدون NaN، معیار غیرفعال
 *     بیرون از مخرج، و رتبه فقط برای واجدین
 *
 * چیزی نمی‌نویسد، پس روی سرور هم بی‌خطر است.
 * مستندات: docs/features/staff-worklist.md بخش ۱۵
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { scoreGroup, type MemberInput, type MetricWeight } from "../lib/worklist/score-calc";
import { metricsOf } from "../lib/worklist/score-metrics";
import { currentMonthKey, monthScore, parseMonth } from "../lib/worklist/score";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

const weightsOf = (over: Record<string, Partial<MetricWeight>> = {}): MetricWeight[] =>
  metricsOf("OPERATIONS").map((m) => ({
    code: m.code, weight: m.defaults.OPERATIONS ?? 0, isActive: true, ...over[m.code],
  }));

const member = (id: string, raw: MemberInput["raw"], presentDays: number | null = 20): MemberInput => ({
  userId: id, name: id, presentDays, raw,
});

function syntheticCases() {
  console.log("\n── الگوریتم خالص ──");

  // ۱. بهترین در همه‌چیز = ۱۰۰؛ نصفِ همه = ۵۰
  const a = scoreGroup("OPERATIONS", [
    member("a", { TASK_DONE: { value: 40 }, TASK_ONTIME: { value: 1, num: 10, den: 10 }, TASK_OUTCOME: { value: 1, num: 5, den: 5 }, TASK_DOC: { value: 10 }, SYSTEM_WORK: { value: 20 } }),
    member("b", { TASK_DONE: { value: 20 }, TASK_ONTIME: { value: 0.5, num: 5, den: 10 }, TASK_OUTCOME: { value: 0.5, num: 2, den: 4 }, TASK_DOC: { value: 5 }, SYSTEM_WORK: { value: 10 } }),
  ], weightsOf(), 0);
  check("بهترین در همه‌ی معیارها ۱۰۰ می‌گیرد", a.members[0].score === 100, String(a.members[0].score));
  check("نصفِ بهترین در همه‌ی معیارها ۵۰ می‌گیرد", a.members[1].score === 50, String(a.members[1].score));

  // ۲. نرخ با مخرج صفر: برای همان نفر کنار می‌رود، جریمه نمی‌شود
  const b = scoreGroup("OPERATIONS", [
    member("a", { TASK_DONE: { value: 10 }, TASK_ONTIME: { value: 1, num: 4, den: 4 } }),
    member("b", { TASK_DONE: { value: 10 }, TASK_ONTIME: null }),
  ], weightsOf(), 0);
  const bOnTime = b.members.find((m) => m.userId === "b")!.metrics.find((m) => m.code === "TASK_ONTIME")!;
  check("نرخ بی‌مخرج برای همان نفر «na» است", bOnTime.status === "na");
  check("نفرِ بی‌مخرج جریمه نمی‌شود", b.members.find((m) => m.userId === "b")!.score === 100);

  // ۳. معیاری که هیچ‌کس ندارد برای همه کنار می‌رود
  const docDropped = b.members[0].metrics.find((m) => m.code === "TASK_DOC")!;
  check("معیار بی‌عدد در کل گروه «dropped» است", docDropped.status === "dropped");

  // ۴. کف حجم: چهار کارِ عالی برنده نمی‌شود
  const c = scoreGroup("OPERATIONS", [
    member("big1", { TASK_DONE: { value: 50 }, TASK_ONTIME: { value: 0.6, num: 6, den: 10 } }),
    member("big2", { TASK_DONE: { value: 45 }, TASK_ONTIME: { value: 0.7, num: 7, den: 10 } }),
    member("tiny", { TASK_DONE: { value: 4 }, TASK_ONTIME: { value: 1, num: 4, den: 4 } }),
  ], weightsOf(), 60);
  const tiny = c.members.find((m) => m.userId === "tiny")!;
  check("زیر کف حجم واجد شرایط نیست", !tiny.eligible && tiny.rank === null, tiny.reason ?? "");
  check("امتیاز غیرواجد هم بین ۰ و ۱۰۰ می‌ماند", tiny.score >= 0 && tiny.score <= 100, String(tiny.score));
  check("رتبه‌ی ۱ با واجدین است", c.members[0].rank === 1 && c.members[0].eligible);

  // ۵. غایبِ کامل: «کمتر بهتر» نباید نمره‌ی کامل بدهد
  const d = scoreGroup("SALES", [
    member("seller", { SALES_DEALS: { value: 10 }, SALES_VOID: { value: 0.2, num: 2, den: 10 }, TASK_DONE: { value: 5 } }),
    member("absent", { SALES_DEALS: { value: 0 }, SALES_VOID: null, TASK_DONE: { value: 0 } }),
  ], metricsOf("SALES").map((m) => ({ code: m.code, weight: m.defaults.SALES ?? 0, isActive: true })), 0);
  check("بی‌حجم صفر می‌گیرد", d.members.find((m) => m.userId === "absent")!.score === 0);

  // ۶. حضور: یا برای همه یا برای هیچ‌کس
  const e = scoreGroup("OPERATIONS", [
    member("a", { TASK_DONE: { value: 20 } }, 10),
    member("b", { TASK_DONE: { value: 20 } }, 20),
  ], weightsOf(), 0);
  check("با حضور کامل، حجم روزانه مقایسه می‌شود", e.perDayApplied && e.members[0].userId === "a" && e.members[1].score === 50);
  const f = scoreGroup("OPERATIONS", [
    member("a", { TASK_DONE: { value: 20 } }, 10),
    member("b", { TASK_DONE: { value: 20 } }, null),
  ], weightsOf(), 0);
  check("حضور ناقص: نرمال‌سازی نمی‌شود و هشدار می‌آید", !f.perDayApplied && f.warnings.length > 0);

  // ۷. معیار غیرفعال از مخرج بیرون است
  const g = scoreGroup("OPERATIONS", [
    member("a", { TASK_DONE: { value: 10 }, TASK_DOC: { value: 0 } }),
    member("b", { TASK_DONE: { value: 5 }, TASK_DOC: { value: 8 } }),
  ], weightsOf({ TASK_DOC: { isActive: false } }), 0);
  check("معیار غیرفعال اثری ندارد", g.members[0].userId === "a" && g.members[0].score === 100);
}

async function realMonth(key: string) {
  console.log(`\n── داده‌ی واقعی ${key} ──`);
  const month = parseMonth(key);
  if (!month) { check("ماه معتبر", false, key); return; }
  const data = await monthScore(month);
  if (data.unassigned.length) console.log(`  بی‌گروه: ${data.unassigned.map((u) => u.name).join("، ")}`);

  for (const g of data.groups) {
    if (g.members.length === 0) continue;
    console.log(`  گروه ${g.group}${g.locked ? " (قفل)" : ""}: ${g.members.length} نفر، میانه‌ی حجم ${g.medianVolume}`);
    for (const m of g.members) {
      console.log(`    ${m.rank ?? "—"}. ${m.name}: ${m.score}${m.eligible ? "" : ` (${m.reason})`}`);
      check(`${m.name}: امتیاز بین ۰ و ۱۰۰`, Number.isFinite(m.score) && m.score >= 0 && m.score <= 100, String(m.score));
      const bad = m.metrics.filter((x) => [x.raw, x.normalized, x.points].some((v) => typeof v === "number" && !Number.isFinite(v)));
      check(`${m.name}: بدون NaN`, bad.length === 0, bad.map((x) => x.code).join(","));
      const offWeight = m.metrics.filter((x) => x.status !== "ok" && x.points !== 0);
      check(`${m.name}: معیار کنارگذاشته امتیاز ندارد`, offWeight.length === 0);
      check(`${m.name}: رتبه فقط برای واجد`, m.eligible === (m.rank !== null));
    }
  }
}

async function main() {
  syntheticCases();
  const arg = process.argv[2];
  const prev = (() => {
    const [y, m] = currentMonthKey().split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  await realMonth(arg ?? prev);
  console.log(failed ? `\n${failed} مورد ناموفق` : "\nهمه درست");
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
