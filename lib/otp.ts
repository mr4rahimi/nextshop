import { prisma } from "@/lib/prisma";

const OTP_EXPIRE_MINUTES = 2;

// ─────────────────────────────────────────
// ─────────────────────────────────────────
export function generateOtp(): string {

  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ─────────────────────────────────────────
// ─────────────────────────────────────────
export async function saveOtp(phone: string, code: string) {
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
// ─────────────────────────────────────────

export { sendOtpSms as sendSms } from "@/lib/sms";
