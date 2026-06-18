import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";

// ساختار پیش‌فرض تنظیمات چت
const DEFAULT_CHAT_SETTINGS = {
  // اطلاعات تماس
  phone: "",
  email: "",
  address: "",
  workingHours: "",
  // شبکه‌های اجتماعی
  socials: {
    instagram: "",
    telegram: "",
    whatsapp: "",
  },
  // ارسال و گارانتی
  shippingInfo: "",
  shippingCost: "",
  warrantyInfo: "",
  // اطلاعات کلی
  aboutBusiness: "",
  // چت
  welcomeMessage: "سلام! من دستیار خرید این فروشگاه هستم. چطور می‌تونم کمکت کنم؟",
  isEnabled: true,
  // سوالات متداول — آرایه‌ای از { question, answer }
  faq: [] as { question: string; answer: string }[],
};

export async function GET() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { chatSettings: true },
  });


  const saved = (settings?.chatSettings as Record<string, unknown>) ?? {};
  return NextResponse.json({ ...DEFAULT_CHAT_SETTINGS, ...saved });
}

export async function PUT(req: Request) {

  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const settings = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { chatSettings: data as Prisma.InputJsonValue },
    create: { id: "singleton", chatSettings: data as Prisma.InputJsonValue },
    select: { chatSettings: true },
  });

  return NextResponse.json(settings.chatSettings);
}