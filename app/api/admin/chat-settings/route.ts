import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";

const DEFAULT_CHAT_SETTINGS = {
  phone: "",
  email: "",
  address: "",
  workingHours: "",
  socials: {
    instagram: "",
    telegram: "",
    whatsapp: "",
  },
  shippingInfo: "",
  shippingCost: "",
  warrantyInfo: "",
  aboutBusiness: "",
  welcomeMessage: "سلام! من دستیار خرید این فروشگاه هستم. چطور می‌تونم کمکت کنم؟",
  isEnabled: true,
  historyLimit: 4,
  gapgptApiKey: "",
  faq: [] as { question: string; answer: string }[],
  buttonsMode: "auto",
};

export async function GET() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { chatSettings: true },
  });

  // کلید به «تنظیمات هوش مصنوعی» منتقل شده و به مرورگر برنمی‌گردد — lib/ai/settings.ts
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gapgptApiKey: _key, ...saved } = (settings?.chatSettings as Record<string, unknown>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gapgptApiKey: _def, ...defaults } = DEFAULT_CHAT_SETTINGS;
  return NextResponse.json({ ...defaults, ...saved });
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

  // کلید قدیمی را نگه می‌داریم: فرم دیگر آن را نمی‌فرستد و بدون این، ذخیره پاکش می‌کرد
  const prev = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { chatSettings: true } });
  const prevKey = (prev?.chatSettings as { gapgptApiKey?: string } | null)?.gapgptApiKey;
  delete data.gapgptApiKey;
  if (prevKey) data.gapgptApiKey = prevKey;

  const settings = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { chatSettings: data as Prisma.InputJsonValue },
    create: { id: "singleton", chatSettings: data as Prisma.InputJsonValue },
    select: { chatSettings: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gapgptApiKey: _k, ...out } = (settings.chatSettings as Record<string, unknown>) ?? {};
  return NextResponse.json(out);
}
