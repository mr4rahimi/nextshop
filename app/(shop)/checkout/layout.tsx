import { noIndexMetadata } from "@/lib/seo";

// لایوت فقط برای متادیتاست: noindex به هر ۵ صفحه‌ی checkout
// (confirm / success / failed / pending و خود صفحه) کاسکید می‌شود.
export const metadata = noIndexMetadata("تکمیل سفارش");

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
