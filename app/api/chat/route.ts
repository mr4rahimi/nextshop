import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation, saveMessage } from "@/lib/chat-history";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.GAPGPT_API_KEY!,
  baseURL: "https://api.gapgpt.app/v1",
});

const MODEL = "gapgpt-qwen-3.6";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

// زمینه‌ی فعال که از دکمه‌های flow می‌آید
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

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  salePrice?: number | null;
  stock: number;
  trackStock: boolean;
  brand?: { title: string; slug: string } | null;
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
}

// ─── Cache دسته‌بندی‌ها (10 دقیقه) ───────────────────────────────────────────

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

// ─── Cache اطلاعات کسب‌وکار (5 دقیقه) ─────────────────────────────────────────

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

// متن زمینه را برای یک موضوع مشخص می‌سازد
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

// ─── Step 1: Intent Detection (بدون DB) ──────────────────────────────────────

async function detectIntent(
  messages: Message[],
  categoriesText: string
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
      model: MODEL,
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

// ─── Fetch محصولات هدفمند ─────────────────────────────────────────────────────

async function fetchProducts(opts: {
  category_slug?: string | null;
  search_query?: string | null;
}): Promise<Product[]> {
  const params = new URLSearchParams({ pageSize: "8", sort: "popular" });
  if (opts.category_slug) params.set("category", opts.category_slug);
  if (opts.search_query) params.set("q", opts.search_query);

  try {
    const res = await fetch(`${BASE_URL}/api/products?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as Product[];
  } catch {
    return [];
  }
}

function buildProductsContext(products: Product[]): string {
  if (!products.length) return "محصولی یافت نشد.";

  return products
    .map((p) => {
      const price = p.salePrice ?? p.price;
      const priceText = Number(price).toLocaleString("fa-IR");
      const hasDiscount = p.salePrice && p.salePrice < p.price;
      const stockText =
        !p.trackStock ? "موجود" :
        p.stock > 5   ? "موجود" :
        p.stock > 0   ? `فقط ${p.stock} عدد` : "ناموجود";

      const parts = [
        `📦 ${p.title}`,
        `قیمت: ${priceText} تومان${hasDiscount ? " (تخفیف‌دار)" : ""}`,
        `وضعیت: ${stockText}`,
      ];
      if (p.brand) parts.push(`برند: ${p.brand.title}`);
      parts.push(`لینک: /products/${p.slug}`);
      return parts.join(" | ");
    })
    .join("\n");
}

// ─── ساخت stream عمومی از یک system prompt ───────────────────────────────────

function streamFromSystemPrompt(
  systemPrompt: string,
  messages: Message[],
  onComplete?: (fullText: string) => void
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        const stream = await client.chat.completions.create({
          model: MODEL,
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

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // محدودیت تاریخچه از تنظیمات
  const settingsForLimit = await getBusinessInfo();
  const historyLimit = Number(
    (settingsForLimit as { historyLimit?: number }).historyLimit ?? 4
  );
  if (historyLimit > 0 && messages.length > historyLimit) {
    messages = messages.slice(-historyLimit);
  }

  // شناسایی کاربر و آماده‌سازی مکالمه
  const user = await getAuthUser();
  const conversationId = await getOrCreateConversation({
    conversationId: incomingConvId,
    userId: user?.id ?? null,
    sessionId,
  });

  // برچسب context برای ذخیره‌سازی
  const ctxLabel =
    context?.kind === "topic" ? `topic:${context.topic}` :
    context?.kind === "category" ? `category:${context.slug}` :
    context?.kind === "free" ? "free" : "menu";

  // ذخیره‌ی آخرین پیام کاربر
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    await saveMessage({
      conversationId,
      role: "user",
      content: lastUser.content,
      context: ctxLabel,
    });
  }

  // تابع کمکی: ساخت پاسخ نهایی همراه با هدر conversationId و ذخیره‌ی جواب
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
  // مسیر A: زمینه‌ی موضوع مشخص (از دکمه‌ی connect_context) → بدون Intent
  // ════════════════════════════════════════════════════════════════════════
  if (context?.kind === "topic") {
    const business = await getBusinessInfo();
    const topicContext = buildTopicContext(context.topic, business);

    const systemPrompt = `تو دستیار پشتیبانی این فروشگاه آنلاین هستی.
فقط و فقط بر اساس اطلاعات زیر به سوال کاربر پاسخ بده.
اگه پاسخ سوال در این اطلاعات نبود، صادقانه بگو این اطلاعات را نداری و پیشنهاد بده با پشتیبانی تماس بگیرد.
کوتاه، دقیق و دوستانه پاسخ بده.

${topicContext}${buildFaqText(business)}`;

    const stream = streamFromSystemPrompt(systemPrompt, messages, saveAssistant);
    return respond(stream);
  }

  // ════════════════════════════════════════════════════════════════════════
  // مسیر B: زمینه‌ی دسته‌بندی (از دکمه‌ی categories) → بدون Intent
  // ════════════════════════════════════════════════════════════════════════
  if (context?.kind === "category") {
    const products = await fetchProducts({ category_slug: context.slug });
    const productsContext = buildProductsContext(products);

    const systemPrompt = `تو دستیار خرید هوشمند این فروشگاه آنلاین هستی.
کاربر در حال بررسی محصولات یک دسته‌بندی مشخص است.
فقط از محصولات زیر برای مشاوره استفاده کن.

قوانین:
- قیمت‌ها را دقیق بگو
- اگه محصول مناسب نبود صادقانه بگو
- برای سوالات پرداخت/ارسال/گارانتی بگو با پشتیبانی تماس بگیرند
- کوتاه، واضح و دوستانه باشی

محصولات این دسته‌بندی:
${productsContext}`;

    const stream = streamFromSystemPrompt(systemPrompt, messages, saveAssistant);
    return respond(stream);
  }

  // ════════════════════════════════════════════════════════════════════════
  // مسیر C: سوال آزاد (free یا بدون context) → منطق Intent Detection (مثل قبل)
  // ════════════════════════════════════════════════════════════════════════
  const categories = await getCategories();
  const categoriesText = buildCategoriesText(categories);

  const intent = await detectIntent(messages, categoriesText);

  // اگه نیاز به سوال بیشتر داره → مستقیم برگردون (بدون DB call)
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

  // Fetch محصولات (فقط اگه search باشه)
  let productsContext = "";
  if (intent.intent === "search" && (intent.category_slug || intent.search_query)) {
    const products = await fetchProducts({
      category_slug: intent.category_slug,
      search_query: intent.search_query,
    });
    productsContext = buildProductsContext(products);
  }

  const productSection =
    intent.intent === "search"
      ? productsContext !== "محصولی یافت نشد."
        ? `\nمحصولات مرتبط:\n${productsContext}`
        : "\nمحصولی در این دسته‌بندی یافت نشد."
      : "";

  const systemPrompt = `تو دستیار خرید هوشمند این فروشگاه آنلاین هستی.
وظیفه‌ات مشاوره خرید دقیق و مفید به مشتریان است.

قوانین:
- فقط از اطلاعات محصولات زیر استفاده کن
- قیمت‌ها را دقیق بگو
- اگه محصول ناموجود بود صادقانه بگو و محصول مشابه پیشنهاد بده
- برای سوالات پرداخت/ارسال/گارانتی بگو با پشتیبانی تماس بگیرند
- کوتاه، واضح و دوستانه باشی

دسته‌بندی‌های فروشگاه:
${categoriesText}
${productSection}`;

  const stream = streamFromSystemPrompt(systemPrompt, messages, saveAssistant);
    return respond(stream);
}