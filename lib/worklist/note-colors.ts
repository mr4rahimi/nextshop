/**
 * رنگ‌های مجاز یادداشت شخصی.
 *
 * جدا از `staff-notes.ts` است چون کامپوننت کلاینت هم لازمش دارد و آن فایل
 * Prisma را ایمپورت می‌کند.
 */
export const NOTE_COLORS = [
  "default",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "gray",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];
