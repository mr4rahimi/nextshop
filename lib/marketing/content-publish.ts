/**
 * اتصال کار محتوا به مقاله‌ی مجله (`BlogPost`) و ذخیره‌ی پیش‌نویس.
 *
 * سه قاعده‌ی بخش ۶.۲ مستندات:
 *
 * **۱. `ContentTask.blogPostId` یکتاست.** یک کار، یک مقاله.
 *
 * **۲. کار محتوا منبع حقیقتِ متن نیست؛ `BlogPost.content` است.** پیش‌نویس تا
 * لحظه‌ی ساخت مقاله در `ContentTask.body` می‌ماند؛ از لحظه‌ای که مقاله ساخته
 * شد، `body` خالی می‌شود و ذخیره روی همان مقاله می‌نشیند. دو نسخه از یک متن
 * یعنی روزی یکی کهنه می‌شود و کسی نمی‌فهمد کدام.
 *
 * **۳. حذف مقاله کار را حذف نمی‌کند** — `detachDeletedBlogPost` متن را به
 * کار برمی‌گرداند و رویداد می‌سازد.
 *
 * ⚠️ ذخیره‌ی پیش‌نویس **رویداد نمی‌سازد و اعلان نمی‌دهد** (تله‌ی ۱۰):
 * نویسنده ممکن است ده بار ذخیره کند.
 *
 * ⚠️ انتشار **فقط** از مسیر `transitionContentTask` («تکمیل انتشار») است و
 * `PANEL_CONTENT` نمی‌خواهد (بخش ۴، قاعده‌ی ۳).
 */

import { prisma } from "@/lib/prisma";
import { can, type StaffAccess } from "@/lib/permissions";
import { slugify } from "@/lib/slugify";
import { submitToIndexNow, blogPostUrl } from "@/lib/indexnow";
import { countWords } from "./types";

function readingTimeOf(html: string): number {
  return Math.max(1, Math.round(countWords(html) / 200));
}

/** اسلاگِ یکتا — اگر گرفته شده بود، پسوند عددی می‌خورد */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "post";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === exceptId) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * مقاله‌ی پیش‌نویسِ کار را می‌سازد (یا همان قبلی را برمی‌گرداند) و `body`
 * را خالی می‌کند.
 *
 * ⚠️ اجرای دوباره امن است: کاری که برگشت خورده و دوباره «در حال انتشار» شده،
 * مقاله‌ی دوم نمی‌سازد.
 */
export async function ensureBlogPost(taskId: string): Promise<string> {
  const task = await prisma.contentTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      body: true,
      primaryKeyword: true,
      relatedKeywords: true,
      brief: true,
      blogPostId: true,
    },
  });
  if (!task) throw new Error("کار پیدا نشد");
  if (task.blogPostId) return task.blogPostId;

  const content = task.body ?? "";
  const keywords = [task.primaryKeyword, task.relatedKeywords].filter(Boolean).join("، ");

  return prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.create({
      data: {
        title: task.title,
        slug: await uniqueSlug(task.title),
        content,
        status: "DRAFT",
        seoKeywords: keywords || null,
        readingTime: readingTimeOf(content),
      },
      select: { id: true },
    });
    await tx.contentTask.update({
      where: { id: taskId },
      data: { blogPostId: post.id, body: null },
    });
    return post.id;
  });
}

/**
 * انتشار مقاله. عنوان و متن و اسلاگ باید باشند.
 *
 * `publishedAt` مقاله‌ای که قبلاً منتشر شده دست نمی‌خورد — بازنشرِ بعد از
 * برگشت نباید تاریخ انتشار را جلو ببرد و ترتیب مجله را به‌هم بزند.
 */
export async function publishBlogPost(postId: string): Promise<{ url: string }> {
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: { id: true, title: true, slug: true, content: true, publishedAt: true },
  });
  if (!post) throw new Error("مقاله‌ی این کار پیدا نشد");
  if (!post.title.trim()) throw new Error("عنوان مقاله خالی است");
  if (countWords(post.content) === 0) throw new Error("متن مقاله خالی است");

  await prisma.blogPost.update({
    where: { id: postId },
    data: {
      status: "PUBLISHED",
      publishedAt: post.publishedAt ?? new Date(),
      readingTime: readingTimeOf(post.content),
    },
  });

  const url = blogPostUrl(post.slug);
  // خطای IndexNow انتشار را نمی‌شکند؛ خودش لاگ می‌کند
  void submitToIndexNow([url]);
  return { url };
}

// ─────────────────────────────────────────────────────────────────
// ذخیره‌ی پیش‌نویس
// ─────────────────────────────────────────────────────────────────

/**
 * چه کسی الان حق نوشتن روی متن را دارد.
 *
 * - «در حال نوشتن»: محتوانویس
 * - «در حال انتشار»: محتواگذار (ویرایش نهایی و افزودن عکس و لینک داخلی)
 * - مدیر: هر وقت کار باز است
 */
function canEditBody(
  task: {
    status: string;
    writerId: string | null;
    publisherId: string | null;
  },
  access: StaffAccess,
): boolean {
  const isManager = can(access, "CONTENT_TASK_MANAGE");
  if (task.status === "DONE" || task.status === "CANCELED") return false;
  if (isManager) return true;
  if (task.status === "WRITING") return task.writerId === access.userId;
  if (task.status === "PUBLISHING") {
    return (task.publisherId ?? task.writerId) === access.userId;
  }
  return false;
}

/**
 * ذخیره‌ی متن — **یک مسیر برای دستی و خودکار** (بخش ۶.۳)، وگرنه وضعیت
 * «ذخیره‌نشده» در دو جا جدا حساب می‌شود.
 */
export async function saveContentBody(taskId: string, html: string, access: StaffAccess) {
  const task = await prisma.contentTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, status: true, writerId: true, publisherId: true, blogPostId: true },
  });
  if (!task) throw new Error("کار پیدا نشد");
  if (!canEditBody(task, access)) {
    throw new Error(
      task.status === "ASSIGNED"
        ? "اول «شروع نوشتن» را بزنید"
        : "در این مرحله متن دست شما نیست",
    );
  }

  const wordCount = countWords(html);

  if (task.blogPostId) {
    // قاعده‌ی ۲: از وقتی مقاله ساخته شده، متن فقط آنجا نوشته می‌شود
    await prisma.$transaction([
      prisma.blogPost.update({
        where: { id: task.blogPostId },
        data: { content: html, readingTime: readingTimeOf(html) },
      }),
      prisma.contentTask.update({ where: { id: taskId }, data: { wordCount } }),
    ]);
  } else {
    await prisma.contentTask.update({
      where: { id: taskId },
      data: { body: html, wordCount },
    });
  }

  return { wordCount, savedAt: new Date().toISOString() };
}

export interface ContentPostMeta {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  coverImage?: string | null;
  categoryId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

function cleanOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

/**
 * مشخصات مقاله (نه متن) — کار محتواگذار در مرحله‌ی انتشار، یا مدیر.
 *
 * همین فرم است که نمی‌گذارد محتواگذار برای انتشار به `/admin/blog` و در نتیجه
 * به `PANEL_CONTENT` نیاز پیدا کند.
 */
export async function updateContentPost(
  taskId: string,
  meta: ContentPostMeta,
  access: StaffAccess,
) {
  const task = await prisma.contentTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, status: true, writerId: true, publisherId: true, blogPostId: true },
  });
  if (!task) throw new Error("کار پیدا نشد");
  if (!task.blogPostId) throw new Error("مقاله‌ی این کار هنوز ساخته نشده است");

  const isManager = can(access, "CONTENT_TASK_MANAGE");
  const isPublisher = (task.publisherId ?? task.writerId) === access.userId;
  if (!isManager && !(isPublisher && task.status === "PUBLISHING")) {
    throw new Error("مشخصات مقاله در مرحله‌ی انتشار دست محتواگذار است");
  }

  const data: Record<string, unknown> = {};
  if (meta.title !== undefined) {
    const title = cleanOrNull(meta.title);
    if (!title) throw new Error("عنوان مقاله لازم است");
    data.title = title;
  }
  if (meta.slug !== undefined) {
    const slug = slugify(meta.slug ?? "");
    if (!slug) throw new Error("نامک (اسلاگ) معتبر نیست");
    const hit = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (hit && hit.id !== task.blogPostId) throw new Error("این نامک را مقاله‌ی دیگری دارد");
    data.slug = slug;
  }
  if (meta.excerpt !== undefined) data.excerpt = cleanOrNull(meta.excerpt);
  if (meta.coverImage !== undefined) data.coverImage = cleanOrNull(meta.coverImage);
  if (meta.seoTitle !== undefined) data.seoTitle = cleanOrNull(meta.seoTitle);
  if (meta.seoDescription !== undefined) data.seoDescription = cleanOrNull(meta.seoDescription);
  if (meta.categoryId !== undefined) {
    const categoryId = cleanOrNull(meta.categoryId);
    if (categoryId) {
      const cat = await prisma.blogCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!cat) throw new Error("دسته‌ی مقاله پیدا نشد");
    }
    data.categoryId = categoryId;
  }

  return prisma.blogPost.update({
    where: { id: task.blogPostId },
    data,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      excerpt: true,
      coverImage: true,
      categoryId: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
    },
  });
}

/**
 * پیش از حذف یک مقاله از `/admin/blog` صدا زده می‌شود (قاعده‌ی ۳).
 *
 * متن مقاله به `body` کار برمی‌گردد تا «چه کسی چه نوشت» با پاک‌شدن مقاله از
 * بین نرود، و یک رویداد سیستمی ثبت می‌شود. خطا حذف را نمی‌شکند.
 */
export async function detachDeletedBlogPost(postId: string, actor: { id: string; name: string } | null) {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { title: true, content: true, contentTask: { select: { id: true, status: true } } },
    });
    const task = post?.contentTask;
    if (!post || !task) return;

    await prisma.$transaction([
      prisma.contentTask.update({
        where: { id: task.id },
        data: { blogPostId: null, body: post.content, wordCount: countWords(post.content) },
      }),
      prisma.contentTaskEvent.create({
        data: {
          taskId: task.id,
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? null,
          action: "SYSTEM",
          fromStatus: task.status,
          toStatus: task.status,
          note: `مقاله‌ی «${post.title}» از مجله حذف شد؛ متنش به همین کار برگشت`,
        },
      }),
    ]);
  } catch (e) {
    console.error("[content] جداکردن مقاله‌ی حذف‌شده شکست خورد:", e);
  }
}
