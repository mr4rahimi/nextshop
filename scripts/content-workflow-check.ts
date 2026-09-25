/**
 * بررسی گردش کار محتوا روی دیتابیس — **فقط محلی**
 *
 *   npx tsx scripts/content-workflow-check.ts
 *
 * یک کار محتوا را از ساخت تا تأیید می‌برد، مقاله‌ی مجله را می‌سازد و منتشر
 * می‌کند، مرزهای نقش را امتحان می‌کند، و در آخر هرچه ساخته پاک می‌کند.
 *
 * ⚠️ اگر `DATABASE_URL` به localhost اشاره نکند اجرا نمی‌شود.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۶
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import type { StaffAccess } from "../lib/permissions";
import {
  createContentTask,
  transitionContentTask,
} from "../lib/marketing/content-task-service";
import {
  saveContentBody,
  updateContentPost,
  detachDeletedBlogPost,
} from "../lib/marketing/content-publish";

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

function access(
  user: { id: string; firstName: string | null; phone: string },
  permissions: string[],
): StaffAccess {
  return {
    userId: user.id,
    name: user.firstName ?? user.phone,
    phone: user.phone,
    role: "ADMIN",
    roleId: "test",
    roleTitle: "آزمایشی",
    permissions,
    isUnrestricted: false,
  };
}

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    select: { id: true, firstName: true, phone: true },
    take: 3,
  });
  if (users.length < 3) throw new Error("دست‌کم سه کارمند لازم است — seed-worklist-demo را اجرا کنید");

  const manager = access(users[0], ["CONTENT_TASK_MANAGE", "CONTENT_TASK_WORK", "MARKETING_VIEW_ALL"]);
  const writer = access(users[1], ["CONTENT_TASK_WORK"]);
  const publisher = access(users[2], ["CONTENT_TASK_WORK"]);

  const createdTasks: string[] = [];
  const createdPosts: string[] = [];

  try {
    console.log("ساخت و نقش‌ها");
    await expectError(
      "کارمند کار محتوا نمی‌سازد",
      () => createContentTask({ title: "x", writerId: writer.userId }, writer),
      "مدیر",
    );

    const task = await createContentTask(
      {
        title: "آزمایش گردش کار محتوا",
        primaryKeyword: "کلمه‌ی آزمایشی",
        writerId: writer.userId,
        publisherId: publisher.userId,
      },
      manager,
    );
    createdTasks.push(task.id);
    check("کار ساخته شد و واگذارشده است", task.status === "ASSIGNED");

    await expectError(
      "قبل از «شروع نوشتن» ذخیره‌ی متن رد می‌شود",
      () => saveContentBody(task.id, "<p>زود</p>", writer),
      "شروع نوشتن",
    );
    await expectError(
      "محتواگذار نمی‌تواند نوشتن را شروع کند",
      () => transitionContentTask(task.id, "start", {}, publisher),
    );

    console.log("نوشتن");
    await transitionContentTask(task.id, "start", {}, writer);
    await expectError(
      "ارسال متن خالی رد می‌شود",
      () => transitionContentTask(task.id, "submit", {}, writer),
      "متنی نوشته نشده",
    );
    const saved = await saveContentBody(task.id, "<p>یک دو سه چهار پنج</p>", writer);
    check("ذخیره‌ی پیش‌نویس، تعداد کلمه را برمی‌گرداند", saved.wordCount === 5, saved);
    const events1 = await prisma.contentTaskEvent.count({ where: { taskId: task.id } });
    await saveContentBody(task.id, "<p>یک دو سه چهار پنج شش</p>", writer);
    const events2 = await prisma.contentTaskEvent.count({ where: { taskId: task.id } });
    check("ذخیره‌ی پیش‌نویس رویداد نمی‌سازد (تله‌ی ۱۰)", events1 === events2);

    await transitionContentTask(task.id, "submit", {}, writer);
    await expectError(
      "بعد از ارسال، نویسنده دیگر متن را نمی‌نویسد",
      () => saveContentBody(task.id, "<p>دیر</p>", writer),
    );

    console.log("انتشار");
    await expectError(
      "محتوانویس نمی‌تواند انتشار را شروع کند",
      () => transitionContentTask(task.id, "take", {}, writer),
    );
    await transitionContentTask(task.id, "take", {}, publisher);
    const afterTake = await prisma.contentTask.findUnique({
      where: { id: task.id },
      select: { blogPostId: true, body: true, blogPost: { select: { content: true, status: true } } },
    });
    if (afterTake?.blogPostId) createdPosts.push(afterTake.blogPostId);
    check("مقاله‌ی پیش‌نویس ساخته شد", afterTake?.blogPost?.status === "DRAFT");
    check("متن به مقاله رفت و body خالی شد (قاعده‌ی ۲)",
      afterTake?.body === null && afterTake?.blogPost?.content.includes("شش") === true);

    await saveContentBody(task.id, "<p>متن نهایی روی مقاله با هفت کلمه</p>", publisher);
    const post1 = await prisma.blogPost.findUnique({
      where: { id: afterTake!.blogPostId! },
      select: { content: true },
    });
    check("ذخیره در مرحله‌ی انتشار روی BlogPost می‌نشیند", post1?.content.includes("نهایی") === true);

    await updateContentPost(task.id, { excerpt: "خلاصه", seoTitle: "عنوان سئو" }, publisher);
    await expectError(
      "محتوانویس مشخصات مقاله را در مرحله‌ی انتشار عوض نمی‌کند",
      () => updateContentPost(task.id, { excerpt: "نه" }, writer),
    );

    await transitionContentTask(task.id, "complete", {}, publisher);
    const afterComplete = await prisma.contentTask.findUnique({
      where: { id: task.id },
      select: { status: true, publishedUrl: true, blogPost: { select: { status: true, publishedAt: true } } },
    });
    check("انتشار: مقاله PUBLISHED شد", afterComplete?.blogPost?.status === "PUBLISHED");
    check("آدرس انتشار ثبت شد", !!afterComplete?.publishedUrl?.includes("/mag/"), afterComplete?.publishedUrl);
    const firstPublishedAt = afterComplete?.blogPost?.publishedAt?.getTime();

    console.log("تأیید و برگشت");
    await expectError(
      "محتواگذار از «منتظر تأیید» برنمی‌گرداند",
      () => transitionContentTask(task.id, "return", { note: "x" }, publisher),
    );
    await expectError(
      "برگشت بدون دلیل رد می‌شود",
      () => transitionContentTask(task.id, "return", {}, manager),
      "دلیل",
    );
    const back = await transitionContentTask(
      task.id,
      "return",
      { note: "پاراگراف دوم ضعیف است", toWriter: true },
      manager,
    );
    check("برگشت مستقیم به محتوانویس", back.status === "WRITING");
    await saveContentBody(task.id, "<p>اصلاح شد و حالا متن بهتر است</p>", writer);
    await transitionContentTask(task.id, "submit", {}, writer);
    await transitionContentTask(task.id, "take", {}, publisher);
    const posts = await prisma.blogPost.count({ where: { contentTask: { id: task.id } } });
    check("انتشار دوباره مقاله‌ی دوم نمی‌سازد", posts === 1);
    await transitionContentTask(task.id, "complete", {}, publisher);
    const republished = await prisma.blogPost.findUnique({
      where: { id: afterTake!.blogPostId! },
      select: { publishedAt: true },
    });
    check("بازنشر، تاریخ انتشار را جلو نمی‌برد", republished?.publishedAt?.getTime() === firstPublishedAt);

    await expectError(
      "کارمند تأیید نمی‌کند",
      () => transitionContentTask(task.id, "approve", {}, publisher),
      "مدیر",
    );
    const done = await transitionContentTask(task.id, "approve", {}, manager);
    check("تأیید کار را می‌بندد", done.status === "DONE");

    const notes = await prisma.staffNotification.count({ where: { entityId: task.id } });
    check("اعلان‌ها ساخته شدند", notes >= 4, notes);

    console.log("سایت بیرونی");
    const ext = await createContentTask(
      { title: "رپورتاژ آزمایشی", writerId: writer.userId, destination: "EXTERNAL" },
      manager,
    );
    createdTasks.push(ext.id);
    await transitionContentTask(ext.id, "start", {}, writer);
    await saveContentBody(ext.id, "<p>متن رپورتاژ</p>", writer);
    await transitionContentTask(ext.id, "submit", {}, writer);
    // محتواگذارِ خالی = خودِ نویسنده
    await transitionContentTask(ext.id, "take", {}, writer);
    const extTask = await prisma.contentTask.findUnique({
      where: { id: ext.id },
      select: { blogPostId: true },
    });
    check("مقصد بیرونی BlogPost نمی‌سازد", extTask?.blogPostId === null);
    await expectError(
      "تکمیلِ بیرونی بدون آدرس رد می‌شود",
      () => transitionContentTask(ext.id, "complete", {}, writer),
      "آدرس",
    );
    const extDone = await transitionContentTask(
      ext.id,
      "complete",
      { publishedUrl: "https://example.com/post" },
      writer,
    );
    check("آدرس بیرونی ثبت شد", extDone.publishedUrl === "https://example.com/post");

    console.log("حذف مقاله");
    await detachDeletedBlogPost(afterTake!.blogPostId!, { id: manager.userId, name: manager.name });
    await prisma.blogPost.delete({ where: { id: afterTake!.blogPostId! } });
    createdPosts.length = 0;
    const orphan = await prisma.contentTask.findUnique({
      where: { id: task.id },
      select: { blogPostId: true, body: true, deletedAt: true },
    });
    check("حذف مقاله کار را حذف نمی‌کند و متن برمی‌گردد (قاعده‌ی ۳)",
      orphan?.deletedAt === null && orphan?.blogPostId === null && !!orphan?.body?.includes("اصلاح"));
  } finally {
    // پاک‌سازی
    if (createdPosts.length) {
      await prisma.contentTask.updateMany({
        where: { blogPostId: { in: createdPosts } },
        data: { blogPostId: null },
      });
      await prisma.blogPost.deleteMany({ where: { id: { in: createdPosts } } });
    }
    await prisma.staffNotification.deleteMany({ where: { entityId: { in: createdTasks } } });
    await prisma.contentTask.deleteMany({ where: { id: { in: createdTasks } } });
  }

  console.log(`\n${passed} درست، ${failed} غلط`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
