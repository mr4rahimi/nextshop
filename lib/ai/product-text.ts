/**
 * نوشتن متن محصول با هوش مصنوعی — docs/features/ai-product-text.md
 *
 * ورودی: عکس (اختیاری) + یادداشت کاربر + دسته و برند فرم. خروجی: عنوان استاندارد
 * (سه پیشنهاد)، توضیح کوتاه، متن «بررسی تخصصی» با بخش مزایا، ویژگی‌ها، مقدار
 * ردیف‌های مشخصات فنی، FAQ و سئو. چیزی ذخیره نمی‌کند؛ فرم محصول یا تولید گروهی
 * (`lib/ai/text-jobs.ts`) تصمیم می‌گیرد کدام را بنویسد.
 */
import OpenAI from "openai";
import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { GAPGPT_BASE_URL, type AiSettings } from "@/lib/ai/settings";
import {
  TONE_LABEL, estimateCost,
  type AiTextResult, type AiTextSection, type AiTextUsage,
} from "@/lib/ai/text-presets";

export interface ProductTextInput {
  title?: string;
  /** هر چه کاربر نوشته: مدل، ویژگی‌ها، جنس، کاربرد… */
  notes?: string;
  categoryId?: string | null;
  brandId?: string | null;
  /** data URL عکس محصول */
  image?: string | null;
  /** ردیف‌های مشخصات فنی که باید پر شوند (گروه انتخاب‌شده در فرم) */
  specItems?: { id: string; title: string; value?: string }[];
  /** رنگ‌ها و سایزهای تنوع‌ها، برای محصولی که از انبار ساخته شده */
  variantInfo?: string;
  sections: AiTextSection[];
}

const REQUEST_TIMEOUT_MS = 150_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// ─── زمینه: دسته، برند، الگوی عنوان ──────────────────────────────────────────

async function loadContext(s: AiSettings, input: ProductTextInput) {
  const chain: { id: string; title: string }[] = [];
  let catId = input.categoryId || null;
  // مسیر دسته تا ریشه — «پرینتر › لیزری» نوع کالا را دقیق‌تر می‌گوید
  for (let i = 0; catId && i < 6; i++) {
    const c = await prisma.category.findUnique({ where: { id: catId }, select: { id: true, title: true, parentId: true } });
    if (!c) break;
    chain.unshift({ id: c.id, title: c.title });
    catId = c.parentId;
  }
  const brand = input.brandId
    ? await prisma.brand.findUnique({ where: { id: input.brandId }, select: { title: true } })
    : null;

  // نزدیک‌ترین الگوی دسته (خود دسته، بعد والدها)، وگرنه الگوی کلی
  const tpl = [...chain].reverse().map(c => s.titleTemplates.find(t => t.categoryId === c.id)).find(Boolean);
  return {
    categoryPath: chain.map(c => c.title).join(" › "),
    brand: brand?.title ?? null,
    titlePattern: tpl?.pattern || s.titlePattern,
    titleExamples: (tpl?.example?.trim() ? tpl.example : s.titleExamples).trim(),
  };
}

// ─── پرامپت ────────────────────────────────────────────────────────────────

function buildSystemPrompt(s: AiSettings, ctx: Awaited<ReturnType<typeof loadContext>>, want: Set<AiTextSection>) {
  const lines: string[] = [
    "تو نویسنده‌ی حرفه‌ای محتوای فروشگاه اینترنتی ایرانی هستی. متن فارسی روان، دقیق و قابل‌اعتماد می‌نویسی.",
    `لحن: ${TONE_LABEL[s.textTone]}.`,
    "",
    "قوانین کلی:",
    "- فقط از اطلاعاتی استفاده کن که در عکس یا یادداشت کاربر آمده، یا با اطمینان درباره‌ی همین مدل دقیق می‌دانی. حدس نزن.",
    "- قیمت، موجودی، تخفیف، زمان ارسال و شرایط گارانتی را ننویس مگر کاربر گفته باشد.",
    "- متن ساده بنویس: بدون Markdown، بدون ** و #، بدون ایموجی.",
    "- کد مدل را به شکل رسمی سازنده بنویس (حروف بزرگ و کوچک درست، مثلاً M141w نه m141w). حروف «ی» و «ک» فارسی باشند.",
    "- ادعای کیفی بی‌پشتوانه («دوام را تضمین می‌کند»، «کیفیت بی‌نقص») ننویس؛ مزیت را با ویژگی واقعی توضیح بده.",
  ];
  if (s.textBannedWords.trim()) lines.push(`- این کلمه‌ها و ادعاها ممنوع‌اند: ${s.textBannedWords.trim()}`);
  if (s.textRules.trim()) lines.push(`- قواعد این فروشگاه:\n${s.textRules.trim()}`);

  if (want.has("title")) {
    lines.push(
      "",
      "عنوان محصول (titles): دقیقاً ۳ پیشنهاد طبق این الگو:",
      `  ${ctx.titlePattern}`,
      "  نمونه‌های درست:",
      ...ctx.titleExamples.split("\n").filter(Boolean).map(e => `  - ${e.trim()}`),
      "  - «نوع کالا» نام عمومی و جست‌وجوپذیر کالاست (مثلاً «پرینتر لیزری»، «پیراهن مردانه»)، نه نام دسته‌ی کلی.",
      ctx.brand
        ? `  - برند را دقیقاً «${ctx.brand}» بنویس.`
        : "  - اگر برند روی عکس یا در یادداشت هست بیاور و در brandGuess هم برگردان؛ اگر نیست، بخش برند را حذف کن.",
      "  - «مدل» فقط کد یا نام مدلی است که سازنده یا فروشنده گفته (روی عکس یا در یادداشت). اگر نیست، بخش «مدل» را کامل حذف کن؛ سبک یا رنگ را جای مدل نگذار و کد نساز.",
      "  - ویژگی کلیدی ۱ تا ۳ ویژگی متمایزکننده است (مثل «سه کاره»، «چهارخانه»، «۱۲۸ گیگابایت»)، نه صفت تبلیغاتی.",
      "  - حداکثر ۸۰ کاراکتر، بدون علامت نگارشی اضافه.",
      "  - سه پیشنهاد در انتخاب یا ترتیب ویژگی‌های کلیدی با هم فرق داشته باشند؛ اولی بهترین است.",
    );
  }
  if (want.has("short")) lines.push("", "shortDescription: یک یا دو جمله، حداکثر ۲۰۰ کاراکتر؛ مهم‌ترین کاربرد و مزیت.");
  if (want.has("expert")) {
    lines.push(
      "",
      "expertTitle: یک تیتر کوتاه برای بخش «بررسی تخصصی» (مثلاً «بررسی تخصصی پرینتر لیزری اچ پی M141w»).",
      "expertDescription: متن فروشگاهی ۳ تا ۵ پاراگراف (حدود ۲۵۰ تا ۴۰۰ کلمه) با خط خالی بین پاراگراف‌ها:",
      "  معرفی و کاربرد، طراحی و کیفیت ساخت، عملکرد و ویژگی‌های مهم، مناسب چه کسی است.",
      "benefits: ۴ تا ۶ مزیت کوتاه از دید خریدار (هر کدام یک جمله‌ی کوتاه).",
    );
  }
  if (want.has("features")) lines.push("", "features: ۵ تا ۸ ویژگی اصلی، هر کدام حداکثر ۶۰ کاراکتر و مشخص (عدد و واحد اگر معلوم است).");
  if (want.has("specs")) {
    lines.push(
      "",
      "specs: برای ردیف‌های مشخصات فنی که در پیام کاربر آمده مقدار کوتاه بده (مثلاً «۲۰ صفحه در دقیقه»، «A4»، «۷ کیلوگرم»).",
      "  id را دقیقاً همان شناسه‌ی ردیف بگذار. اول از عکس و یادداشت کاربر پر کن (fromInput=true).",
      "  اگر کد مدل دقیق معلوم است و مشخصات رسمی آن مدل را با اطمینان می‌دانی، بقیه‌ی ردیف‌ها را هم پر کن (fromInput=false)؛",
      "  فروشنده این‌ها را با برچسب «نیاز به بررسی» می‌بیند. ردیفی را که نمی‌دانی اصلاً نیاور (مقدار خالی نفرست).",
    );
  }
  if (want.has("faq")) lines.push("", "faq: ۴ تا ۶ سوال واقعی خریدار (سازگاری، نحوه‌ی استفاده، نگه‌داری، مناسب چه کسی است) با پاسخ ۱ تا ۳ جمله‌ای. فقط سوالی بپرس که پاسخش را مطمئنی؛ «ندارد» را بدون اطمینان نگو.");
  if (want.has("seo")) {
    lines.push(
      "",
      "seoTitle: حداکثر ۶۰ کاراکتر، کلمه‌ی کلیدی اصلی اول.",
      "seoDescription: بین ۱۲۰ تا ۱۵۵ کاراکتر، جذاب و با کلمه‌ی کلیدی اصلی.",
      "seoKeywords: ۴ تا ۷ عبارت جست‌وجوی واقعی کاربران ایرانی.",
    );
  }
  lines.push(
    "",
    "warnings: فهرست کوتاه چیزهایی که فروشنده باید قبل از انتشار چک کند (مثلاً «کد مدل از روی عکس خوانا نبود»). اگر چیزی نیست، آرایه‌ی خالی.",
    "",
    "فقط یک شیء JSON برگردان، بدون توضیح دیگر، با این کلیدها (بخش‌هایی که خواسته نشده را خالی بگذار):",
    `{"titles":[],"brandGuess":null,"shortDescription":"","expertTitle":"","expertDescription":"","benefits":[],"features":[],"specs":[{"id":"","value":"","fromInput":false}],"faq":[{"q":"","a":""}],"seoTitle":"","seoDescription":"","seoKeywords":[],"warnings":[]}`,
  );
  return lines.join("\n");
}

function buildUserText(input: ProductTextInput, ctx: Awaited<ReturnType<typeof loadContext>>, want: Set<AiTextSection>) {
  const parts: string[] = [];
  if (ctx.categoryPath) parts.push(`دسته‌ی فروشگاه: ${ctx.categoryPath}`);
  parts.push(ctx.brand ? `برند: ${ctx.brand}` : "برند: در فرم انتخاب نشده (اگر در یادداشت یا عکس آمده از همان استفاده کن)");
  if (input.title?.trim()) parts.push(`عنوان فعلی (ممکن است استاندارد نباشد): ${input.title.trim()}`);
  if (input.variantInfo?.trim()) parts.push(`تنوع‌های موجود: ${input.variantInfo.trim()}`);
  if (input.notes?.trim()) parts.push(`مشخصات و توضیحات فروشنده:\n${input.notes.trim()}`);
  if (want.has("specs") && input.specItems?.length) {
    parts.push(
      "ردیف‌های مشخصات فنی (شناسه | عنوان | مقدار فعلی):",
      ...input.specItems.map(it => `${it.id} | ${it.title} | ${it.value?.trim() || "—"}`),
    );
  }
  if (input.image) parts.push("عکس محصول پیوست است؛ نوشته‌ها، لوگو و جزئیات ظاهری را از آن بخوان.");
  return parts.join("\n");
}

// ─── تمیزکاری خروجی ────────────────────────────────────────────────────────

const clean = (v: unknown, max = 4000): string =>
  typeof v !== "string" ? "" : v
    .replace(/\*\*|__|^#+\s*/gm, "")
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim().slice(0, max);

const list = (v: unknown, max: number, len = 200): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map(x => clean(x, len).replace(/^[-•\d.)\s]+/, "")).filter(Boolean))].slice(0, max)
    : [];

/** متن خام مدل → شیء JSON؛ کدبلاک و متن اضافه‌ی اطراف را تحمل می‌کند */
export function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const t = raw.replace(/```(?:json)?/g, "").trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}

export function normalizeResult(raw: Record<string, unknown>, input: ProductTextInput): AiTextResult {
  const benefits = list(raw.benefits, 8, 200);
  let expert = clean(raw.expertDescription, 6000);
  // تصمیم کاربر: مزایا بخشی با تیتر در انتهای «بررسی تخصصی» — فیلد جدا ندارد
  if (expert && benefits.length) expert += `\n\nمزایا:\n${benefits.map(b => `• ${b}`).join("\n")}`;

  const items = new Map((input.specItems ?? []).map(it => [it.id, it.title]));
  const specs: AiTextResult["specs"] = [];
  if (Array.isArray(raw.specs)) {
    for (const r of raw.specs as Record<string, unknown>[]) {
      const id = typeof r?.id === "string" ? r.id.trim() : "";
      const value = clean(r?.value, 200);
      if (!items.has(id) || !value || specs.some(x => x.specItemId === id)) continue;
      specs.push({ specItemId: id, title: items.get(id)!, value, fromInput: r.fromInput === true });
    }
  }

  const faq = Array.isArray(raw.faq)
    ? (raw.faq as Record<string, unknown>[])
        .map(f => ({ q: clean(f?.q ?? f?.question, 300), a: clean(f?.a ?? f?.answer, 1000) }))
        .filter(f => f.q && f.a).slice(0, 8)
    : [];

  const kw = Array.isArray(raw.seoKeywords) ? list(raw.seoKeywords, 8, 60) : clean(raw.seoKeywords, 400).split(/[,،]/).map(x => x.trim()).filter(Boolean);

  return {
    titles: list(raw.titles, 3, 120),
    brandGuess: clean(raw.brandGuess, 60) || null,
    shortDescription: clean(raw.shortDescription, 400),
    expertTitle: clean(raw.expertTitle, 150),
    expertDescription: expert,
    features: list(raw.features, 10, 120),
    specs,
    faq,
    seoTitle: clean(raw.seoTitle, 90),
    seoDescription: clean(raw.seoDescription, 250),
    seoKeywords: kw.join("، "),
    warnings: list(raw.warnings, 8, 300),
  };
}

// ─── عکس ───────────────────────────────────────────────────────────────────

/**
 * نشانی عکس محصول → data URL. عکس‌های خود سایت (`/uploads/...`) از دیسک خوانده
 * می‌شوند تا به CDN و دامنه وابسته نباشیم؛ نشانی کامل دانلود می‌شود.
 */
export async function imageToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;
  try {
    if (url.startsWith("/uploads/")) {
      const root = path.join(process.cwd(), "public", "uploads");
      const file = path.join(root, path.basename(url.split("?")[0]));
      if (!file.startsWith(root)) return null;
      const buf = await readFile(file);
      if (buf.length > MAX_IMAGE_BYTES) return null;
      const ext = path.extname(file).slice(1).toLowerCase().replace("jpg", "jpeg");
      return `data:image/${ext || "jpeg"};base64,${buf.toString("base64")}`;
    }
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !type.startsWith("image/")) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_IMAGE_BYTES) return null;
      return `data:${type};base64,${buf.toString("base64")}`;
    }
  } catch {}
  return null;
}

// ─── فراخوانی مدل ──────────────────────────────────────────────────────────

export async function generateProductText(
  s: AiSettings, input: ProductTextInput,
): Promise<{ result: AiTextResult; usage: AiTextUsage }> {
  const want = new Set(input.sections);
  const ctx = await loadContext(s, input);
  const client = new OpenAI({ apiKey: s.apiKey, baseURL: GAPGPT_BASE_URL, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });

  const userText = buildUserText(input, ctx, want);
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: userText }];
  if (input.image) content.push({ type: "image_url", image_url: { url: input.image, detail: "high" } });

  let res: OpenAI.Chat.Completions.ChatCompletion;
  try {
    res = await client.chat.completions.create({
      model: s.textModel,
      temperature: 0.5,
      max_tokens: 4000,
      // Claude در مسیر سازگار OpenAI این گزینه را نمی‌شناسد؛ پارس شل کافی است
      ...(s.textModel.startsWith("claude") ? {} : { response_format: { type: "json_object" as const } }),
      messages: [
        { role: "system", content: buildSystemPrompt(s, ctx, want) },
        { role: "user", content },
      ],
    });
  } catch (e) {
    throw new Error(explainError(e));
  }

  const raw = parseJsonLoose(res.choices[0]?.message?.content ?? "");
  if (!raw) throw new Error("پاسخ هوش مصنوعی قابل خواندن نبود. دوباره امتحان کنید.");

  const inT = res.usage?.prompt_tokens ?? 0;
  const outT = res.usage?.completion_tokens ?? 0;
  return {
    result: normalizeResult(raw, input),
    usage: { model: s.textModel, inputTokens: inT, outputTokens: outT, costUsd: estimateCost(s.textModel, inT, outT) },
  };
}

function explainError(e: unknown): string {
  const err = e as { status?: number; message?: string; name?: string };
  const msg = err?.message ?? "";
  if (err?.name === "APIConnectionTimeoutError" || /timed? ?out/i.test(msg))
    return "نوشتن متن بیش از حد طول کشید. دوباره امتحان کنید یا مدل سریع‌تری انتخاب کنید.";
  if (err?.status === 401) return "کلید GapGPT نامعتبر است. در «تنظیمات هوش مصنوعی» کلید را بررسی کنید.";
  if (err?.status === 402 || /quota|balance|credit|insufficient/i.test(msg)) return "اعتبار حساب GapGPT کافی نیست. حساب را شارژ کنید.";
  if (err?.status === 429) return "تعداد درخواست‌ها زیاد است. یک دقیقه بعد دوباره امتحان کنید.";
  if (err?.status === 404 || /model/i.test(msg) && /not|exist|support/i.test(msg))
    return "مدل متنی انتخاب‌شده در GapGPT در دسترس نیست. در تنظیمات مدل دیگری انتخاب کنید.";
  return `خطای سرویس هوش مصنوعی${err?.status ? ` (کد ${err.status})` : ""}: ${msg.slice(0, 200)}`;
}
