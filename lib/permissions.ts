/**
 * مجوزهای کارتابل — تعریف در کد، ترکیب در دیتابیس.
 *
 * الگو: هیچ بخشی بر اساس **نقش** تصمیم نمی‌گیرد، همیشه **مجوز** بررسی می‌شود.
 * نقش (`StaffRole`) فقط یک بسته‌ی مجوز است.
 *
 * ⚠️ کلیدها فقط اینجا تعریف می‌شوند. مدیر می‌تواند نقش بسازد و مجوزها را
 * جابه‌جا کند، ولی نمی‌تواند کلید تازه اختراع کند — مجوزی که هیچ کدی چکش
 * نمی‌کند فقط توهم امنیت می‌سازد.
 *
 * ⚠️ سازگاری عقب‌رو: کاربر `ADMIN` که `staffRoleId` ندارد **دسترسی کامل**
 * دارد. این تنها چیزی است که مانع قفل‌شدن همه بیرونِ پنل در روز دیپلوی
 * می‌شود. تا وقتی مدیر عمداً نقشی به کسی نداده، رفتار سیستم دقیقاً مثل قبل است.
 *
 * مستندات: docs/features/staff-worklist.md بخش ۱۲
 */

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** یک مجوز — گروه‌بندی فقط برای نمایش در فرم نقش است، نه معنای فنی */
export interface PermissionDef {
  key: string;
  label: string;
  /** توضیح کوتاه برای فرم نقش، وقتی خودِ برچسب کافی نیست */
  hint?: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  items: PermissionDef[];
}

/**
 * کاتالوگ مجوزها.
 *
 * گروه‌های «کارتابل» تا «تنظیمات» از فاز صفر فعال‌اند. گروه‌های بعدی
 * (محصول، سفارش، باشگاه و …) کلیدشان از حالا رزرو شده ولی هیچ مسیری هنوز
 * چکشان نمی‌کند؛ مهاجرت مسیرهای قدیمی کارِ فاز ۷ است.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "worklist",
    label: "کارتابل",
    items: [
      { key: "WORK_VIEW_OWN", label: "دیدن کارهای خودم" },
      { key: "WORK_VIEW_ALL", label: "دیدن کارهای همه" },
      { key: "WORK_CREATE", label: "ثبت کار" },
      { key: "WORK_EDIT_OWN", label: "ویرایش کار خودم" },
      { key: "WORK_EDIT_ALL", label: "ویرایش کار دیگران" },
      { key: "WORK_ASSIGN", label: "ارجاع کار به دیگران" },
      { key: "WORK_DELETE", label: "حذف کار" },
    ],
  },
  {
    key: "calls",
    label: "تماس‌ها",
    items: [
      { key: "CALL_VIEW_OWN", label: "دیدن تماس‌های خودم" },
      { key: "CALL_VIEW_ALL", label: "دیدن تماس‌های همه" },
      { key: "CALL_LOG", label: "ثبت تماس و نتیجه" },
    ],
  },
  {
    key: "orders",
    label: "سفارش",
    items: [
      {
        key: "ORDER_CREATE",
        label: "ثبت سفارش تلفنی",
        hint: "ثبت سفارش از پنل، جدا از مجوز ثبت کار در کارتابل",
      },
    ],
  },
  {
    key: "customers",
    label: "مشتریان باشگاه",
    items: [
      { key: "CUSTOMER_VIEW_OWN", label: "دیدن مشتریان خودم" },
      { key: "CUSTOMER_VIEW_ALL", label: "دیدن مشتریان همه", hint: "شامل گزارش پخش مشتری بین کارکنان" },
      { key: "CUSTOMER_CREATE", label: "ثبت مشتری تازه" },
      { key: "CUSTOMER_EDIT", label: "ویرایش نام، دسته و یادداشت مشتریان خودم" },
      {
        key: "CUSTOMER_ASSIGN",
        label: "جابه‌جایی صاحب مشتری",
        hint: "مجوز مدیریتی — پورسانت به صاحب مشتری می‌رسد",
      },
      { key: "CUSTOMER_CATEGORY_MANAGE", label: "ساخت و ویرایش دسته‌های مشتری" },
    ],
  },
  {
    key: "suppliers",
    label: "تأمین‌کننده‌ها",
    items: [
      { key: "SUPPLIER_VIEW", label: "دیدن فهرست تأمین‌کننده‌ها" },
      { key: "SUPPLIER_CREATE", label: "افزودن سریع تأمین‌کننده", hint: "از داخل فرم کار" },
      { key: "SUPPLIER_MANAGE", label: "ویرایش و غیرفعال‌کردن تأمین‌کننده" },
    ],
  },
  {
    key: "deals",
    label: "سود و پورسانت",
    items: [
      { key: "DEAL_LOG", label: "ثبت قیمت خرید روی معاملات خودم" },
      {
        key: "DEAL_VIEW_ALL",
        label: "دیدن سود و حاشیه‌ی همه",
        hint: "قیمت خرید و حاشیه‌ی سود حساس‌ترین عدد مجموعه است",
      },
      { key: "COMMISSION_VIEW_OWN", label: "دیدن پورسانت خودم" },
      { key: "COMMISSION_VIEW_ALL", label: "دیدن پورسانت همه" },
      {
        key: "COMMISSION_MANAGE",
        label: "طرح پورسانت، تخصیص معامله و ثبت پرداخت",
        hint: "پرداخت برگشت‌ناپذیر است",
      },
    ],
  },
  {
    key: "credit",
    label: "خرید اعتباری",
    items: [
      { key: "CREDIT_VIEW_OWN", label: "دیدن موعدهای مشتریان خودم" },
      { key: "CREDIT_VIEW_ALL", label: "دیدن همه‌ی موعدها و جمع معوقات" },
      {
        key: "CREDIT_MANAGE",
        label: "تعیین اعتباری در سفارش، ثبت واریز و تمدید موعد",
        hint: "ثبت واریز یعنی بدهی مشتری بسته می‌شود؛ با مدیر مالی هماهنگ باشد",
      },
    ],
  },
  {
    // دسترسی به بخش‌های قدیمی پنل — نقشه‌ی مسیرها در lib/admin-sections.ts
    key: "panel",
    label: "بخش‌های پنل مدیریت",
    items: [
      { key: "PANEL_CATALOG", label: "محصولات، دسته‌ها، برندها و رسانه" },
      { key: "PANEL_ORDERS", label: "سفارش‌ها، ارسال، کیف پول و گارانتی" },
      { key: "PANEL_CONTENT", label: "مقاله، برگه، نظرات، بنر، منو و سئو" },
      { key: "PANEL_USERS", label: "کاربران و ادمین‌ها", hint: "شامل تغییر رمز و نقش ادمین‌ها" },
      { key: "PANEL_CLUB", label: "باشگاه، پیامک انبوه و کمپین", hint: "فهرست «مشتریان من» جداست" },
      { key: "PANEL_INTEGRATION", label: "یکپارچه‌سازی، بازارگاه و قیمت خرید", hint: "قیمت خرید حسابداری اینجا دیده می‌شود" },
      { key: "PANEL_SETTINGS", label: "تنظیمات فروشگاه و گفتگو" },
      { key: "PANEL_REPORTS", label: "گزارش عملکرد و داشبورد" },
    ],
  },
  {
    // حسابداری — docs/plans/accounting.md بخش ۱۴. کلیدهای بعدی با فاز خودشان می‌آیند.
    key: "accounting",
    label: "حسابداری",
    items: [
      { key: "ACC_VIEW", label: "دیدن حسابداری: مانده‌ها، اشخاص، صندوق و بانک، رویدادها" },
      { key: "ACC_PARTY_MANAGE", label: "افزودن و ویرایش اشخاص حسابداری" },
      {
        key: "ACC_VOUCHER",
        label: "نمای حسابدار: سند دستی، ابطال و معکوس سند",
        hint: "سند دستی مستقیم روی حساب‌ها می‌نشیند؛ فقط برای کسی که حسابداری می‌داند",
      },
      { key: "ACC_INVENTORY", label: "انبار: حواله، انبارگردانی، موجودی اول دوره و تعریف انبار" },
      {
        key: "ACC_COST_VIEW",
        label: "دیدن بهای تمام‌شده و ارزش موجودی",
        hint: "بهای خرید حساس‌ترین عدد کسب‌وکار است",
      },
      {
        key: "ACC_SETTINGS",
        label: "راه‌اندازی و تنظیمات حسابداری",
        hint: "حالت حسابداری، سال مالی، تاریخ قفل، سرفصل، صندوق و بانک و مانده‌های اول دوره",
      },
    ],
  },
  {
    key: "staff",
    label: "کارکنان",
    items: [
      { key: "STAFF_VIEW", label: "دیدن فهرست کارکنان" },
      { key: "STAFF_MANAGE", label: "افزودن و ویرایش کارمند" },
      { key: "ROLE_MANAGE", label: "مدیریت نقش‌ها و دسترسی‌ها" },
    ],
  },
  {
    key: "attendance",
    label: "حضور",
    items: [
      { key: "ATTENDANCE_VIEW_OWN", label: "دیدن حضور خودم" },
      { key: "ATTENDANCE_VIEW_ALL", label: "دیدن حضور همه" },
      {
        key: "ATTENDANCE_EDIT",
        label: "اصلاح دستی روز حضور",
        hint: "اصلاح با ثبت نام اصلاح‌کننده ذخیره می‌شود",
      },
    ],
  },
  {
    key: "reports",
    label: "گزارش",
    items: [
      { key: "WORK_REPORT_VIEW", label: "گزارش عملکرد تیم" },
      { key: "WORK_REPORT_EXPORT", label: "خروجی گرفتن از گزارش" },
    ],
  },
  {
    key: "settings",
    label: "تنظیمات کارتابل",
    items: [
      {
        key: "WORK_SETTINGS_MANAGE",
        label: "انواع کار، قواعد تکرارشونده و ساعت کاری",
        hint: "شامل وزن‌ها، فاصله‌ی تماس دوره‌ای و تعریف مشتری ثابت",
      },
    ],
  },
  {
    // سئو، محتوا و لینک‌سازی — docs/plans/seo-marketing.md بخش ۴
    //
    // ⚠️ فهرست «کارکنان» هر حوزه از همین مجوزها می‌آید، نه از یک فیلد بخش:
    // مسئول کار سئو از دارندگان SEO_TASK_WORK، محتوانویس از CONTENT_TASK_WORK،
    // مسئول گره از LINK_WORK. یک قانون بهتر از دو قانونی است که با هم اختلاف
    // پیدا می‌کنند.
    key: "marketing",
    label: "سئو، محتوا و لینک‌سازی",
    items: [
      {
        key: "MARKETING_VIEW_ALL",
        label: "دیدن کارهای سئو، محتوا و لینک‌سازیِ همه",
        hint: "بدون این مجوز، کارمند فقط کارهایی را می‌بیند که مسئول یا سازنده‌شان است",
      },
      { key: "SEO_TASK_WORK", label: "انجام و ثبت کار سئو" },
      {
        key: "SEO_TASK_MANAGE",
        label: "تأیید، برگشت و کار دوره‌ای سئو",
        hint: "تأیید نهایی همیشه با مدیر است، حتی اگر کار را خودش ثبت کرده باشد",
      },
      {
        key: "CONTENT_TASK_WORK",
        label: "نوشتن و انتشار محتوا",
        hint: "انتشار از داخل کار محتوا انجام می‌شود و PANEL_CONTENT لازم ندارد",
      },
      { key: "CONTENT_TASK_MANAGE", label: "ساخت، تأیید و برگشت کار محتوا" },
      { key: "LINK_WORK", label: "ساخت لینک و ثبت آدرس منتشرشده" },
      { key: "LINK_MANAGE", label: "کمپین، چارت، ارجاع و تأیید گره" },
      { key: "MARKETING_SETTINGS_MANAGE", label: "دسته‌های سئو، انواع لینک و پلتفرم‌ها" },
      { key: "SEO_ANALYTICS_VIEW", label: "بخش آنالیز سئو" },
    ],
  },
  {
    key: "score",
    label: "امتیاز و پاداش",
    items: [
      { key: "SCORE_VIEW_OWN", label: "دیدن امتیاز خودم" },
      { key: "SCORE_VIEW_ALL", label: "دیدن امتیاز همه" },
      { key: "SCORE_SETTINGS_MANAGE", label: "تنظیم معیارها و وزن‌ها" },
    ],
  },
];

/** همه‌ی کلیدهای معتبر — مبنای اعتبارسنجی ورودی فرم نقش */
export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

const PERMISSION_SET = new Set(ALL_PERMISSIONS);

/** برچسب فارسی هر کلید — برای نمایش در گزارش و ActivityLog */
export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);

/** فقط کلیدهای شناخته‌شده را نگه می‌دارد، بدون تکرار */
export function sanitizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw === "string" && PERMISSION_SET.has(raw)) seen.add(raw);
  }
  return ALL_PERMISSIONS.filter((k) => seen.has(k));
}

// ─────────────────────────────────────────────────────────────────
// بررسی دسترسی
// ─────────────────────────────────────────────────────────────────

export interface StaffAccess {
  userId: string;
  name: string;
  phone: string;
  role: string;
  roleId: string | null;
  roleTitle: string | null;
  permissions: string[];
  /** ادمین بدون نقش — همه‌چیز مجاز است */
  isUnrestricted: boolean;
}

/**
 * دسترسی کاربر جاری.
 *
 * `null` یعنی وارد نشده یا غیرفعال است. تشخیص «وارد نشده» از «دسترسی ندارد»
 * را به فراخواننده می‌سپاریم تا بتواند ۴۰۱ و ۴۰۳ را درست تفکیک کند.
 */
export async function getStaffAccess(): Promise<StaffAccess | null> {
  const user = await getAuthUser();
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "SELLER") return null;

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.phone ||
    "بدون نام";

  const base = {
    userId: user.id,
    name,
    phone: user.phone,
    role: user.role,
  };

  // فروشنده هیچ‌وقت دسترسی کامل نمی‌گیرد؛ بدون نقش یعنی هیچ مجوزی.
  const staffRoleId = user.staffRoleId;
  if (!staffRoleId) {
    const unrestricted = user.role === "ADMIN";
    return {
      ...base,
      roleId: null,
      roleTitle: null,
      permissions: unrestricted ? ALL_PERMISSIONS : [],
      isUnrestricted: unrestricted,
    };
  }

  const role = await prisma.staffRole.findUnique({
    where: { id: staffRoleId },
    select: { id: true, title: true, permissions: true, isActive: true },
  });

  // نقشِ غیرفعال‌شده یا حذف‌شده: به رفتار «بدون نقش» برنمی‌گردیم، وگرنه
  // غیرفعال‌کردن یک نقش به‌جای بستن دسترسی، آن را باز می‌کرد.
  if (!role || !role.isActive) {
    return {
      ...base,
      roleId: staffRoleId,
      roleTitle: role?.title ?? null,
      permissions: [],
      isUnrestricted: false,
    };
  }

  return {
    ...base,
    roleId: role.id,
    roleTitle: role.title,
    permissions: role.permissions,
    isUnrestricted: false,
  };
}

/** آیا این دسترسی، مجوز خواسته‌شده را دارد */
export function can(access: StaffAccess | null, permission: string): boolean {
  if (!access) return false;
  if (access.isUnrestricted) return true;
  return access.permissions.includes(permission);
}

/** آیا دست‌کم یکی از مجوزها را دارد */
export function canAny(access: StaffAccess | null, permissions: string[]): boolean {
  if (!access) return false;
  if (access.isUnrestricted) return true;
  return permissions.some((p) => access.permissions.includes(p));
}

export type GuardResult =
  | { ok: true; access: StaffAccess }
  | { ok: false; status: 401 | 403; error: string };

/**
 * نگهبان مسیرهای API.
 *
 * ```ts
 * const guard = await requirePermission("WORK_VIEW_ALL");
 * if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
 * ```
 */
export async function requirePermission(
  permission: string | string[],
): Promise<GuardResult> {
  const access = await getStaffAccess();
  if (!access) return { ok: false, status: 401, error: "وارد نشده‌اید" };

  const wanted = Array.isArray(permission) ? permission : [permission];
  if (!canAny(access, wanted)) {
    return { ok: false, status: 403, error: "به این بخش دسترسی ندارید" };
  }
  return { ok: true, access };
}
