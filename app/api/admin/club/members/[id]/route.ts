import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
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

async function requireAdmin() {
  const admin = await getAuthUser();
  if (!admin || admin.role !== "ADMIN") return null;
  return admin;
}

/** جزئیات یک عضو */
export async function GET(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

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

/** ویرایش دستی عضو توسط ادمین */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

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
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
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