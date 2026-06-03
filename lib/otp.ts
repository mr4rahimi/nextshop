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
export async function sendSms(
  phone: string,
  code: string
) {
  const apiKey = process.env.IRANPAYAMAK_API_KEY;
  const lineNumber = process.env.IRANPAYAMAK_LINE_NUMBER;
  const patternCode = process.env.IRANPAYAMAK_PATTERN_CODE;

  if (!apiKey || !lineNumber || !patternCode) {
    throw new Error("IranPayamak env variables missing");
  }

  const response = await fetch(
    "https://api.iranpayamak.com/ws/v1/sms/pattern",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        code: patternCode,
        recipient: phone,
        line_number: lineNumber,
        number_format: "english",
        attributes: {
          code: code,
        },
      }),
    }
  );

  const data = await response.json();

  console.log("IranPayamak response:", data);

  if (!response.ok) {
    console.error("IranPayamak error:", data);
    throw new Error("خطا در ارسال پیامک");
  }

  console.log(`OTP sent to ${phone}: ${code}`);
}