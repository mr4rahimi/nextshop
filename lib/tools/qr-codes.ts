/**
 * کیوآر کدهای ذخیره‌شده — docs/features/tools.md بخش ۲.
 *
 * - QR پویا یک لینک کوتاه `kind = QR` دارد؛ ویرایش محتوایش یعنی عوض‌شدن مقصد
 *   همان لینک، و حذفش لینک را هم خاموش می‌کند.
 * - نوع و ثابت/پویا بودن پس از ساخت عوض نمی‌شود — پویای چاپ‌شده نباید ثابت شود.
 * - تصویر ذخیره نمی‌شود؛ مرورگر هر بار از روی همین تنظیمات می‌سازد.
 */

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import type { QrCode, ShortLink } from "@prisma/client";
import { TARGET_HINT, ToolError, normalizeTarget } from "./common";
import {
  QR_TYPE_MAP, cleanQrContent, cleanQrStyle, isQrType, qrLinkTarget, qrStaticPayload, validateQrContent,
  type QrContent, type QrType,
} from "./qr-content";
import { createShortLink, deleteShortLink, shortUrl, updateShortLink } from "./short-links";

type QrRow = QrCode & { shortLink: ShortLink | null };

export function serializeQr(q: QrRow) {
  const type = q.contentType as QrType;
  const content = (q.content ?? {}) as QrContent;
  const short = q.shortLink ? shortUrl(q.shortLink.code) : null;
  return {
    id: q.id,
    title: q.title,
    contentType: type,
    content,
    isDynamic: q.isDynamic,
    style: cleanQrStyle(q.style),
    /** چیزی که داخل تصویر می‌نشیند */
    payload: q.isDynamic && short ? short : qrStaticPayload(type, content),
    shortUrl: short,
    shortLinkId: q.shortLinkId,
    target: q.shortLink?.targetUrl ?? null,
    clickCount: q.shortLink?.clickCount ?? null,
    botCount: q.shortLink?.botCount ?? null,
    createdAt: q.createdAt.toISOString(),
  };
}

export type QrDto = ReturnType<typeof serializeQr>;

/** نوع «لینک» با همان قاعده‌ی لینک کوتاه کامل و سنجیده می‌شود */
function prepare(type: QrType, raw: unknown): QrContent {
  const content = cleanQrContent(type, raw);
  const err = validateQrContent(type, content);
  if (err) throw new ToolError(err);
  if (type === "url") {
    const url = normalizeTarget(content.url, SITE_URL);
    if (!url) throw new ToolError(`آدرس معتبر نیست — ${TARGET_HINT}`);
    content.url = url;
  }
  return content;
}

export async function listQrCodes() {
  const rows = await prisma.qrCode.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { shortLink: true },
    take: 300,
  });
  return rows.map(serializeQr);
}

export async function createQrCode(
  input: { title?: unknown; contentType?: unknown; content?: unknown; isDynamic?: unknown; style?: unknown },
  createdById: string | null,
) {
  if (!isQrType(input.contentType)) throw new ToolError("نوع QR معتبر نیست");
  const type = input.contentType;
  const content = prepare(type, input.content);
  const isDynamic = input.isDynamic === true && QR_TYPE_MAP[type].dynamic;
  const title =
    typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : `QR ${QR_TYPE_MAP[type].label}`;

  let shortLinkId: string | null = null;
  if (isDynamic) {
    const link = await createShortLink({ title, targetUrl: qrLinkTarget(type, content) }, { kind: "QR", createdById });
    shortLinkId = link.id;
  }

  const row = await prisma.qrCode.create({
    data: { title, contentType: type, content, isDynamic, shortLinkId, style: { ...cleanQrStyle(input.style) }, createdById },
    include: { shortLink: true },
  });
  return serializeQr(row);
}

export async function updateQrCode(id: string, input: { title?: unknown; content?: unknown; style?: unknown }) {
  const q = await prisma.qrCode.findFirst({ where: { id, deletedAt: null } });
  if (!q) throw new ToolError("QR پیدا نشد", 404);
  const type = q.contentType as QrType;

  const data: { title?: string; content?: QrContent; style?: object } = {};
  if (typeof input.title === "string" && input.title.trim()) data.title = input.title.trim().slice(0, 120);
  if (input.style !== undefined) data.style = { ...cleanQrStyle(input.style) };
  if (input.content !== undefined) data.content = prepare(type, input.content);

  // پویا: مقصد لینک کوتاه عوض می‌شود — تصویر چاپ‌شده دست نمی‌خورد
  if (q.isDynamic && q.shortLinkId && (data.content || data.title)) {
    await updateShortLink(q.shortLinkId, {
      ...(data.content ? { targetUrl: qrLinkTarget(type, data.content) } : {}),
      ...(data.title ? { title: data.title } : {}),
    });
  }

  const row = await prisma.qrCode.update({ where: { id }, data, include: { shortLink: true } });
  return serializeQr(row);
}

export async function deleteQrCode(id: string) {
  const q = await prisma.qrCode.findFirst({ where: { id, deletedAt: null } });
  if (!q) return;
  await prisma.qrCode.update({ where: { id }, data: { deletedAt: new Date() } });
  if (q.shortLinkId) await deleteShortLink(q.shortLinkId);
}
