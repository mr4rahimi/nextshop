/**
 * بررسی لینک‌سازی روی دیتابیس — **فقط محلی**
 *
 *   npx tsx scripts/link-workflow-check.ts
 *
 * یک کمپین با دو صفحه‌ی هدف و سه لایه گره می‌سازد و لایه، حلقه، قفل پیش‌نیاز،
 * ساخت برنامه، گردش کار، اتصال محتوا، آمار و نگهبان‌های حذف را امتحان
 * می‌کند. در آخر هرچه ساخته پاک می‌شود.
 *
 * ⚠️ اگر `DATABASE_URL` به localhost اشاره نکند اجرا نمی‌شود.
 * ⚠️ مسئول گره باید مجوز `LINK_WORK` داشته باشد؛ اسکریپت از ادمین‌های
 * بی‌نقش (که همه‌ی مجوزها را دارند) استفاده می‌کند.
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import type { StaffAccess } from "../lib/permissions";
import {
  addTarget,
  campaignStats,
  createCampaign,
  createNode,
  deleteCampaign,
  deleteNode,
  deleteTarget,
  getCampaign,
  getCanvas,
  getNode,
  listNodes,
  saveLayout,
  updateNode,
} from "../lib/marketing/link-service";
import {
  buildPlan,
  createContentForNode,
  transitionNode,
} from "../lib/marketing/link-workflow";
import { transitionContentTask } from "../lib/marketing/content-task-service";
import { saveContentBody } from "../lib/marketing/content-publish";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("فقط روی دیتابیس محلی اجرا می‌شود");
  process.exit(1);
}

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
async function expectError(label: string, fn: () => Promise<unknown>, contains?: string) {
  try {
    await fn();
    check(label, false, "خطا نداد");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(label, !contains || msg.includes(contains), msg);
  }
}

function access(u: { id: string; firstName: string | null; phone: string }, perms: string[], unrestricted = false): StaffAccess {
  return {
    userId: u.id,
    name: u.firstName ?? u.phone,
    phone: u.phone,
    role: "ADMIN",
    roleId: unrestricted ? null : "test",
    roleTitle: null,
    permissions: perms,
    isUnrestricted: unrestricted,
  };
}

async function main() {
  // ادمین‌های بی‌نقش همه‌ی مجوزها را دارند و در usersWithPermission می‌آیند
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: "ADMIN", staffRoleId: null },
    select: { id: true, firstName: true, phone: true },
    take: 2,
  });
  if (admins.length < 1) throw new Error("یک ادمین بی‌نقش لازم است");
  const manager = access(admins[0], [], true);
  // کارمند لینک‌سازی: همان ادمین ولی با دسترسی محدود، تا مرز نقش امتحان شود
  const worker = access(admins[0], ["LINK_WORK", "CONTENT_TASK_WORK"]);
  const outsider = access(admins[admins.length - 1], ["LINK_WORK"]);
  outsider.userId = "someone-else";

  let campaignId = "";
  const contentIds: string[] = [];

  try {
    console.log("کمپین و صفحه‌ی هدف");
    await expectError("کمپین بدون صفحه‌ی هدف ساخته نمی‌شود", () =>
      createCampaign({ title: "بی‌هدف" }, manager),
    );
    await expectError("کارمند کمپین نمی‌سازد", () =>
      createCampaign({ title: "x", firstTarget: { url: "https://a.ir/" } }, worker),
    );
    const c = await createCampaign(
      {
        title: "آزمایش لینک‌سازی",
        weeklyQuota: 2,
        firstTarget: { url: "https://shop.test/category/printer", label: "پرینتر", primaryKeyword: "خرید پرینتر" },
      },
      manager,
    );
    campaignId = c.id;
    const t2 = await addTarget(campaignId, { url: "https://shop.test/p/hp-107a", label: "HP 107a" }, manager);
    await expectError("صفحه‌ی تکراری رد می‌شود", () =>
      addTarget(campaignId, { url: "https://shop.test/p/hp-107a" }, manager),
    );
    const camp = await getCampaign(campaignId);
    const t1 = camp.targets[0];
    check("دو صفحه‌ی هدف", camp.targets.length === 2);

    const types = await prisma.linkType.findMany({ where: { key: { in: ["GUEST_POST", "WEB2", "SOCIAL"] } } });
    const typeOf = (k: string) => types.find((t) => t.key === k)!.id;

    console.log("گره و لایه");
    const a = await createNode(
      {
        campaignId,
        typeId: typeOf("GUEST_POST"),
        anchorText: "خرید پرینتر",
        anchorKind: "EXACT",
        assigneeId: manager.userId,
        destinations: [{ toTargetId: t1.id }, { toTargetId: t2.id }],
      },
      manager,
    );
    check("گره به دو صفحه لینک می‌دهد و لایه‌ی ۱ است", a.tier === 1 && a.destinations.length === 2);
    check("پیش‌فرض نوع: مهمان‌نویسی محتوای متنی می‌خواهد", a.contentKind === "TEXT");
    const social = await createNode({ campaignId, typeId: typeOf("SOCIAL") }, manager);
    check("پیش‌فرض نوع: شبکه‌ی اجتماعی نوفالو", social.relFollow === false);
    check("گره‌ی بی‌مقصد معلق است", social.tier === null);

    const b = await createNode(
      { campaignId, typeId: typeOf("WEB2"), anchorKind: "BRAND", assigneeId: manager.userId, destinations: [{ toNodeId: a.id }] },
      manager,
    );
    check("لینک به گره‌ی لایه‌ی ۱ = لایه‌ی ۲", b.tier === 2);
    await expectError(
      "حلقه رد می‌شود",
      () => updateNode(a.id, { destinations: [{ toNodeId: b.id }] }, manager),
      "حلقه",
    );
    await expectError("مقصدِ دوگانه رد می‌شود", () =>
      updateNode(b.id, { destinations: [{ toNodeId: a.id, toTargetId: t1.id }] }, manager),
    );
    await expectError(
      "گره‌ای که به آن لینک داده می‌شود حذف نمی‌شود",
      () => deleteNode(a.id, manager),
      "لینک می‌دهد",
    );
    await expectError(
      "صفحه‌ای که به آن لینک داده می‌شود حذف نمی‌شود",
      () => deleteTarget(t1.id, manager),
      "لینک می‌دهد",
    );

    // تغییر یال لایه را بازمحاسبه می‌کند
    await updateNode(social.id, { destinations: [{ toNodeId: b.id }] }, manager);
    check("وصل‌کردن معلق به لایه‌ی ۲ = لایه‌ی ۳", (await getNode(social.id)).tier === 3);

    console.log("برنامه و قفل پیش‌نیاز");
    const plan = await buildPlan(campaignId, manager);
    check("ساخت برنامه: دو گره واگذار، یکی بی‌مسئول", plan.assigned === 2 && plan.skippedWithoutAssignee === 1, plan);
    const again = await buildPlan(campaignId, manager);
    check("اجرای دوباره امن است", again.assigned === 0);
    check("سقف هفتگی مهلت می‌دهد", !!(await getNode(a.id)).dueAt);
    check("لایه‌ی ۲ «در انتظار پیش‌نیاز» است", (await getNode(b.id)).isBlocked === true);
    await expectError("شروعِ گره‌ی مسدود سمت سرور رد می‌شود", () => transitionNode(b.id, "start", {}, worker), "پیش‌نیاز");
    await expectError("کارمند غریبه روی گره‌ی دیگری دکمه ندارد", () => transitionNode(a.id, "start", {}, outsider), "ارجاع نشده");

    console.log("اتصال محتوا");
    const withContent = await createContentForNode(a.id, { writerId: manager.userId }, manager);
    contentIds.push(withContent.content!.taskId);
    const task = await prisma.contentTask.findUnique({ where: { id: withContent.content!.taskId } });
    check("کار محتوای بیرونی ساخته شد، کلمه‌ی کلیدی از صفحه‌ی هدف", task?.destination === "EXTERNAL" && task.primaryKeyword === "خرید پرینتر", task?.primaryKeyword);
    check("گره «در انتظار محتوا» است", withContent.content?.isReady === false);
    await expectError("تا متن نرسیده شروع نمی‌شود", () => transitionNode(a.id, "start", {}, worker), "محتوای این گره");
    await transitionContentTask(task!.id, "start", {}, manager);
    await saveContentBody(task!.id, "<p>متن مهمان‌نویسی</p>", manager);
    await transitionContentTask(task!.id, "submit", {}, manager);
    check("متن ارسال شد → گره آزاد", (await getNode(a.id)).content?.isReady === true);
    await expectError("دو گره به یک کار محتوا وصل نمی‌شوند", () =>
      prisma.linkNode.update({ where: { id: b.id }, data: { contentTaskId: task!.id } }),
    );

    console.log("گردش کار گره");
    await transitionNode(a.id, "start", {}, worker);
    await expectError("ثبت لینک بدون آدرس ممکن نیست", () => transitionNode(a.id, "submit", {}, worker), "آدرس");
    await transitionNode(a.id, "submit", { publishedUrl: "https://blog.example.com/post-1" }, worker);
    await expectError("کارمند تأیید نمی‌کند", () => transitionNode(a.id, "approve", {}, worker), "مدیر");
    await expectError("برگشت بدون دلیل رد می‌شود", () => transitionNode(a.id, "return", {}, manager), "دلیل");
    await transitionNode(a.id, "return", { note: "لینک در فوتر است نه درون‌متن" }, manager);
    check("برگشت شمرده می‌شود", (await getNode(a.id)).returnCount === 1);
    await transitionNode(a.id, "submit", { publishedUrl: "https://blog.example.com/post-1" }, worker);
    const live = await transitionNode(a.id, "approve", {}, manager);
    check("تأیید = فعال با تاریخ", live.status === "LIVE" && !!live.liveAt);
    check("مقصد زنده شد → لایه‌ی ۲ آزاد", (await getNode(b.id)).isBlocked === false);
    await expectError("«نشد» بدون دلیل رد می‌شود", () => transitionNode(b.id, "fail", {}, worker), "دلیل");
    await transitionNode(b.id, "fail", { note: "حساب بسته شد" }, worker);
    await transitionNode(a.id, "lost", {}, manager);
    const reopened = await transitionNode(b.id, "reopen", {}, manager);
    check("بازگشایی به واگذارشده برمی‌گردد", reopened.status === "ASSIGNED");

    const events = await prisma.linkNodeEvent.count({ where: { nodeId: a.id } });
    check("هر انتقال یک رویداد", events >= 7, events);

    console.log("آمار و بوم");
    const stats = await campaignStats(campaignId);
    check("شمارش گره‌ها", stats.total === 3);
    check("پیشرفت: ازدست‌رفته در مخرج می‌ماند (۰٪)", stats.progressPercent === 0);
    check("توزیع انکر ثبت‌نشده را نشان می‌دهد", stats.anchors.some((x) => x.kind === "UNSET"));
    check("توزیع هر صفحه‌ی هدف جداست", stats.perTarget.length === 2 && stats.perTarget[1].total === 1);

    const canvas = await getCanvas(campaignId);
    check("بوم تازه pristine است", canvas.isPristine && canvas.edges.length === 4);
    await saveLayout(
      campaignId,
      [
        { id: a.id, kind: "node", posX: 330, posY: 0 },
        { id: "بیگانه", kind: "node", posX: 1, posY: 1 },
      ],
      manager,
    );
    const canvas2 = await getCanvas(campaignId);
    check("ذخیره‌ی چیدمان: بیگانه بی‌صدا رد، pristine خاموش", !canvas2.isPristine && canvas2.nodes.find((n) => n.id === a.id)?.posX === 330);

    console.log("مرز دید");
    const mine = await listNodes({}, outsider);
    check("کارمند بی‌مجوز دید فقط گره‌های خودش را می‌گیرد", mine.length === 0);

    console.log("حذف");
    await expectError("کمپین با گره‌ی در جریان حذف نمی‌شود", () => deleteCampaign(campaignId, manager), "در جریان");
  } finally {
    if (campaignId) {
      const nodes = await prisma.linkNode.findMany({ where: { campaignId }, select: { id: true } });
      await prisma.staffNotification.deleteMany({
        where: { entityId: { in: [campaignId, ...nodes.map((n) => n.id), ...contentIds] } },
      });
      await prisma.linkCampaign.delete({ where: { id: campaignId } });
    }
    if (contentIds.length) await prisma.contentTask.deleteMany({ where: { id: { in: contentIds } } });
  }

  console.log(`\n${passed} درست، ${failed} غلط`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
