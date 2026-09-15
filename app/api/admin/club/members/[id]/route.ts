import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { assignOwner, canSeeProfile, setCategory } from "@/lib/club/ownership";
import { serialize } from "@/lib/serialize";
import { fromJalali } from "@/lib/club/jalali";
import {
  setBirthDate,
  setSmsConsent,
  recomputePurchaseStats,
  getPointsBalance,
} from "@/lib/club/profile";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * جزئیات یک عضو.
 *
 * بدون `CUSTOMER_VIEW_ALL` فقط مشتریان خودِ کارمند. عضوِ دیگری ۴۰۴ می‌گیرد
 * نه ۴۰۳، تا شناسه‌ها قابل حدس‌زدن نباشند.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requirePermission(["CUSTOMER_VIEW_OWN", "CUSTOMER_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  if (!(await canSeeProfile(guard.access, id))) {
    return NextResponse.json({ error: "عضو یافت نشد" }, { status: 404 });
  }

  const profile = await prisma.clubProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      },
      tier: { select: { id: true, title: true } },
      points: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      // سند رضایت — بدون دیدنش در پرونده‌ی عضو، دفتر ثبت عملاً بی‌فایده است
      consentEvents: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      identities: {
        select: { channel: true, username: true, isActive: true, subscribedAt: true },
      },
      category: { select: { id: true, title: true, color: true } },
      // تاریخچه‌ی صاحب — «چرا مال اوست» همیشه جواب داشته باشد
      ownerTransfers: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "عضو یافت نشد" }, { status: 404 });
  }

  const [balance, registeredBy] = await Promise.all([
    getPointsBalance(profile.id),
    profile.registeredById
      ? prisma.user.findUnique({
          where: { id: profile.registeredById },
          select: { firstName: true, lastName: true, phone: true },
        })
      : null,
  ]);

  return NextResponse.json(serialize({ ...profile, balance, registeredBy }));
}

/**
 * ویرایش عضو.
 *
 * - نام، دسته، یادداشت، برچسب، تولد: `CUSTOMER_EDIT` روی مشتریِ قابل‌دیدن
 * - رضایت، مسدودی، امتیاز دستی: علاوه بر آن `CUSTOMER_VIEW_ALL` — این‌ها روی
 *   پیام تبلیغاتی و کیف امتیاز اثر دارند و کار مدیریتی باشگاه‌اند
 * - صاحب: `CUSTOMER_ASSIGN`
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requirePermission(["CUSTOMER_EDIT", "CUSTOMER_ASSIGN"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { access } = guard;
  const admin = { id: access.userId };

  const { id } = await params;
  if (!(await canSeeProfile(access, id))) {
    return NextResponse.json({ error: "عضو یافت نشد" }, { status: 404 });
  }

  const profile = await prisma.clubProfile.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "عضو یافت نشد" }, { status: 404 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    smsConsent?: boolean;
    isBlocked?: boolean;
    note?: string | null;
    tags?: string[];
    birthYear?: number | string | null;
    birthMonth?: number | string | null;
    birthDay?: number | string | null;
    clearBirthDate?: boolean;
    recomputeStats?: boolean;
    /** افزودن یا کسر امتیاز دستی */
    pointsDelta?: number;
    pointsNote?: string;
    categoryId?: string | null;
    ownerId?: string | null;
    ownerReason?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const canEdit = can(access, "CUSTOMER_EDIT");
  const canManage = canEdit && can(access, "CUSTOMER_VIEW_ALL");
  const touchesEdit = ["firstName", "lastName", "note", "tags", "birthYear", "clearBirthDate", "categoryId", "recomputeStats"]
    .some((k) => (body as Record<string, unknown>)[k] !== undefined);
  const touchesManage =
    typeof body.smsConsent === "boolean" ||
    typeof body.isBlocked === "boolean" ||
    (typeof body.pointsDelta === "number" && body.pointsDelta !== 0);

  if (touchesEdit && !canEdit) {
    return NextResponse.json({ error: "اجازه‌ی ویرایش مشتری را ندارید" }, { status: 403 });
  }
  if (touchesManage && !canManage) {
    return NextResponse.json(
      { error: "رضایت پیامک، مسدودی و امتیاز فقط با دسترسی مدیریت باشگاه تغییر می‌کند" },
      { status: 403 },
    );
  }

  // ── صاحب و دسته ─────────────────────────────────────────────────
  if (body.ownerId !== undefined) {
    if (!can(access, "CUSTOMER_ASSIGN")) {
      return NextResponse.json({ error: "اجازه‌ی جابه‌جایی صاحب مشتری را ندارید" }, { status: 403 });
    }
    try {
      await assignOwner([id], body.ownerId || null, access, body.ownerReason);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  if (body.categoryId !== undefined) {
    try {
      await setCategory([id], body.categoryId || null);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  // ── اطلاعات کاربر ───────────────────────────────────────────────
  const userData: { firstName?: string; lastName?: string } = {};
  if (typeof body.firstName === "string") userData.firstName = body.firstName.trim();
  if (typeof body.lastName === "string") userData.lastName = body.lastName.trim();

  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: profile.userId }, data: userData });
  }

  // ── پروفایل باشگاه ──────────────────────────────────────────────
  const profileData: {
    isBlocked?: boolean;
    note?: string | null;
    tags?: string[];
  } = {};
  if (typeof body.isBlocked === "boolean") profileData.isBlocked = body.isBlocked;
  if (body.note !== undefined) profileData.note = body.note?.trim() || null;
  if (Array.isArray(body.tags)) {
    profileData.tags = [...new Set(body.tags.map((t) => t.trim()).filter(Boolean))];
  }

  if (Object.keys(profileData).length > 0) {
    await prisma.clubProfile.update({ where: { id }, data: profileData });
  }

  // ── تاریخ تولد ──────────────────────────────────────────────────
  if (body.clearBirthDate) {
    await setBirthDate(profile.userId, null);
  } else if (body.birthYear && body.birthMonth && body.birthDay) {
    const date = fromJalali(
      Number(body.birthYear),
      Number(body.birthMonth),
      Number(body.birthDay)
    );
    if (!date) {
      return NextResponse.json({ error: "تاریخ تولد معتبر نیست" }, { status: 400 });
    }
    if (date > new Date()) {
      return NextResponse.json(
        { error: "تاریخ تولد نمی‌تواند در آینده باشد" },
        { status: 400 }
      );
    }
    await setBirthDate(profile.userId, date);
  }

  // ── رضایت پیامک ─────────────────────────────────────────────────
  if (typeof body.smsConsent === "boolean") {
    await setSmsConsent(profile.userId, body.smsConsent, null);
  }

  // ── امتیاز دستی ─────────────────────────────────────────────────
  if (typeof body.pointsDelta === "number" && body.pointsDelta !== 0) {
    if (!Number.isInteger(body.pointsDelta)) {
      return NextResponse.json({ error: "امتیاز باید عدد صحیح باشد" }, { status: 400 });
    }
    await prisma.pointTransaction.create({
      data: {
        profileId: id,
        amount: body.pointsDelta,
        reason: body.pointsDelta > 0 ? "MANUAL" : "ADJUST",
        note: body.pointsNote?.trim() || `ثبت دستی توسط ادمین`,
        refType: "admin",
        refId: admin.id,
      },
    });
  }

  // ── بازمحاسبه آمار خرید ─────────────────────────────────────────
  if (body.recomputeStats) {
    await recomputePurchaseStats(profile.userId);
  }

  return NextResponse.json({ success: true });
}