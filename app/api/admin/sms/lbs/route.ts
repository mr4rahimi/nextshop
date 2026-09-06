import { withPanel, readJson, intParam, requireString, requireNumber } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ارسال موقعیت‌محور — فهرست و ثبت درخواست جدید */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return withPanel((panel) =>
    panel.getLbsRequests(intParam(url, "page", 1), intParam(url, "limit", 20))
  );
}

export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);
    return panel.createLbs({
      text: requireString(body, "text", "متن پیامک"),
      startTime: requireNumber(body, "startTime", "زمان شروع"),
      endTime: requireNumber(body, "endTime", "زمان پایان"),
      receiverCount: requireNumber(body, "receiverCount", "تعداد گیرنده"),
      latitude: requireNumber(body, "latitude", "عرض جغرافیایی"),
      longitude: requireNumber(body, "longitude", "طول جغرافیایی"),
      radius: requireNumber(body, "radius", "شعاع"),
      ...(typeof body.address === "string" ? { address: body.address } : {}),
      ...(typeof body.dispatchMoment === "string" ? { dispatchMoment: body.dispatchMoment } : {}),
      ...(typeof body.receiverGender === "string" ? { receiverGender: body.receiverGender } : {}),
      ...(typeof body.device === "string" ? { device: body.device } : {}),
      ...(Number.isFinite(Number(body.receiverAgeFrom))
        ? { receiverAgeFrom: Number(body.receiverAgeFrom) }
        : {}),
      ...(Number.isFinite(Number(body.receiverAgeTo))
        ? { receiverAgeTo: Number(body.receiverAgeTo) }
        : {}),
    });
  });
}
