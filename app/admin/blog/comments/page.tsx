import { redirect } from "next/navigation";

/** نظرات بلاگ به بخش یکپارچه‌ی نظرات منتقل شد؛ لینک قدیمی نمی‌شکند. */
export default function BlogCommentsRedirect() {
  redirect("/admin/comments?tab=blog");
}
