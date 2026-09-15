/**
 * یادداشت‌های شخصی کارتابل — مثل Google Keep.
 *
 * ⚠️ حریم خصوصی: هر تابع اینجا `userId` می‌گیرد و فقط روی ردیف‌های همان
 * کاربر کار می‌کند. ویرایش و حذف با `updateMany`/`deleteMany` و شرط
 * `userId` انجام می‌شود تا شناسه‌ی یادداشتِ کسِ دیگر، حتی اگر لو برود،
 * هیچ اثری نداشته باشد. هیچ مجوزی این مرز را باز نمی‌کند.
 */

import { prisma } from "@/lib/prisma";
import { NOTE_COLORS, type NoteColor } from "./note-colors";

export const MAX_TITLE = 200;
export const MAX_BODY = 20_000;

const SELECT = {
  id: true,
  title: true,
  body: true,
  color: true,
  pinned: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface NoteInput {
  title?: string;
  body?: string;
  color?: NoteColor;
  pinned?: boolean;
  archived?: boolean;
}

/** فقط فیلدهای معتبر را برمی‌دارد؛ خطا یعنی ورودی قابل ذخیره نیست */
export function parseNoteInput(raw: unknown): { data: NoteInput } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "بدنه‌ی نامعتبر" };
  const b = raw as Record<string, unknown>;
  const data: NoteInput = {};

  if (b.title !== undefined) {
    if (typeof b.title !== "string") return { error: "عنوان نامعتبر است" };
    data.title = b.title.trim().slice(0, MAX_TITLE);
  }
  if (b.body !== undefined) {
    if (typeof b.body !== "string") return { error: "متن نامعتبر است" };
    if (b.body.length > MAX_BODY) return { error: "متن یادداشت خیلی طولانی است" };
    data.body = b.body;
  }
  if (b.color !== undefined) {
    if (!NOTE_COLORS.includes(b.color as NoteColor)) return { error: "رنگ نامعتبر است" };
    data.color = b.color as NoteColor;
  }
  if (b.pinned !== undefined) data.pinned = b.pinned === true;
  if (b.archived !== undefined) data.archived = b.archived === true;

  // بایگانی و سنجاق هم‌زمان معنی ندارد — مثل Keep، بایگانی سنجاق را برمی‌دارد
  if (data.archived) data.pinned = false;

  return { data };
}

export function listMyNotes(userId: string, archived: boolean) {
  return prisma.staffNote.findMany({
    where: { userId, archived },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: SELECT,
  });
}

export function createMyNote(userId: string, data: NoteInput) {
  return prisma.staffNote.create({
    data: { ...data, userId },
    select: SELECT,
  });
}

/** `null` یعنی یادداشت پیدا نشد یا مال این کاربر نیست — عمداً یکی‌اند */
export async function updateMyNote(userId: string, id: string, data: NoteInput) {
  const { count } = await prisma.staffNote.updateMany({ where: { id, userId }, data });
  if (count === 0) return null;
  return prisma.staffNote.findFirst({ where: { id, userId }, select: SELECT });
}

export async function deleteMyNote(userId: string, id: string) {
  const { count } = await prisma.staffNote.deleteMany({ where: { id, userId } });
  return count > 0;
}
