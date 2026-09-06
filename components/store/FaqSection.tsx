"use client";

import { useId } from "react";
import type { FaqItem } from "@/lib/faq";

interface Props {
  items: FaqItem[];
  /** عنوان بخش. اگر ندهید «سوالات متداول» است. */
  heading?: string;
  /**
   * سطح تیتر. صفحه‌ی محصول و دسته `h2` می‌خواهند؛ داخل مقاله‌ای که از قبل
   * `h2` دارد ممکن است `h2` درست باشد ولی جای دیگری `h3`. سطح تیتر بخشی از
   * ساختار سند است، پس نباید سخت‌کد شود.
   */
  headingLevel?: 2 | 3;
  className?: string;
}

/**
 * آکاردئون سوالات متداول.
 *
 * با `<details>` بومی ساخته شده نه با state — سه دلیل:
 * ۱. بدون جاوااسکریپت هم باز و بسته می‌شود.
 * ۲. دسترسی‌پذیری (صفحه‌خوان، کیبورد) از خود مرورگر می‌آید.
 * ۳. متن پاسخ همیشه در DOM است، پس خزنده آن را می‌بیند — اگر با state
 *    شرطی رندر می‌شد، محتوای پاسخ‌ها برای گوگل وجود نداشت و اسکیمای
 *    `FAQPage` با محتوای صفحه نمی‌خواند.
 */
export default function FaqSection({
  items,
  heading = "سوالات متداول",
  headingLevel = 2,
  className = "",
}: Props) {
  const uid = useId();
  if (!items.length) return null;

  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <section
      className={`mt-10 ${className}`}
      aria-labelledby={`${uid}-faq-heading`}
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2 h-8 bg-primary-600 rounded-full" />
        <Heading
          id={`${uid}-faq-heading`}
          className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white"
        >
          {heading}
        </Heading>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="group bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden"
          >
            <summary className="flex items-start gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden px-5 py-4 font-bold text-sm sm:text-base text-gray-900 dark:text-white select-none">
              <span
                aria-hidden="true"
                className="flex-none mt-0.5 w-5 h-5 rounded-full bg-primary-600/10 text-primary-600 dark:text-primary-400 flex items-center justify-center text-lg leading-none transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
              <span className="flex-1">{item.question}</span>
            </summary>
            <div className="px-5 pb-5 pt-0 ps-[3.25rem]">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-8 text-justify whitespace-pre-line">
                {item.answer}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
