import { NextResponse } from "next/server";
import {
  generateOtp,
  saveOtp,
  sendSms,
} from "@/lib/otp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone || !/^09[0-9]{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "شماره موبایل نامعتبر است" },
        { status: 400 }
      );
    }

    const code = generateOtp();

    await saveOtp(phone, code);
    await sendSms(phone, code);

    return NextResponse.json({
      success: true,

      ...(process.env.NODE_ENV !== "production" && {
        devCode: code,
      }),
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return NextResponse.json(
      {
        error:
          "ارسال پیامک با خطا مواجه شد. دوباره تلاش کنید",
      },
      { status: 500 }
    );
  }
}
