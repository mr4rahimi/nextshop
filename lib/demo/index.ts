/**
 * نسخه‌ی نمایشی عمومی (demo.gardanos.ir) — docs/plans/demo.md
 *
 * همه‌ی رفتارهای دمو پشت `isDemo()` است و از `DEMO_MODE=1` در `.env` روشن می‌شود.
 * این فایل prisma نمی‌خواند تا proxy هم بتواند از آن استفاده کند.
 *
 * ⚠️ در دمو هر بازدیدکننده مدیر کامل است؛ مرز امنیت فقط همین قاعده‌ها و
 * بررسی بدنه‌اند. مسیر تازه‌ای که به سرویس بیرونی یا کلید واقعی وصل است باید
 * به `RULES` اضافه شود.
 */

export function isDemo(): boolean {
  return process.env.DEMO_MODE === "1";
}

/** شماره‌ی حساب مشترک «مدیر نمایشی» — شماره‌ی واقعی نیست */
export function demoAdminPhone(): string {
  return process.env.DEMO_ADMIN_PHONE?.trim() || "09000000000";
}

export const DEMO_BLOCKED = "این کار در نسخه‌ی نمایشی غیرفعال است.";
export const DEMO_AI_OFF = "هوش مصنوعی در نسخه‌ی نمایشی خاموش است.";

/** بیشترین حجم بدنه‌ی هر درخواست — عکس تا ۱ مگابایت؛ ویدئو و فایل بزرگ رد می‌شود */
export const DEMO_MAX_BODY = 1024 * 1024;

type Rule = {
  prefix: string;
  /** write: فقط POST/PUT/PATCH/DELETE — all: خواندن هم */
  methods: "write" | "all";
  message?: string;
};

const PASSWORD_LOGIN = "در نسخه‌ی نمایشی با شماره موبایل و کد پیامکی وارد شوید.";

const RULES: Rule[] = [
  // ورود فقط با کد پیامکی — هر ورود یک شماره‌ی تأییدشده در DemoLead می‌گذارد
  { prefix: "/api/admin/auth/login", methods: "all", message: PASSWORD_LOGIN },
  { prefix: "/api/seller/auth/login", methods: "all", message: PASSWORD_LOGIN },
  { prefix: "/api/auth/login-password", methods: "all", message: PASSWORD_LOGIN },
  { prefix: "/api/auth/register", methods: "all", message: PASSWORD_LOGIN },
  { prefix: "/api/auth/mvp-login", methods: "all", message: PASSWORD_LOGIN },

  // حساب مشترک نباید برای بقیه قفل شود
  { prefix: "/api/user/change-password", methods: "write", message: "رمز حساب نمایشی عوض نمی‌شود." },
  { prefix: "/api/admin/admins", methods: "write", message: "ساخت مدیر تازه در نسخه‌ی نمایشی بسته است." },
  { prefix: "/api/admin/plan", methods: "write" },

  // پنل پیامک به حساب واقعی ایران‌پیامک وصل است — خواندنش هم موجودی و صندوق ما را نشان می‌دهد
  { prefix: "/api/admin/sms/", methods: "all", message: "پنل پیامک در نسخه‌ی نمایشی بسته است؛ در نسخه‌ی شما به حساب پیامک خودتان وصل می‌شود." },

  // هوش مصنوعی خاموش — کسی هم کلید خودش را نگذارد
  { prefix: "/api/admin/ai-image", methods: "all", message: DEMO_AI_OFF },
  { prefix: "/api/admin/ai-text", methods: "all", message: DEMO_AI_OFF },
  { prefix: "/api/admin/ai-settings", methods: "write", message: DEMO_AI_OFF },
  { prefix: "/api/admin/chat-settings", methods: "write", message: DEMO_AI_OFF },
  { prefix: "/api/admin/assistant", methods: "write", message: DEMO_AI_OFF },

  // اتصال واقعی ممکن نیست — اتصال‌های نمایشی از پیش برقرارند
  { prefix: "/api/integration/connections", methods: "write", message: "اتصال واقعی به بازارگاه در نسخه‌ی نمایشی ممکن نیست؛ اتصال‌های نمایشی از پیش برقرارند." },
  { prefix: "/api/integration/bale-bot", methods: "write" },
];

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

function under(pathname: string, prefix: string): boolean {
  if (prefix.endsWith("/")) return pathname.startsWith(prefix);
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * دلیل بسته بودن یک درخواست، یا null.
 * `userId` شناسه‌ی حساب جاری است: هر نوشتنی روی مسیری که آن را دارد
 * (`/api/admin/users/<خودم>`) بسته است.
 */
export function demoBlockReason(method: string, pathname: string, userId?: string | null): string | null {
  const write = isWriteMethod(method);
  for (const r of RULES) {
    if (!under(pathname, r.prefix)) continue;
    if (r.methods === "all" || write) return r.message ?? DEMO_BLOCKED;
  }
  if (write && userId && pathname.split("/").includes(userId)) {
    return "حساب نمایشی مشترک است و تغییرش در دسترس نیست.";
  }
  return null;
}

// ── بررسی بدنه ───────────────────────────────────────────────────

/**
 * HTML خامی که در سایت اجرا می‌شود. توضیح محصول، صفحه‌ها و نماد اعتماد فوتر
 * بی‌پاک‌سازی رندر می‌شوند؛ در دمو هر بازدیدکننده‌ی بعدی قربانی است.
 */
const UNSAFE_HTML = /<\s*(script|iframe|object|embed|base|meta|form|link)\b|javascript\s*:|<[^>]*\son[a-z]+\s*=/i;

/** فیلدهایی که کلید یا رمز سرویس بیرونی‌اند */
const SECRET_KEY = /(api_?key|secret|token|password|passwd|merchant|credential)/i;

/** مقدار ستاره‌دار همان کلید قبلی است که پنل نقاب‌زده برگردانده */
function looksMasked(v: string): boolean {
  return /[*•…]/.test(v);
}

/** اولین ایراد بدنه‌ی JSON، یا null */
export function demoBodyProblem(body: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, key: string | null, depth: number): string | null => {
    if (depth > 20) return null;
    if (typeof v === "string") {
      if (UNSAFE_HTML.test(v)) return "کد اسکریپت و HTML اجرایی در نسخه‌ی نمایشی پذیرفته نمی‌شود.";
      if (key && SECRET_KEY.test(key) && v.trim() && !looksMasked(v)) {
        return "ثبت کلید، توکن یا رمز سرویس‌ها در نسخه‌ی نمایشی بسته است.";
      }
      return null;
    }
    if (!v || typeof v !== "object" || seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) {
      for (const item of v) {
        const p = walk(item, key, depth + 1);
        if (p) return p;
      }
      return null;
    }
    for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      const p = walk(item, k, depth + 1);
      if (p) return p;
    }
    return null;
  };
  return walk(body, null, 0);
}

// ── سقف درخواست هر IP ─────────────────────────────────────────────
// در حافظه‌ی همان پروسه — دمو یک پروسه‌ی pm2 است و ری‌استارت شمارش را صفر می‌کند

const buckets = new Map<string, { count: number; resetAt: number }>();

/** true یعنی هنوز زیر سقف است (و یکی شمرده شد) */
export function demoRateOk(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// ── آپلود ─────────────────────────────────────────────────────────

const DEMO_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/**
 * در دمو فقط عکس معمولی. SVG و فایل HTML از همان دامنه سرو می‌شوند و
 * اسکریپتشان اجرا می‌شود؛ ویدئو و فایل دانلودی هم جا و پهنای باند می‌خورند.
 */
export function demoUploadProblem(file: { type: string; size: number }): string | null {
  if (!DEMO_IMAGE_TYPES.has(file.type)) {
    return "در نسخه‌ی نمایشی فقط عکس JPG، PNG، WebP، GIF یا AVIF پذیرفته می‌شود.";
  }
  if (file.size > DEMO_MAX_BODY) return "در نسخه‌ی نمایشی حجم عکس حداکثر ۱ مگابایت است.";
  return null;
}
