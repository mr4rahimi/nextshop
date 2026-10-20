/**
 * یک نوبت چت فروشگاه — docs/plans/storefront-chat.md بخش ۳
 *
 * حلقه‌ی «مدل ↔ ابزار» (حداکثر MAX_ROUNDS، دور آخر بی‌ابزار) روی همان پروتکل دستیار پنل
 * (`lib/assistant/ai-stream.ts`) و همان مدل تنظیمات دستیار.
 *
 * ⚠️ پاسخ نهایی پیش از ذخیره «پاک» می‌شود: هر لینکی که در خروجی ابزارها نبود (لینک
 *    ساختگی سایت دیگر، نامک حدسی) به متن ساده تبدیل می‌شود. کارت‌های محصول هم فقط از
 *    نامک‌هایی ساخته می‌شوند که ابزار برگردانده — پس قیمت روی کارت همیشه واقعی است.
 */
import { getAiSettings, GAPGPT_BASE_URL } from "@/lib/ai/settings";
import { getAssistantSetting } from "@/lib/assistant/store";
import { AiRequestError, isDroppedConnection, streamChatCompletion, type ChatMessage } from "@/lib/assistant/ai-stream";
import { prisma } from "@/lib/prisma";
import { allCategories, widgetCards, type WidgetCard } from "./search";
import type { ShopAction, ShopUser, ToolContext } from "./account";
import { loadStoreBasics } from "./store-info";
import { compact } from "./text";
import { buildShopPrompt, type PromptInput } from "./prompt";
import { SHOP_TOOLS, SHOP_TOOL_SPECS } from "./tools";

const MAX_ROUNDS = 4;
const MAX_TOKENS = 1500;
const TIMEOUT_MS = 90_000;
const TOOL_RESULT_MAX_CHARS = 10_000;
const MAX_CARDS = 4;

export type ShopChatEvent =
  | { type: "status"; label: string }
  | { type: "delta"; text: string }
  | { type: "final"; text: string; products: WidgetCard[] }
  | { type: "action"; action: ShopAction }
  | { type: "error"; message: string };

export type ShopChatInput = {
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  pagePath: string | null;
  /** دکمه‌ی هدایت‌گر قدیمی (دسته یا موضوع) — فقط راهنمای مدل است، نه فیلتر */
  hint: string | null;
  /** مشتری واردشده (از سشن) — ابزارهای سفارش، گارانتی و تماس به آن تکیه دارند */
  user: ShopUser | null;
  conversationId: string;
  siteId: string | null;
  cartAvailable: boolean;
  /** برای آزمون و ثبت (فاز ۳): هر فراخوانی ابزار با ورودی و خروجی */
  trace?: (call: { name: string; args: string; output: string }) => void;
};

const jsonSafe = (_k: string, v: unknown) => (typeof v === "bigint" ? Number(v) : v);

async function resolvePage(pagePath: string | null): Promise<PromptInput["page"]> {
  if (!pagePath) return null;
  const path = decodeURIComponent(pagePath.split(/[?#]/)[0]);
  const product = path.match(/^\/products\/([^/]+)\/?$/);
  if (product) {
    const p = await prisma.product.findFirst({ where: { slug: product[1], isActive: true }, select: { title: true, slug: true } });
    return p ? { kind: "product", ...p } : null;
  }
  const category = path.match(/^\/categories\/([^/]+)\/?$/);
  if (category) {
    const c = (await allCategories()).find((x) => x.slug === category[1]);
    return c ? { kind: "category", title: c.title, slug: c.slug } : null;
  }
  return /^\/cart\/?$/.test(path) ? { kind: "cart" } : null;
}

/**
 * لینک‌ها و نشانی‌هایی که در خروجی ابزارها نبوده‌اند حذف می‌شوند (متن لینک می‌ماند).
 * `/products/x` فقط وقتی می‌ماند که ابزار همان نامک را داده باشد.
 */
/** صفحه‌های ثابت سایت که پرامپت خودش به آن‌ها لینک می‌دهد */
const SAFE_PATHS = new Set(["/cart", "/auth", "/warranty", "/user/orders"]);

export function sanitizeAnswer(answer: string, toolText: string): string {
  const allowed = (href: string) => {
    let h = href.trim();
    try {
      h = decodeURIComponent(h);
    } catch {
      /* نشانی نیمه‌کدشده — همان‌طور مقایسه شود */
    }
    if (SAFE_PATHS.has(h.replace(/\/$/, "").split(/[?#]/)[0])) return true;
    if (h.startsWith("/")) return toolText.includes(`"${h}"`) || toolText.includes(`"${h.replace(/\/$/, "")}"`);
    return toolText.includes(h);
  };
  // مدل گاهی «]( /products/x)» با فاصله می‌نویسد — هم لینک سالم شود هم ویجت آن را داخلی بشناسد
  let out = answer.replace(/\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g, (_m, label: string, href: string) =>
    allowed(href) ? `[${label}](${href})` : label,
  );
  // نشانی خام (بیرون از لینک markdown)
  out = out.replace(/(^|[^(\w])(https?:\/\/[^\s)]+)/g, (m, pre: string, url: string) => (allowed(url) ? m : pre));
  out = out.replace(/(^|[\s(])(www\.[^\s)]+)/g, (m, pre: string, url: string) => (allowed(url) ? m : pre));
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

/** محصولاتی که ابزارها برگردانده‌اند (هر شیئی با slug، title و url محصول) */
function toolProducts(outputs: string[]): { slug: string; title: string }[] {
  const found = new Map<string, string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.slug === "string" && typeof o.title === "string" && o.url === `/products/${o.slug}`) found.set(o.slug, o.title);
    Object.values(o).forEach(walk);
  };
  for (const text of outputs) {
    try {
      walk(JSON.parse(text));
    } catch {
      /* خروجی کوتاه‌شده JSON کامل نیست */
    }
  }
  return [...found].map(([slug, title]) => ({ slug, title }));
}

/**
 * محصولات کارت: اول آن‌هایی که پاسخ لینک داده (به ترتیب ذکر)، وگرنه آن‌هایی که نام
 * کاملشان در متن پاسخ آمده — فقط از میان خروجی ابزارها.
 */
function answerSlugs(answer: string, known: { slug: string; title: string }[]): string[] {
  const knownSlugs = new Set(known.map((k) => k.slug));
  const out: string[] = [];
  for (const m of answer.matchAll(/\]\(\/products\/([^)\s/?#]+)/g)) {
    let slug = m[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* همان */
    }
    if (knownSlugs.has(slug) && !out.includes(slug)) out.push(slug);
  }
  if (out.length) return out;
  const text = compact(answer);
  return known.filter((k) => compact(k.title).length >= 6 && text.includes(compact(k.title))).map((k) => k.slug);
}

export async function runShopChatTurn(input: ShopChatInput, emit: (e: ShopChatEvent) => void): Promise<string | null> {
  const [ai, setting, basics, cats, page] = await Promise.all([
    getAiSettings(),
    getAssistantSetting(),
    loadStoreBasics(),
    allCategories(),
    resolvePage(input.pagePath),
  ]);
  if (!ai.apiKey) {
    emit({ type: "error", message: "دستیار خرید هنوز راه‌اندازی نشده است" });
    return null;
  }

  const { s, chat } = basics;
  const system = buildShopPrompt({
    storeName: s?.storeName?.trim() || null,
    about: chat.aboutBusiness?.trim() || s?.siteDescription?.trim() || null,
    faq: Array.isArray(chat.faq) ? chat.faq : [],
    categories: cats.filter((c) => !c.parentId).slice(0, 40).map((c) => ({ title: c.title, slug: c.slug })),
    page,
    hint: input.hint,
    phone: s?.sitePhone?.trim() || chat.phone?.trim() || null,
    customerName: input.user?.firstName?.trim() || null,
    loggedIn: !!input.user,
    phoneTail: input.user?.phone ? input.user.phone.replace(/\D/g, "").slice(-4) : null,
  });

  const ctx: ToolContext = {
    user: input.user,
    conversationId: input.conversationId,
    siteId: input.siteId,
    userTexts: [...input.history.filter((m) => m.role === "user").map((m) => m.content), input.message],
    actions: [],
    cartAvailable: input.cartAvailable,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.message },
  ];

  const toolByName = new Map(SHOP_TOOLS.map((t) => [t.name, t]));
  const toolOutputs: string[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let answer = "";

  try {
    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const lastRound = round === MAX_ROUNDS;
      let streamed = false;
      // متن دورهای میانی («بگذارید بگردم…») به کاربر می‌رسد ولی جزو پاسخ نهایی است
      const request = () =>
        streamChatCompletion({
          baseUrl: GAPGPT_BASE_URL,
          apiKey: ai.apiKey,
          model: setting.model,
          messages,
          tools: lastRound ? [] : SHOP_TOOL_SPECS,
          maxTokens: MAX_TOKENS,
          signal: controller.signal,
          onDelta: (text) => {
            streamed = true;
            emit({ type: "delta", text });
          },
        });
      const result = await request().catch((error: unknown) => {
        if (!isDroppedConnection(error) || streamed) throw error;
        return request();
      });
      answer += answer && result.content ? `\n\n${result.content}` : result.content;

      if (result.toolCalls.length === 0 || lastRound) break;

      messages.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });
      for (const label of new Set(result.toolCalls.map((c) => toolByName.get(c.function.name)?.label ?? "در حال بررسی…"))) {
        emit({ type: "status", label });
      }
      const outputs = await Promise.all(
        result.toolCalls.map(async (call) => {
          const tool = toolByName.get(call.function.name);
          if (!tool) return JSON.stringify({ error: "این ابزار وجود ندارد" });
          try {
            const args = call.function.arguments.trim() ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
            const text = JSON.stringify(await tool.run(args, ctx), jsonSafe);
            return text.length > TOOL_RESULT_MAX_CHARS ? `${text.slice(0, TOOL_RESULT_MAX_CHARS)}…` : text;
          } catch (error) {
            console.error(`[shop-chat] خطای ابزار ${call.function.name}`, error);
            return JSON.stringify({ error: "خواندن این داده ناموفق بود" });
          }
        }),
      );
      // دستورهای مرورگر (افزودن به سبد، تماس ثبت شد) همان لحظه می‌روند
      for (const action of ctx.actions.splice(0)) emit({ type: "action", action });
      result.toolCalls.forEach((call, i) => {
        toolOutputs.push(outputs[i]);
        input.trace?.({ name: call.function.name, args: call.function.arguments, output: outputs[i] });
        messages.push({ role: "tool", tool_call_id: call.id, content: outputs[i] });
      });
    }

    const toolText = toolOutputs.join("\n");
    const final = sanitizeAnswer(answer, toolText);
    if (!final) throw new AiRequestError("empty");

    const products = await widgetCards(answerSlugs(final, toolProducts(toolOutputs)).slice(0, MAX_CARDS));
    emit({ type: "final", text: final, products });
    return final;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    if (!aborted && !(error instanceof AiRequestError)) console.error("[shop-chat] خطای نوبت گفتگو", error);
    emit({
      type: "error",
      message: aborted
        ? "پاسخ طول کشید؛ لطفاً دوباره بپرسید."
        : "الان نتوانستم پاسخ بدهم؛ لطفاً دوباره بپرسید یا از «درخواست تماس کارشناس» استفاده کنید.",
    });
    return answer.trim() ? sanitizeAnswer(answer, toolOutputs.join("\n")) : null;
  } finally {
    clearTimeout(timer);
  }
}
