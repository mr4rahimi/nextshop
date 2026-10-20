/**
 * ابزارهای چت فروشگاه — docs/plans/storefront-chat.md بخش ۳
 *
 * همه فقط‌خواندنی و عمومی‌اند: همان چیزی که بازدیدکننده‌ی ناشناس در سایت می‌بیند.
 * ابزار سفارش، سبد و درخواست تماس (فاز ۲) شناسه‌ی کاربر را از سشن می‌گیرند، نه از مدل.
 *
 * قالب ابزارها عمداً «فروشگاه‌محور» نیست تا چت سراسری گردانوس (بخش ۷) همین‌ها را با یک
 * پارامتر «فروشگاه» دوباره به کار ببرد.
 */
import type { ToolSpec } from "@/lib/assistant/ai-stream";
import { categoryTree, compareProducts, productDetail, searchProducts, type SearchInput } from "./search";
import { readPage, storeInfo } from "./store-info";
import { activeCoupons, addToCart, checkWarranty, myOrders, requestCallback, type ToolContext } from "./account";

export type ShopTool = {
  name: string;
  /** متنی که هنگام اجرا به مشتری نشان داده می‌شود */
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);

export const SHOP_TOOLS: ShopTool[] = [
  {
    name: "search_products",
    label: "در حال جستجوی محصولات…",
    description:
      "جستجوی محصولات فروشگاه. برای هر سؤال درباره‌ی کالا، قیمت، موجودی یا پیشنهاد خرید اول این را صدا بزن. " +
      "query فقط نام کالا، برند و مدل باشد (مثل «پرینتر لیزری hp m236d» یا «کارتریج 136a»)، نه کل جمله‌ی مشتری. " +
      "اگر نتیجه approximate بود یعنی دقیقاً همان پیدا نشد و این‌ها نزدیک‌ترین‌اند. اگر هیچ نتیجه‌ای نیامد با واژه‌ی کلی‌تر یا بدون دسته دوباره بگرد.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "نام کالا، برند، مدل یا ویژگی کلیدی" },
        category: { type: "string", description: "نامک یا نام دسته (اختیاری) — زیردسته‌ها هم جستجو می‌شوند" },
        brand: { type: "string", description: "برند (اختیاری)" },
        min_price: { type: "number", description: "کمترین قیمت به تومان" },
        max_price: { type: "number", description: "بیشترین قیمت به تومان (بودجه‌ی مشتری)" },
        in_stock_only: { type: "boolean", description: "فقط کالاهای موجود — فقط وقتی مشتری خودش گفت؛ وگرنه کالای ناموجود هم بیاید تا بگویی «الان نداریم» و جایگزین بدهی" },
        sort: { type: "string", enum: ["relevance", "price_asc", "price_desc", "newest"], description: "ارزان‌ترین = price_asc" },
      },
    },
    run: (a) =>
      searchProducts({
        query: str(a.query),
        category: str(a.category) || undefined,
        brand: str(a.brand) || undefined,
        minPrice: num(a.min_price),
        maxPrice: num(a.max_price),
        inStockOnly: a.in_stock_only === true,
        sort: (["relevance", "price_asc", "price_desc", "newest"] as const).find((s) => s === a.sort) as SearchInput["sort"],
      }),
  },
  {
    name: "get_product",
    label: "در حال خواندن مشخصات محصول…",
    description:
      "جزئیات کامل یک محصول با نامک: مشخصات فنی، ویژگی‌ها، تنوع‌ها (رنگ/سایز) با قیمت و موجودی هر کدام، گارانتی، " +
      "سؤال‌های متداول همان محصول و محصولات مرتبط/مکمل (کارتریج، لوازم جانبی). برای سؤال فنی، سازگاری یا گارانتی یک کالا.",
    parameters: {
      type: "object",
      properties: { slug: { type: "string", description: "نامک محصول از نتیجه‌ی جستجو یا صفحه‌ی فعلی" } },
      required: ["slug"],
    },
    run: (a) => productDetail(str(a.slug)),
  },
  {
    name: "compare_products",
    label: "در حال مقایسه…",
    description: "مقایسه‌ی ۲ تا ۴ محصول: قیمت، موجودی، گارانتی و جدول مشخصات مشترک.",
    parameters: {
      type: "object",
      properties: { slugs: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
      required: ["slugs"],
    },
    run: (a) => compareProducts(Array.isArray(a.slugs) ? a.slugs.map(str).filter(Boolean) : []),
  },
  {
    name: "list_categories",
    label: "در حال خواندن دسته‌ها…",
    description: "درخت دسته‌های فروشگاه با تعداد محصول. برای «چه چیزهایی دارید؟» یا پیدا کردن دسته‌ی درست پیش از جستجو.",
    parameters: { type: "object", properties: {} },
    run: () => categoryTree(),
  },
  {
    name: "store_info",
    label: "در حال خواندن اطلاعات فروشگاه…",
    description:
      "اطلاعات فروشگاه: تلفن، آدرس، ساعت کاری، شبکه‌های اجتماعی، نماد اعتماد و ساماندهی، روش‌ها و هزینه‌ی ارسال، " +
      "توضیح گارانتی و فهرست برگه‌ها (قوانین، مرجوعی، درباره ما). برای هر سؤال درباره‌ی خود فروشگاه، ارسال، پرداخت یا اعتماد.",
    parameters: { type: "object", properties: {} },
    run: () => storeInfo(),
  },
  {
    name: "read_page",
    label: "در حال خواندن قوانین فروشگاه…",
    description: "متن کامل یک برگه‌ی سایت (مثلاً شرایط مرجوعی، قوانین، حریم خصوصی، سؤالات متداول) با نامک یا عنوانش از store_info.",
    parameters: {
      type: "object",
      properties: { page: { type: "string", description: "نامک یا عنوان برگه" } },
      required: ["page"],
    },
    run: (a) => readPage(str(a.page)),
  },
  {
    name: "active_coupons",
    label: "در حال بررسی تخفیف‌ها…",
    description: "کدهای تخفیف عمومی فعال فروشگاه. وقتی مشتری دنبال تخفیف است یا برای خریدش تصمیم نگرفته. اگر خالی بود تخفیف نساز.",
    parameters: { type: "object", properties: {} },
    run: () => activeCoupons(),
  },
  {
    name: "my_orders",
    label: "در حال بررسی سفارش‌ها…",
    description: "وضعیت سفارش‌های همین مشتری (فقط اگر وارد حسابش شده باشد): وضعیت، تاریخ، مبلغ، کد رهگیری مرسوله، اقلام.",
    parameters: {
      type: "object",
      properties: { order_number: { type: "string", description: "شماره‌ی سفارش اگر مشتری گفته (اختیاری)" } },
    },
    run: (a, ctx) => myOrders(ctx, str(a.order_number) || undefined),
  },
  {
    name: "check_warranty",
    label: "در حال استعلام گارانتی…",
    description:
      "استعلام گارانتی ثبت‌شده‌ی یک دستگاه با شماره‌ی سریال، یا فهرست گارانتی‌های مشتری واردشده. " +
      "برای «گارانتی دستگاهم تا کی است؟». برای «این کالا چقدر گارانتی دارد» get_product کافی است.",
    parameters: {
      type: "object",
      properties: { serial_number: { type: "string", description: "شماره‌ی سریال دقیق که مشتری نوشته" } },
    },
    run: (a, ctx) => checkWarranty(ctx, str(a.serial_number) || undefined),
  },
  {
    name: "request_callback",
    label: "در حال ثبت درخواست تماس…",
    description:
      "ثبت درخواست تماس کارشناس: قیمت استعلامی، خرید عمده یا تخفیف ویژه، مشکل ورود/پرداخت، یا هر چه از تو برنمی‌آید. " +
      "فقط وقتی مشتری موافق است. شماره‌ی موبایل را خود مشتری باید در گفتگو نوشته باشد (یا وارد حسابش شده باشد)؛ شماره نساز.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "موبایل مشتری همان‌طور که نوشته؛ برای مشتری واردشده خالی بگذار" },
        summary: { type: "string", description: "یک جمله: مشتری چه می‌خواهد (برای کارشناس)" },
        product_slug: { type: "string", description: "نامک کالای مورد نظر (اختیاری)" },
      },
      required: ["summary"],
    },
    run: (a, ctx) => requestCallback(ctx, { phone: str(a.phone) || undefined, summary: str(a.summary), productSlug: str(a.product_slug) || undefined }),
  },
  {
    name: "add_to_cart",
    label: "در حال افزودن به سبد…",
    description: "افزودن یک کالا به سبد خرید مشتری. **فقط وقتی مشتری صریحاً خواست** («بذارش تو سبد»، «همینو می‌خوام»).",
    parameters: {
      type: "object",
      properties: {
        slug: { type: "string", description: "نامک کالا از نتیجه‌ی ابزار" },
        qty: { type: "number", description: "تعداد (پیش‌فرض ۱)" },
      },
      required: ["slug"],
    },
    run: (a, ctx) => addToCart(ctx, str(a.slug), typeof a.qty === "number" ? a.qty : 1),
  },
];

export const SHOP_TOOL_SPECS: ToolSpec[] = SHOP_TOOLS.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));
