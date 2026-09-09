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
        label: "انواع کار و قواعد تکرارشونده",
        hint: "شامل وزن‌ها و فاصله‌ی تماس دوره‌ای",
      },
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
