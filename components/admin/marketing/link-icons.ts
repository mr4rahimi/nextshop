/**
 * نگاشت نام آیکن نوع لینک به کامپوننت lucide.
 *
 * صریح است نه پویا: ایمپورت پویا از lucide کل کتابخانه را وارد باندل می‌کند.
 * نامی که اینجا نباشد به آیکن پیش‌فرض می‌افتد. نام‌ها همان ستون
 * `LinkType.icon` است که سید (`scripts/seed-link-types.ts`) می‌نویسد.
 */

import { createElement } from "react";
import {
  Bookmark,
  BookOpen,
  CircleHelp,
  FilePen,
  FileText,
  GraduationCap,
  HandHeart,
  Image as ImageIcon,
  Landmark,
  Link as LinkIcon,
  ListTree,
  MapPin,
  MessageSquare,
  MessagesSquare,
  Mic,
  Newspaper,
  NotebookPen,
  PenLine,
  Quote,
  RectangleHorizontal,
  Scale,
  Share2,
  Store,
  TriangleAlert,
  Unlink,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";

export const LINK_TYPE_ICONS: Record<string, LucideIcon> = {
  "notebook-pen": NotebookPen,
  "pen-line": PenLine,
  newspaper: Newspaper,
  "file-pen": FilePen,
  "user-round": UserRound,
  "message-square": MessageSquare,
  "messages-square": MessagesSquare,
  "circle-help": CircleHelp,
  "list-tree": ListTree,
  "map-pin": MapPin,
  "share-2": Share2,
  video: Video,
  mic: Mic,
  image: ImageIcon,
  "file-text": FileText,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  landmark: Landmark,
  "rectangle-horizontal": RectangleHorizontal,
  "hand-heart": HandHeart,
  unlink: Unlink,
  bookmark: Bookmark,
  quote: Quote,
  store: Store,
  scale: Scale,
  "triangle-alert": TriangleAlert,
  link: LinkIcon,
};

export const LINK_ICON_NAMES = Object.keys(LINK_TYPE_ICONS);

export function linkTypeIcon(name: string | null | undefined): LucideIcon {
  return (name && LINK_TYPE_ICONS[name]) || LinkIcon;
}

/**
 * آیکن نوع به‌صورت کامپوننت ثابت.
 *
 * ⚠️ `const Icon = linkTypeIcon(name); <Icon />` در بدنه‌ی رندر را قاعده‌ی
 * `react-hooks/static-components` رد می‌کند (کامپوننتِ ساخته‌شده حین رندر
 * state خودش را هر بار از دست می‌دهد). این یکی ثابت است و فقط نام می‌گیرد.
 */
export function LinkTypeIcon({
  icon,
  ...props
}: { icon: string | null | undefined } & Omit<React.SVGProps<SVGSVGElement>, "ref"> & {
  color?: string;
  strokeWidth?: number;
}) {
  return createElement(linkTypeIcon(icon), props);
}
