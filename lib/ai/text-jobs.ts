/**
 * کارهای پس‌زمینه‌ی نوشتن متن محصول — docs/features/ai-product-text.md
 *
 * مثل `image-jobs.ts`: درخواست فوراً شناسه می‌گیرد و مرورگر وضعیت را می‌پرسد، چون
 * متن کامل با عکس ۱۰ تا ۴۰ ثانیه و تولید گروهی چند دقیقه طول می‌کشد و nginx/CDN
 * حدود ۶۰ ثانیه قطع می‌کنند. نگه‌داری در حافظه (یک پروسه‌ی pm2)؛ با ری‌استارت
 * کار نیمه‌کاره گم می‌شود ولی هر محصولِ تمام‌شده همان لحظه ذخیره شده است.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { slugify } from "@/lib/slug";
import { redirectSlugChange } from "@/lib/slugRedirect";
import { getAiSettings } from "@/lib/ai/settings";
import { generateProductText, imageToDataUrl, type ProductTextInput } from "@/lib/ai/product-text";
import type { AiTextResult, AiTextSection, AiTextUsage } from "@/lib/ai/text-presets";

type Actor = { id: string; name: string; phone: string | null };

export interface AiTextJob {
  id: string;
  userId: string;
  kind: "single" | "bulk";
  status: "running" | "done" | "error";
  createdAt: number;
  finishedAt?: number;
  error?: string;
  /** single */
  result?: AiTextResult;
  usage?: AiTextUsage;
  /** bulk */
  total?: number;
  items?: { productId: string; title: string; status: "pending" | "running" | "done" | "skipped" | "error"; note?: string }[];
  costUsd?: number;
  cancelled?: boolean;
}

const JOB_TTL_MS = 60 * 60 * 1000;
const g = globalThis as unknown as { __aiTextJobs?: Map<string, AiTextJob> };
const jobs = (g.__aiTextJobs ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [id, j] of jobs) if (j.status !== "running" && now - j.createdAt > JOB_TTL_MS) jobs.delete(id);
}

export function getTextJob(id: string, userId: string): AiTextJob | null {
  sweep();
  const j = jobs.get(id);
  return j && j.userId === userId ? j : null;
}

export function runningTextJobs(userId: string, kind: AiTextJob["kind"]) {
  let n = 0;
  for (const j of jobs.values()) if (j.userId === userId && j.kind === kind && j.status === "running") n++;
  return n;
}

function newJob(userId: string, kind: AiTextJob["kind"]): AiTextJob {
  sweep();
  const job: AiTextJob = { id: randomUUID(), userId, kind, status: "running", createdAt: Date.now() };
  jobs.set(job.id, job);
  return job;
}

// ─── تکی (فرم محصول) ───────────────────────────────────────────────────────

export function startTextJob(opts: { userId: string; actor: Actor; input: ProductTextInput }): AiTextJob {
  const job = newJob(opts.userId, "single");
  void (async () => {
    try {
      const s = await getAiSettings();
      const { result, usage } = await generateProductText(s, opts.input);
      job.result = result;
      job.usage = usage;
      job.status = "done";
      void logActivity({
        action: "CREATE",
        entity: "PRODUCT",
        entityTitle: result.titles[0] || opts.input.title || "متن محصول",
        summary: `متن محصول با هوش مصنوعی نوشته شد — مدل ${usage.model}، هزینه‌ی تقریبی ${usage.costUsd.toFixed(4)} دلار`,
        actor: opts.actor,
      });
    } catch (e) {
      job.status = "error";
      job.error = (e instanceof Error && e.message) || "خطای ناشناخته در نوشتن متن.";
      console.error("[ai-text]", job.error);
    } finally {
      job.finishedAt = Date.now();
    }
  })();
  return job;
}

// ─── گروهی (فهرست محصولات، ساخت از انبار) ─────────────────────────────────

export interface BulkOptions {
  sections: AiTextSection[];
  /** عنوان هم استاندارد شود؛ نشانی فقط برای پیش‌نویس (غیرفعال) عوض می‌شود */
  retitle: boolean;
}

export function startBulkTextJob(opts: { userId: string; actor: Actor; productIds: string[]; options: BulkOptions }): AiTextJob {
  const job = newJob(opts.userId, "bulk");
  job.total = opts.productIds.length;
  job.items = opts.productIds.map(id => ({ productId: id, title: "", status: "pending" }));
  job.costUsd = 0;

  void (async () => {
    try {
      const s = await getAiSettings();
      // پشت‌سرهم، نه موازی: محدودیت نرخ GapGPT و قابل‌پیش‌بینی بودن هزینه
      for (const item of job.items!) {
        if (job.cancelled) { item.status = "skipped"; item.note = "لغو شد"; continue; }
        item.status = "running";
        try {
          const r = await fillProduct(s, item.productId, opts.options, opts.actor);
          item.title = r.title;
          item.status = r.changed.length ? "done" : "skipped";
          item.note = r.changed.length ? r.changed.join("، ") : "همه‌ی بخش‌ها از قبل پر بود";
          job.costUsd! += r.cost;
        } catch (e) {
          item.status = "error";
          item.note = (e instanceof Error && e.message) || "خطا";
          // کلید یا اعتبار مشکل دارد — ادامه‌دادن فقط همان خطا را تکرار می‌کند
          if (/کلید|اعتبار/.test(item.note)) job.cancelled = true;
        }
      }
      job.status = "done";
    } catch (e) {
      job.status = "error";
      job.error = (e instanceof Error && e.message) || "خطای ناشناخته";
    } finally {
      job.finishedAt = Date.now();
    }
  })();
  return job;
}

export function cancelTextJob(id: string, userId: string) {
  const j = getTextJob(id, userId);
  if (j && j.status === "running") j.cancelled = true;
  return !!j;
}

const empty = (v: unknown) => v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);

/**
 * متن یک محصول را می‌نویسد و **فقط بخش‌های خالی** را ذخیره می‌کند. مشخصات فنی فقط
 * ردیف‌های خالیِ گروه‌هایی که محصول از قبل دارد، و فقط مقدارهایی که از ورودی آمده‌اند
 * (fromInput) — در حالت گروهی کسی برچسب «نیاز به بررسی» را نمی‌بیند.
 */
export async function fillProduct(
  s: Awaited<ReturnType<typeof getAiSettings>>, productId: string, o: BulkOptions, actor: Actor,
) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      specs: { include: { specItem: { select: { groupId: true } } } },
      variants: { where: { isActive: true }, select: { title: true }, take: 60 },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });
  if (!p) throw new Error("محصول پیدا نشد");

  const groupIds = [...new Set(p.specs.map(x => x.specItem.groupId))];
  const specItems = groupIds.length
    ? await prisma.specItem.findMany({ where: { groupId: { in: groupIds } }, orderBy: [{ groupId: "asc" }, { sortOrder: "asc" }], select: { id: true, title: true } })
    : [];
  const valueOf = new Map(p.specs.map(x => [x.specItemId, x.value]));

  const want = new Set<AiTextSection>(o.sections);
  if (!o.retitle) want.delete("title");
  if (!empty(p.shortDescription)) want.delete("short");
  if (!empty(p.expertDescription)) want.delete("expert");
  if (!empty(p.features)) want.delete("features");
  if (!empty(p.faq)) want.delete("faq");
  if (!empty(p.seoDescription) && !empty(p.seoTitle)) want.delete("seo");
  const missingSpecs = specItems.filter(it => !valueOf.get(it.id)?.trim());
  if (!missingSpecs.length) want.delete("specs");
  if (!want.size) return { title: p.title, changed: [] as string[], cost: 0 };

  const input: ProductTextInput = {
    title: p.title,
    categoryId: p.categoryId,
    brandId: p.brandId,
    image: await imageToDataUrl(p.mainImage || p.images[0]?.url || ""),
    specItems: specItems.map(it => ({ id: it.id, title: it.title, value: valueOf.get(it.id) })),
    variantInfo: [...new Set(p.variants.map(v => v.title))].join("، "),
    notes: [p.shortDescription, ...(Array.isArray(p.features) ? (p.features as string[]) : [])].filter(Boolean).join("\n"),
    sections: [...want],
  };
  const { result: r, usage } = await generateProductText(s, input);

  const data: Record<string, unknown> = {};
  const changed: string[] = [];
  if (want.has("title") && r.titles[0] && r.titles[0] !== p.title) {
    data.title = r.titles[0];
    changed.push("عنوان");
  }
  if (want.has("short") && r.shortDescription) { data.shortDescription = r.shortDescription; changed.push("توضیح کوتاه"); }
  if (want.has("expert") && r.expertDescription) {
    data.expertDescription = r.expertDescription;
    if (empty(p.expertTitle) && r.expertTitle) data.expertTitle = r.expertTitle;
    changed.push("بررسی تخصصی");
  }
  if (want.has("features") && r.features.length) { data.features = r.features; changed.push("ویژگی‌ها"); }
  if (want.has("faq") && r.faq.length) { data.faq = r.faq; changed.push("سوالات متداول"); }
  if (want.has("seo")) {
    if (empty(p.seoTitle) && r.seoTitle) data.seoTitle = r.seoTitle;
    if (empty(p.seoDescription) && r.seoDescription) data.seoDescription = r.seoDescription;
    if (empty(p.seoKeywords) && r.seoKeywords) data.seoKeywords = r.seoKeywords;
    if (data.seoTitle || data.seoDescription) changed.push("سئو");
  }
  const specs = want.has("specs") ? r.specs.filter(x => x.fromInput && missingSpecs.some(m => m.id === x.specItemId)) : [];
  if (specs.length) changed.push(`${specs.length} مشخصه`);

  if (changed.length) {
    await prisma.$transaction(async tx => {
      if (data.title && !p.isActive) {
        // پیش‌نویس هنوز ایندکس نشده؛ نشانی هم با عنوان تازه هم‌خوان شود
        const base = slugify(String(data.title)) || "product";
        let slug = base;
        for (let n = 2; await tx.product.findFirst({ where: { slug, id: { not: p.id } }, select: { id: true } }); n++) slug = `${base}-${n}`;
        data.slug = slug;
      }
      await tx.product.update({ where: { id: p.id }, data });
      if (data.slug) await redirectSlugChange(tx, "product", p.slug, String(data.slug));
      for (const sp of specs) {
        await tx.productSpecValue.upsert({
          where: { productId_specItemId: { productId: p.id, specItemId: sp.specItemId } },
          update: { value: sp.value },
          create: { productId: p.id, specItemId: sp.specItemId, value: sp.value },
        });
      }
    });
    void logActivity({
      action: "UPDATE",
      entity: "PRODUCT",
      entityId: p.id,
      entityTitle: String(data.title ?? p.title),
      summary: `متن با هوش مصنوعی تکمیل شد: ${changed.join("، ")} — هزینه‌ی تقریبی ${usage.costUsd.toFixed(4)} دلار`,
      actor,
    });
  }
  return { title: String(data.title ?? p.title), changed, cost: usage.costUsd };
}
