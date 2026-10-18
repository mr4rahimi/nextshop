import { prisma } from "@/lib/prisma";
import { apiConfigFor, type BaleConfig } from "@/lib/club/channels/bale";
import { callBotApi, type BotUpdate } from "@/lib/club/channels/botapi";
import type { BaleCatalogConfig } from "./config";
import {
  getProductCard,
  listCategories,
  listCategoryProducts,
  searchProducts,
  type ProductCard,
  type ProductRow,
} from "./catalog";

/**
 * گفتگوی کاتالوگ در ربات بله
 *
 * ناوبری با دکمه‌های شیشه‌ای (callback) است و پیام قبلی **ویرایش** می‌شود تا
 * چت پر از فهرست‌های تکراری نشود. کارت محصول پیام تازه است (با عکس)، و چون
 * پیام عکس‌دار با `editMessageText` ویرایش نمی‌شود، برگشت از آن خودکار به
 * ارسال پیام تازه می‌افتد.
 *
 * داده‌ی دکمه‌ها (حداکثر ۶۴ بایت):
 *   `menu` · `noop` · `cats:<page>` · `c:<categoryId>:<page>` · `p:<mappingId>` · `search` · `club`
 * دکمه‌ی `club` را `bale-webhook.ts` جواب می‌دهد چون جریان عضویت آنجاست.
 *
 * ⚠️ هیچ تابعی اینجا throw به بیرون نمی‌دهد؛ وب‌هوک باید همیشه ۲۰۰ بدهد.
 */

type CallbackQuery = NonNullable<BotUpdate["callback_query"]>;
type Markup = { inline_keyboard: Array<Array<Record<string, string>>> };

const PAGE_SIZE = 8;
/** سقف کپشن عکس در بله، مثل تلگرام */
const CAPTION_MAX = 1024;

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

function toman(n: number) {
  return `${fa(n)} تومان`;
}

function btn(text: string, data: string) {
  return { text, callback_data: data };
}

// ─── ارسال ─────────────────────────────────────────────────────────

/** ویرایش پیام قبلی اگر ممکن باشد، وگرنه پیام تازه */
async function show(
  cfg: BaleConfig,
  chatId: number,
  text: string,
  markup: Markup,
  editMessageId?: number,
) {
  const api = apiConfigFor(cfg);
  if (editMessageId) {
    try {
      await callBotApi(api, "editMessageText", {
        chat_id: chatId,
        message_id: editMessageId,
        text,
        reply_markup: markup,
      });
      return;
    } catch (err) {
      // همان متن و همان دکمه‌ها (دوبار زدن یک دکمه) — پیام درست است، تکرار نکن
      if (err instanceof Error && /not modified/i.test(err.message)) return;
      // پیام عکس‌دار یا خیلی قدیمی — پیام تازه می‌فرستیم
    }
  }
  await callBotApi(api, "sendMessage", { chat_id: chatId, text, reply_markup: markup });
}

const homeRow = () => [btn("🏠 منوی اصلی", "menu")];

// ─── منوی اصلی ─────────────────────────────────────────────────────

export async function sendMainMenu(
  cfg: BaleConfig,
  cat: BaleCatalogConfig,
  chatId: number,
  editMessageId?: number,
) {
  let text = cat.welcomeText.trim();
  if (!text) {
    const s = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { storeName: true },
    });
    text = [
      `به ربات ${s?.storeName || "فروشگاه"} خوش آمدید 🌱`,
      "قیمت به‌روز محصولات را در سایت و فروشگاه‌های اینترنتی ببینید و از هرجا که خواستید بخرید.",
    ].join("\n");
  }

  const rows = [[btn("🛍 محصولات", "cats:0")]];
  if (cat.searchEnabled) rows.push([btn("🔍 جستجوی محصول", "search")]);
  if (cat.showClubButton) rows.push([btn("⭐ باشگاه مشتریان", "club")]);

  await show(cfg, chatId, text, { inline_keyboard: rows }, editMessageId);
}

// ─── دسته‌ها و محصولات ─────────────────────────────────────────────

function pageNav(prefix: string, page: number, total: number) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return [];
  const row = [];
  // راست‌به‌چپ: «بعدی» سمت چپ می‌نشیند
  if (page > 0) row.push(btn("→ قبلی", `${prefix}:${page - 1}`));
  row.push(btn(`${fa(page + 1)} از ${fa(pages)}`, "noop"));
  if (page < pages - 1) row.push(btn("بعدی ←", `${prefix}:${page + 1}`));
  return [row];
}

async function showCategories(cfg: BaleConfig, chatId: number, page: number, editId?: number) {
  const cats = await listCategories();

  if (!cats.length) {
    await show(cfg, chatId, "فعلاً محصولی برای نمایش نیست.", { inline_keyboard: [homeRow()] }, editId);
    return;
  }

  const p = Math.min(Math.max(0, page), Math.ceil(cats.length / PAGE_SIZE) - 1);
  const slice = cats.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

  await show(
    cfg,
    chatId,
    "🛍 یک دسته را انتخاب کنید:",
    {
      inline_keyboard: [
        ...slice.map((c) => [btn(`${c.title} (${fa(c.count)})`, `c:${c.id}:0`)]),
        ...pageNav("cats", p, cats.length),
        homeRow(),
      ],
    },
    editId,
  );
}

function productButtons(rows: ProductRow[]) {
  return rows.map((r) => [btn(r.title.slice(0, 60), `p:${r.mappingId}`)]);
}

async function showCategory(
  cfg: BaleConfig,
  chatId: number,
  categoryId: string,
  page: number,
  editId?: number,
) {
  const { title, products } = await listCategoryProducts(categoryId);

  if (!products.length) {
    await show(
      cfg,
      chatId,
      "این دسته فعلاً محصول موجودی ندارد.",
      { inline_keyboard: [[btn("⬅️ دسته‌ها", "cats:0")], homeRow()] },
      editId,
    );
    return;
  }

  const p = Math.min(Math.max(0, page), Math.ceil(products.length / PAGE_SIZE) - 1);
  const slice = products.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

  await show(
    cfg,
    chatId,
    `📂 ${title ?? "محصولات"}\nیک محصول را انتخاب کنید:`,
    {
      inline_keyboard: [
        ...productButtons(slice),
        ...pageNav(`c:${categoryId}`, p, products.length),
        [btn("⬅️ دسته‌ها", "cats:0"), ...homeRow()],
      ],
    },
    editId,
  );
}

// ─── کارت محصول ────────────────────────────────────────────────────

export function formatCard(card: ProductCard): string {
  const lines = [`🛍 ${card.title}`, ""];

  if (!card.entries.length) {
    lines.push("قیمتی برای این محصول ثبت نشده است.");
    return lines.join("\n");
  }

  lines.push("💰 قیمت‌ها:");
  for (const e of card.entries) {
    const mark = e.cheapest ? "✅" : "▫️";
    if (!e.available || e.price == null) {
      lines.push(`${mark} ${e.label}: ناموجود`);
      continue;
    }
    let line = `${mark} ${e.label}: ${e.fromPrice ? "از " : ""}${toman(e.price)}`;
    if (e.originalPrice) line += ` (به‌جای ${fa(e.originalPrice)})`;
    if (e.cheapest) line += " — کمترین قیمت";
    lines.push(line);
  }

  if (card.entries.some((e) => e.available && e.url)) {
    lines.push("", "برای خرید، یکی از دکمه‌های زیر را بزنید.");
  }

  return lines.join("\n");
}

function cardMarkup(card: ProductCard): Markup {
  const rows: Markup["inline_keyboard"] = card.entries
    .filter((e) => e.available && e.url)
    .map((e) => [{ text: `🛒 خرید از ${e.label}`, url: e.url! }]);
  rows.push([btn("⬅️ بازگشت", `c:${card.categoryId}:0`), ...homeRow()]);
  return { inline_keyboard: rows };
}

async function showProduct(
  cfg: BaleConfig,
  cat: BaleCatalogConfig,
  chatId: number,
  mappingId: string,
) {
  const card = await getProductCard(mappingId, cat);
  if (!card) {
    await show(cfg, chatId, "این محصول دیگر در دسترس نیست.", {
      inline_keyboard: [[btn("⬅️ دسته‌ها", "cats:0")], homeRow()],
    });
    return;
  }

  const text = formatCard(card);
  const markup = cardMarkup(card);

  if (cat.showImage && card.imageUrl && text.length <= CAPTION_MAX) {
    try {
      await callBotApi(apiConfigFor(cfg), "sendPhoto", {
        chat_id: chatId,
        photo: card.imageUrl,
        caption: text,
        reply_markup: markup,
      });
      return;
    } catch (err) {
      // عکس در دسترس بله نبود (آدرس داخلی، فرمت، حجم) — بدون عکس می‌فرستیم
      console.warn("[bale:catalog] ارسال عکس ناموفق:", err instanceof Error ? err.message : err);
    }
  }

  await show(cfg, chatId, text, markup);
}

// ─── جستجو ─────────────────────────────────────────────────────────

async function runSearch(cfg: BaleConfig, cat: BaleCatalogConfig, chatId: number, q: string) {
  const rows = await searchProducts(q);

  if (!rows.length) {
    await show(cfg, chatId, `محصولی با «${q.slice(0, 50)}» پیدا نشد.\nکلمه‌ی دیگری بنویسید یا از دسته‌ها ببینید.`, {
      inline_keyboard: [[btn("🛍 دسته‌ها", "cats:0")], homeRow()],
    });
    return;
  }

  if (rows.length === 1) {
    await showProduct(cfg, cat, chatId, rows[0].mappingId);
    return;
  }

  await show(cfg, chatId, `🔍 نتیجه‌ی جستجوی «${q.slice(0, 50)}»:`, {
    inline_keyboard: [...productButtons(rows), homeRow()],
  });
}

// ─── ورودی‌ها ──────────────────────────────────────────────────────

const CMD_PRODUCTS = /^\/products\b|^محصولات$|^🛍/;
const CMD_MENU = /^\/menu\b|^منو$/;

/**
 * پیام متنی — `true` یعنی کاتالوگ جوابش را داد.
 * هر متن دیگری (اگر جستجو روشن باشد) جستجوی نام محصول است.
 */
export async function handleCatalogText(
  cfg: BaleConfig,
  cat: BaleCatalogConfig,
  chatId: number,
  text: string,
): Promise<boolean> {
  try {
    if (CMD_MENU.test(text)) {
      await sendMainMenu(cfg, cat, chatId);
      return true;
    }
    if (CMD_PRODUCTS.test(text)) {
      await showCategories(cfg, chatId, 0);
      return true;
    }
    if (cat.searchEnabled && !text.startsWith("/") && text.length >= 2) {
      await runSearch(cfg, cat, chatId, text);
      return true;
    }
  } catch (err) {
    console.error("[bale:catalog] پیام:", err);
    return true;
  }
  return false;
}

export async function handleCatalogCallback(
  cfg: BaleConfig,
  cat: BaleCatalogConfig,
  cb: CallbackQuery,
): Promise<void> {
  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const editId = cb.message?.message_id;

  try {
    if (data === "menu") return await sendMainMenu(cfg, cat, chatId, editId);

    if (data === "search") {
      await show(cfg, chatId, "🔍 نام محصول یا بخشی از آن را بنویسید:", {
        inline_keyboard: [homeRow()],
      });
      return;
    }

    let m = /^cats:(\d+)$/.exec(data);
    if (m) return await showCategories(cfg, chatId, Number(m[1]), editId);

    m = /^c:([\w-]+):(\d+)$/.exec(data);
    if (m) return await showCategory(cfg, chatId, m[1], Number(m[2]), editId);

    m = /^p:([\w-]+)$/.exec(data);
    if (m) return await showProduct(cfg, cat, chatId, m[1]);
  } catch (err) {
    console.error("[bale:catalog] دکمه:", err);
  }
}

/** بستن چرخش دکمه در بله — بی‌جواب ماندنش دکمه را «در حال بارگذاری» نگه می‌دارد */
export async function answerCallback(cfg: BaleConfig, callbackId: string) {
  await callBotApi(apiConfigFor(cfg), "answerCallbackQuery", {
    callback_query_id: callbackId,
  }).catch(() => {});
}
