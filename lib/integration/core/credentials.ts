import { prisma } from "@/lib/prisma";
import { decryptCredentials, encryptCredentials } from "./crypto";

// به‌روزرسانی بخشی از credentialهای یک اتصال — برای توکن‌هایی که خودِ آداپتور
// در حین کار تازه می‌کند (مثلاً refresh توکن باسلام).
//
// نکته: بلوب فعلی دوباره از دیتابیس خوانده و merge می‌شود، نه اینکه با نسخه‌ی
// در حافظه‌ی job بازنویسی شود؛ وگرنه دو job همزمان می‌توانستند فیلدهای هم را
// پاک کنند.
export async function patchConnectionCredentials(
  platformCode: string,
  patch: Record<string, string>,
): Promise<void> {
  const conn = await prisma.integConnection.findFirst({
    where:  { platformCode },
    select: { id: true, credentials: true },
  });
  if (!conn) return;

  let current: Record<string, string> = {};
  try {
    current = decryptCredentials(conn.credentials);
  } catch {
    // بلوب خراب یا کلید عوض‌شده — بازنویسی کاملش خطرناک‌تر از رها کردنش است
    return;
  }

  await prisma.integConnection.update({
    where: { id: conn.id },
    data:  { credentials: encryptCredentials({ ...current, ...patch }) },
  });
}
