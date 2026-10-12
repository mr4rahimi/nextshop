import Link from "next/link";
import { parseTextLinks } from "@/lib/text-links";

/**
 * متن ساده‌ای که `[متن](آدرس)` دارد را با لینک واقعی نمایش می‌دهد.
 * خط‌های جدید با `whitespace-pre-line` والد حفظ می‌شوند. lib/text-links.ts
 */

const SITE_HOST = (() => {
  try { return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : undefined; }
  catch { return undefined; }
})();

const LINK_CLS = "font-bold text-primary-600 dark:text-primary-400 underline decoration-primary-300 underline-offset-4 hover:decoration-primary-600";

export default function LinkedText({ text }: { text: string }) {
  return (
    <>
      {parseTextLinks(text, SITE_HOST).map((s, i) => {
        if (s.type === "text") return s.text;
        return s.internal
          ? <Link key={i} href={s.href} className={LINK_CLS}>{s.text}</Link>
          : <a key={i} href={s.href} target="_blank" rel="noopener" className={LINK_CLS}>{s.text}</a>;
      })}
    </>
  );
}
