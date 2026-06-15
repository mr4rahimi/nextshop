import { prisma } from "@/lib/prisma";

const OTP_EXPIRE_MINUTES = 2;

// ─────────────────────────────────────────
// تولید OTP
// ─────────────────────────────────────────
export function generateOtp(): string {

  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ─────────────────────────────────────────
// ذخیره OTP
// ─────────────────────────────────────────
export async function saveOtp(phone: string, code: string) {
  // کدهای قبلی را invalid کن
  await prisma.otpCode.updateMany({
    where: {
      phone,
      used: false,
    },
    data: {
      used: true,
    },
  });

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000
  );

  await prisma.otpCode.create({
    data: {
      phone,
      code,
      expiresAt,
    },
  });
}

// ─────────────────────────────────────────
// بررسی OTP
// ─────────────────────────────────────────
export async function verifyOtp(
  phone: string,
  code: string
): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      code,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otp) return false;

  // یکبار مصرف
  await prisma.otpCode.update({
    where: {
      id: otp.id,
    },
    data: {
      used: true,
    },
  });

  return true;
}

// ─────────────────────────────────────────
// ارسال SMS واقعی (فراز اس ام اس)
// ─────────────────────────────────────────

export { sendOtpSms as sendSms } from "@/lib/sms";