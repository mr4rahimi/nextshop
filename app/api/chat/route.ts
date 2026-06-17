import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.GAPGPT_API_KEY!,
  baseURL: "https://api.gapgpt.app/v1",
});

const MODEL = "gapgpt-qwen-3.6";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

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

// ─── Step 1: Intent Detection (بدون DB) ──────────────────────────────────────

async function detectIntent(
  messages: Message[],
  categoriesText: string
): Promise<Intent> {
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  // قسمت systemPrompt توی detectIntent رو با این جایگزین کن:

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

async function fetchProducts(intent: Intent): Promise<Product[]> {
  const params = new URLSearchParams({ pageSize: "8", sort: "popular" });
  if (intent.category_slug) params.set("category", intent.category_slug);
  if (intent.search_query) params.set("q", intent.search_query);

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

// ─── Step 2: Final Answer (streaming) ────────────────────────────────────────

async function streamFinalAnswer(
  messages: Message[],
  productsContext: string,
  intent: Intent,
  categoriesText: string
): Promise<ReadableStream> {
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

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
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
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("Stream error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "خطا در پردازش پیام" })}\n\n`
          )
        );
        controller.close();
      }
    },
  });
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages }: { messages: Message[] } = await req.json();

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const categories = await getCategories();
  const categoriesText = buildCategoriesText(categories);

  // ─── Step 1: Intent
  const intent = await detectIntent(messages, categoriesText);

  // اگه نیاز به سوال بیشتر داره → مستقیم برگردون (بدون DB call)
  if (intent.needs_clarification && intent.clarification_question) {
    const text = intent.clarification_question;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ─── Step 2: Fetch محصولات (فقط اگه search باشه)
  let productsContext = "";
  if (
    intent.intent === "search" &&
    (intent.category_slug || intent.search_query)
  ) {
    const products = await fetchProducts(intent);
    productsContext = buildProductsContext(products);
  }

  // ─── Step 3: جواب نهایی
  const stream = await streamFinalAnswer(
    messages,
    productsContext,
    intent,
    categoriesText
  );

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}