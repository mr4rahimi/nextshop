import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPanel, SmsApiError } from "@/lib/club/sms";
import { errorResponse, readJson, normalizeMobile } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سقف حجم فایل صوتی — بالاتر از این آپلود در چرخه‌ی درخواست کند می‌شود */
const MAX_VOICE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"];

/** آپلود فایل صوتی به پنل — فایل روی سرور ما ذخیره نمی‌شود */
export async function PUT(req: Request) {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new SmsApiError("VALIDATION", "فایل صوتی ارسال نشده است");
    }
    if (file.size > MAX_VOICE_BYTES) {
      throw new SmsApiError("VALIDATION", "حجم فایل صوتی بیش از ۵ مگابایت است");
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      throw new SmsApiError("VALIDATION", "فرمت فایل باید mp3، wav یا ogg باشد");
    }

    const panel = await getPanel();
    return NextResponse.json({ file: await panel.uploadVoice(file, file.name) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** ارسال پیام صوتی آپلودشده */
export async function POST(req: Request) {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await readJson(req);
    const fileId = Number(body.fileId);
    if (!Number.isFinite(fileId) || fileId <= 0) {
      throw new SmsApiError("VALIDATION", "فایل صوتی انتخاب نشده است");
    }

    const raw = Array.isArray(body.recipients)
      ? body.recipients
      : String(body.recipients ?? "").split(/[\s,;،\n]+/);

    const recipients = [...new Set(
      raw.map((v) => normalizeMobile(String(v ?? ""))).filter((v): v is string => Boolean(v))
    )];

    if (recipients.length === 0) {
      throw new SmsApiError("VALIDATION", "هیچ شماره‌ی معتبری در فهرست گیرندگان نبود");
    }

    const panel = await getPanel();
    const line = typeof body.lineNumber === "string" ? body.lineNumber.trim() : "";
    const res = await panel.sendVoice(fileId, recipients, line || undefined);

    return NextResponse.json({ success: true, requestId: res.requestId ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}
