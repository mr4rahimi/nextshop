/**
 * ثبت نظر روی محصول — عمومی، بدون نیاز به ورود.
 *
 * نظر همیشه با وضعیت `PENDING` ذخیره می‌شود؛ پاسخ موفق یعنی «ثبت شد و در
 * انتظار تأیید است»، نه «منتشر شد». رابط کاربری باید همین را بگوید.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { REVIEW_LIMITS, hasPurchased } from "@/lib/reviews";
import {
  clean,
  cleanList,
  cleanMultiline,
  clientIp,
  isValidEmail,
} from "@/lib/moderation";

export const runtime = "nodejs";

/** بیش از این تعداد نظر از یک IP در یک ساعت، ثبت نمی‌شود */
const MAX_PER_IP_PER_HOUR = 5;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }

  const productId = clean(body.productId, 40);
  const rating = Number(body.rating);
  const text = cleanMultiline(body.body, REVIEW_LIMITS.body);

  if (!productId) {
    return NextResponse.json({ error: "محصول مشخص نیست" }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "امتیاز باید بین ۱ تا ۵ ستاره باشد" },
      { status: 400 },
    );
  }
  if (text.length < 3) {
    return NextResponse.json({ error: "متن نظر را بنویسید" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
  }

  const user = await getAuthUser();

  // مهمان باید نامی بدهد؛ کاربر عضو نام خودش را دارد
  let guestName: string | null = null;
  let guestEmail: string | null = null;

  if (!user) {
    guestName = clean(body.guestName, REVIEW_LIMITS.name);
    if (guestName.length < 2) {
      return NextResponse.json({ error: "نام خود را بنویسید" }, { status: 400 });
    }

    const email = clean(body.guestEmail, REVIEW_LIMITS.email);
    if (email) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "ایمیل معتبر نیست" }, { status: 400 });
      }
      guestEmail = email.toLowerCase();
    }
  }

  const ip = clientIp(req);

  if (ip) {
    const recent = await prisma.review.count({
      where: { ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= MAX_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: "تعداد نظرهای ثبت‌شده از این دستگاه زیاد است. کمی بعد دوباره تلاش کنید." },
        { status: 429 },
      );
    }
  }

  const isBuyer = user ? await hasPurchased(user.id, productId) : false;

  await prisma.review.create({
    data: {
      productId,
      userId: user?.id ?? null,
      guestName,
      guestEmail,
      rating,
      title: clean(body.title, REVIEW_LIMITS.title) || null,
      body: text,
      pros: cleanList(body.pros, REVIEW_LIMITS.pro, REVIEW_LIMITS.prosCount),
      cons: cleanList(body.cons, REVIEW_LIMITS.con, REVIEW_LIMITS.consCount),
      recommends: typeof body.recommends === "boolean" ? body.recommends : null,
      isBuyer,
      status: "PENDING",
      ip,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    message: "نظر شما ثبت شد و پس از تأیید منتشر می‌شود.",
  });
}
