import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation, saveMessage } from "@/lib/chat-history";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gapgpt-qwen-3.6";
const GAPGPT_BASE_URL = "https://api.gapgpt.app/v1";

function createChatClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: GAPGPT_BASE_URL });
}
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

type ChatContext =
  | { kind: "category"; slug: string }
  | { kind: "topic"; topic: string }
  | { kind: "free" }
  | null;

interface Intent {
  intent: "search" | "question" | "greeting" | "other";
  category_slug: string | null;
  needs_clarification: boolean;
  clarification_question: string | null;
  search_query: string | null;
}

interface ProductRich {
  title: string;
  slug: string;
  price: bigint;
  salePrice: bigint | null;
  stock: number;
  trackStock: boolean;
  shortDescription: string | null;
  features: unknown;
  warranty: string | null;
  ratingAvg: number;
  brand: { title: string } | null;
  specs: { value: string; specItem: { title: string; group: { title: string } } }[];
}

interface Category {
  title: string;
  slug: string;
  children?: { title: string; slug: string }[];
}

interface BusinessInfo {
  phone?: string;
  email?: string;
  address?: string;
  workingHours?: string;
  socials?: { instagram?: string; telegram?: string; whatsapp?: string };
  shippingInfo?: string;
  shippingCost?: string;
  warrantyInfo?: string;
  aboutBusiness?: string;
  faq?: { question: string; answer: string }[];
  gapgptApiKey?: string;
}

let categoriesCache: { data: Category[]; ts: number } | null = null;

async function getCategories(): Promise<Category[]> {
  const now = Date.now();
  if (categoriesCache && now - categoriesCache.ts < 10 * 60 * 1000) {
    return categoriesCache.data;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/store/categories-list`);
    if (!res.ok) return [];
    const data: Category[] = await res.json();
    categoriesCache = { data, ts: now };
    return data;
  } catch {
    return categoriesCache?.data ?? [];
  }
}

function buildCategoriesText(cats: Category[]): string {
  return cats
    .map((c) => {
      const children = c.children?.length
        ? ` (زیردسته: ${c.children.map((ch) => `${ch.title}[${ch.slug}]`).join("، ")})`
        : "";
      return `- ${c.title} [${c.slug}]${children}`;
    })
    .join("\n");
}

let businessCache: { data: BusinessInfo; ts: number } | null = null;

async function getBusinessInfo(): Promise<BusinessInfo> {
  const now = Date.now();
  if (businessCache && now - businessCache.ts < 5 * 60 * 1000) {
    return businessCache.data;
  }
  try {
    const settings = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { chatSettings: true },
    });
    const data = (settings?.chatSettings as BusinessInfo) ?? {};
    businessCache = { data, ts: now };
    return data;
  } catch {
    return businessCache?.data ?? {};
  }
}

function buildTopicContext(topic: string, s: BusinessInfo): string {
  switch (topic) {
    case "warranty":
      return `اطلاعات گارانتی فروشگاه:\n${s.warrantyInfo || "اطلاعاتی ثبت نشده است."}`;
    case "shipping":
      return `روش‌های ارسال:\n${s.shippingInfo || "ثبت نشده"}\n\nهزینه‌های ارسال:\n${s.shippingCost || "ثبت نشده"}`;
    case "contact": {
      const lines = ["راه‌های ارتباطی فروشگاه:"];
      if (s.phone) lines.push(`تلفن: ${s.phone}`);
      if (s.email) lines.push(`ایمیل: ${s.email}`);
      if (s.socials?.instagram) lines.push(`اینستاگرام: ${s.socials.instagram}`);
      if (s.socials?.telegram) lines.push(`تلگرام: ${s.socials.telegram}`);
      if (s.socials?.whatsapp) lines.push(`واتساپ: ${s.socials.whatsapp}`);
      return lines.length > 1 ? lines.join("\n") : "اطلاعات تماس ثبت نشده است.";
    }
    case "address": {
      const lines = ["آدرس و ساعات کاری:"];
      if (s.address) lines.push(`آدرس: ${s.address}`);
      if (s.workingHours) lines.push(`ساعات کاری: ${s.workingHours}`);
      return lines.length > 1 ? lines.join("\n") : "آدرس ثبت نشده است.";
    }
    case "about":
      return `درباره فروشگاه:\n${s.aboutBusiness || "اطلاعاتی ثبت نشده است."}`;
    default:
      return "";
  }
}

function buildFaqText(s: BusinessInfo): string {
  if (!s.faq?.length) return "";
  const items = s.faq
    .filter((f) => f.question?.trim() && f.answer?.trim())
    .map((f) => `س: ${f.question}\nج: ${f.answer}`)
    .join("\n\n");
  return items ? `\n\nسوالات متداول:\n${items}` : "";
}

async function detectIntent(
  messages: Message[],
  categoriesText: string,
  client: OpenAI,
  model: string
): Promise<Intent> {
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const systemPrompt = `تو یک سیستم تشخیص هدف برای فروشگاه آنلاین هستی.
پیام کاربر رو تحلیل کن و فقط یک JSON برگردون، بدون هیچ توضیح اضافه.

دسته‌بندی‌های موجود در فروشگاه:
${categoriesText}

قوانین تشخیص intent:
- اگه کاربر فقط نام کالا گفت (مثل "پرینتر میخوام") → needs_clarification=true
  سوال بپرس: کاربرد؟ (اداری/خانگی/عکاسی)، نوع؟ (لیزری/جوهرافشان)، تک‌کاره یا چندکاره؟
- اگه کاربر جزئیات داد (مثل "پرینتر لیزری اداری") → needs_clarification=false، intent=search
- اگه کاربر برند خاص خواست (مثل "HP میخوام") → needs_clarification=false، intent=search
- اگه سوال عمومی درباره فروشگاه/محصول → intent=question
- اگه سلام/احوالپرسی → intent=greeting
- category_slug باید دقیقاً از لیست بالا باشه یا null

مهم: وقتی needs_clarification=true است، فقط یک سوال کوتاه و مشخص بپرس.
فقط JSON خالص برگردون:
{"intent":"search|question|greeting|other","category_slug":"slug|null","needs_clarification":true|false,"clarification_question":"سوال فارسی|null","search_query":"کلمات جستجو|null"}`;

  try {
    const res = await client.chat.completions.create({
      model,
      max_tokens: 256,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: lastUserMsg },
      ],
    });

    const raw = res.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as Intent;
  } catch {
    return {
      intent: "other",
      category_slug: null,
      needs_clarification: false,
      clarification_question: null,
      search_query: null,
    };
  }
}

// ─── کلیدواژه‌های تشخیص مرتب‌سازی از پیام کاربر ─────────────────────────────
function detectSortIntent(query: string): "price_asc" | "price_desc" | "newest" | "popular" {
  if (/ارزان|کمترین قیمت|کم‌قیمت|بودجه|مقرون|اقتصادی|cheap/.test(query)) return "price_asc";
  if (/گران‌ترین|بهترین|باکیفیت‌ترین|پیشرفته‌ترین|برترین|high.end/.test(query))   return "price_desc";
  if (/جدید|تازه|آخرین|نو/.test(query)) return "newest";
  return "popular";
}

// ─── واکشی مستقیم از دیتابیس با اطلاعات کامل ────────────────────────────────
async function fetchProductsRich(opts: {
  categorySlug?: string | null;
  searchQuery?: string | null;
  userQuery?: string;
  limit?: number;
}): Promise<ProductRich[]> {
  const limit = opts.limit ?? 30;

  const where: {
    isActive: boolean;
    category?: { slug: string };
    OR?: { title?: { contains: string; mode: "insensitive" }; shortDescription?: { contains: string; mode: "insensitive" } }[];
  } = { isActive: true };

  if (opts.categorySlug) {
    where.category = { slug: opts.categorySlug };
  }

  if (opts.searchQuery) {
    where.OR = [
      { title: { contains: opts.searchQuery, mode: "insensitive" } },
      { shortDescription: { contains: opts.searchQuery, mode: "insensitive" } },
    ];
  }

  const sortIntent = opts.userQuery ? detectSortIntent(opts.userQuery) : "popular";
  const orderBy =
    sortIntent === "price_asc"  ? [{ price: "asc" as const }] :
    sortIntent === "price_desc" ? [{ price: "desc" as const }] :
    sortIntent === "newest"     ? [{ createdAt: "desc" as const }] :
    [{ ratingCount: "desc" as const }, { ratingAvg: "desc" as const }];

  try {
    return await prisma.product.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        title: true,
        slug: true,
        price: true,
        salePrice: true,
        stock: true,
        trackStock: true,
        shortDescription: true,
        features: true,
        warranty: true,
        ratingAvg: true,
        brand: { select: { title: true } },
        specs: {
          select: {
            value: true,
            specItem: { select: { title: true, group: { select: { title: true } } } },
          },
        },
      },
    });
  } catch {
    return [];
  }
}

// ─── ساخت متن context غنی برای AI ───────────────────────────────────────────
function buildRichContext(products: ProductRich[]): string {
  if (!products.length) return "محصولی یافت نشد.";

  return products
    .map((p, idx) => {
      const finalPrice = p.salePrice ?? p.price;
      const priceText = Number(finalPrice).toLocaleString("fa-IR");
      const hasDiscount = p.salePrice !== null && p.salePrice < p.price;
      const origPriceText = hasDiscount
        ? ` (قیمت اصلی: ${Number(p.price).toLocaleString("fa-IR")})`
        : "";
      const stockText =
        !p.trackStock ? "موجود" :
        p.stock > 5   ? "موجود" :
        p.stock > 0   ? `فقط ${p.stock} عدد` : "ناموجود";

      const lines: string[] = [
        `── محصول ${idx + 1}: ${p.title}`,
        `   قیمت: ${priceText} تومان${origPriceText} | وضعیت: ${stockText}`,
      ];

      if (p.brand)    lines.push(`   برند: ${p.brand.title}`);
      if (p.warranty) lines.push(`   گارانتی: ${p.warranty}`);
      if (p.shortDescription?.trim())
        lines.push(`   توضیح: ${p.shortDescription.trim()}`);

      // features (JSON → string[])
      const feats = Array.isArray(p.features)
        ? (p.features as unknown[])
            .map((f) => (typeof f === "string" ? f : typeof f === "object" && f && "text" in f ? String((f as { text: unknown }).text) : null))
            .filter(Boolean)
        : [];
      if (feats.length)
        lines.push(`   ویژگی‌ها: ${feats.slice(0, 6).join("، ")}`);

      // specs grouped
      if (p.specs.length) {
        lines.push("   مشخصات فنی:");
        p.specs.forEach((s) => {
          lines.push(`     • ${s.specItem.title}: ${s.value}`);
        });
      }

      lines.push(`   لینک: /products/${p.slug}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function streamFromSystemPrompt(
  systemPrompt: string,
  messages: Message[],
  client: OpenAI,
  model: string,
  onComplete?: (fullText: string) => void
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        const stream = await client.chat.completions.create({
          model,
          max_tokens: 512,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            fullText += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        if (onComplete) onComplete(fullText);
      } catch (err) {
        console.error("Stream error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "خطا در پردازش پیام" })}\n\n`)
        );
        controller.close();
      }
    },
  });
}

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  let messages: Message[] = body.messages;
  const context: ChatContext = body.context ?? null;
  const sessionId: string | null = body.sessionId ?? null;
  const incomingConvId: string | null = body.conversationId ?? null;
  const siteId: string | null = body.siteId ?? null;

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const business = await getBusinessInfo();
  const historyLimit = Number(
    (business as { historyLimit?: number }).historyLimit ?? 4
  );
  if (historyLimit > 0 && messages.length > historyLimit) {
    messages = messages.slice(-historyLimit);
  }

  const apiKey = business.gapgptApiKey?.trim() || process.env.GAPGPT_API_KEY || "";
  const model = DEFAULT_MODEL;
  const client = createChatClient(apiKey);

  const user = await getAuthUser();
  const conversationId = await getOrCreateConversation({
    conversationId: incomingConvId,
    userId: user?.id ?? null,
    sessionId,
    siteId,
  });

  const ctxLabel =
    context?.kind === "topic" ? `topic:${context.topic}` :
    context?.kind === "category" ? `category:${context.slug}` :
    context?.kind === "free" ? "free" : "menu";

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    await saveMessage({
      conversationId,
      role: "user",
      content: lastUser.content,
      context: ctxLabel,
    });
  }

  const respond = (stream: ReadableStream) =>
    new NextResponse(stream, {
      headers: { ...sseHeaders, "X-Conversation-Id": conversationId },
    });

  const saveAssistant = (fullText: string) => {
    if (fullText.trim()) {
      saveMessage({
        conversationId,
        role: "assistant",
        content: fullText,
        context: ctxLabel,
      }).catch(() => {});
    }
  };

  const encoder = new TextEncoder();

  // ════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════
  if (context?.kind === "topic") {
    const topicContext = buildTopicContext(context.topic, business);

    const systemPrompt = `تو دستیار پشتیبانی این فروشگاه آنلاین هستی.
فقط و فقط بر اساس اطلاعات زیر به سوال کاربر پاسخ بده.
اگه پاسخ سوال در این اطلاعات نبود، صادقانه بگو این اطلاعات را نداری و پیشنهاد بده با پشتیبانی تماس بگیرد.
کوتاه، دقیق و دوستانه پاسخ بده.

${topicContext}${buildFaqText(business)}`;

    const stream = streamFromSystemPrompt(systemPrompt, messages, client, model, saveAssistant);
    return respond(stream);
  }

  // ════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════
  if (context?.kind === "category") {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const products = await fetchProductsRich({
      categorySlug: context.slug,
      userQuery: lastUserMsg,
      limit: 30,
    });
    const productsContext = buildRichContext(products);

    const systemPrompt = `تو یک متخصص محصولات این فروشگاه هستی و وظیفه‌ات مشاوره خرید دقیق است.

قوانین سخت:
۱. فقط و فقط از اطلاعات ${products.length} محصول زیر استفاده کن — چیزی از خودت اضافه نکن
۲. مقایسه قیمت: دقیقاً از اعداد لیست استفاده کن، ارزان‌ترین را با قیمت دقیق بگو
۳. سوالات spec: مستقیماً از «مشخصات فنی» ذکرشده جواب بده
۴. اگر مشخصه‌ای در لیست نیست، بگو «این اطلاعات در سیستم ثبت نشده»
۵. سوالات پرداخت/ارسال/گارانتی را به پشتیبانی ارجاع بده
۶. پاسخ کوتاه، دقیق، دوستانه و فارسی

محصولات موجود (${products.length} محصول):
${productsContext}`;

    const stream = streamFromSystemPrompt(systemPrompt, messages, client, model, saveAssistant);
    return respond(stream);
  }

  // ════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════
  const categories = await getCategories();
  const categoriesText = buildCategoriesText(categories);

  const intent = await detectIntent(messages, categoriesText, client, model);

  if (intent.needs_clarification && intent.clarification_question) {
    const text = intent.clarification_question;
    saveAssistant(text);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return respond(stream);
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  let productsContext = "";
  let fetchedCount = 0;
  if (intent.intent === "search" && (intent.category_slug || intent.search_query)) {
    const products = await fetchProductsRich({
      categorySlug: intent.category_slug,
      searchQuery: intent.search_query,
      userQuery: lastUserMsg,
      limit: 20,
    });
    fetchedCount = products.length;
    productsContext = buildRichContext(products);
  }

  const productSection =
    intent.intent === "search"
      ? fetchedCount > 0
        ? `\nمحصولات مرتبط (${fetchedCount} محصول):\n${productsContext}`
        : "\nمحصولی یافت نشد."
      : "";

  const systemPrompt = `تو یک متخصص محصولات این فروشگاه هستی و وظیفه‌ات مشاوره خرید دقیق است.

قوانین سخت:
۱. فقط از اطلاعات محصولات لیست‌شده استفاده کن — چیزی از خودت اضافه نکن
۲. مقایسه قیمت: دقیقاً از اعداد لیست استفاده کن
۳. سوالات spec: مستقیماً از «مشخصات فنی» ذکرشده جواب بده
۴. اگر مشخصه‌ای در لیست نیست، بگو «این اطلاعات در سیستم ثبت نشده»
۵. سوالات پرداخت/ارسال/گارانتی را به پشتیبانی ارجاع بده
۶. پاسخ کوتاه، دقیق و دوستانه

دسته‌بندی‌های فروشگاه:
${categoriesText}
${productSection}`;

  const stream = streamFromSystemPrompt(systemPrompt, messages, client, model, saveAssistant);
    return respond(stream);
}
