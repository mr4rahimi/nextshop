import { prisma } from "@/lib/prisma";

const OTP_EXPIRE_MINUTES = 2;
const OTP_SEND_LIMIT = 3;
const OTP_SEND_WINDOW_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function checkOtpRateLimit(phone: string): Promise<void> {
  const windowStart = new Date(Date.now() - OTP_SEND_WINDOW_MINUTES * 60 * 1000);
  const count = await prisma.otpCode.count({
    where: { phone, createdAt: { gt: windowStart } },
  });
  if (count >= OTP_SEND_LIMIT) {
    throw new Error("RATE_LIMIT");
  }
}

export async function saveOtp(phone: string, code: string) {
  await prisma.otpCode.updateMany({
    where: { phone, used: false },
    data: { used: true },
  });

  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { phone, code, expiresAt },
  });
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return false;

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    return false;
  }

  if (otp.code !== code) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
  return true;
}

export { sendOtpSms as sendSms } from "@/lib/sms";
