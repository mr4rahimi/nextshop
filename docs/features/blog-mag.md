# مجله: ادیتور، سئوی مقاله و نمایش (۲.۷۱.۰)

## ادیتور — `components/blog/BlogEditor.tsx`

ادیتور مشترک مقاله، صفحه‌های ثابت (`PageForm`) و محتوای بازاریابی (`ContentEditorPanel`). Tiptap 3.

- افزونه‌های رسمی: StarterKit (لینک و زیرخط داخلش است)، Table/TableRow، Subscript، Superscript،
  TaskList/TaskItem (`@tiptap/extension-list`)، CharacterCount و Placeholder (`@tiptap/extensions`)،
  TextStyle/Color، Highlight، TextAlign، Youtube (فقط برای خواندن محتوای قدیمی).
- افزونه‌های اختصاصی در `components/blog/editor/extensions.ts`:
  - `Callout` → `<div data-callout="info|tip|warning|danger|note" class="callout">`
  - `VideoEmbed` → `<div data-video-embed class="video-embed"><iframe>`؛ `toEmbedUrl()` لینک یوتیوب
    (به nocookie) و آپارات را تبدیل می‌کند
  - `RichImage` → alt/title + `data-width` (style width) + `data-align`
  - `RichTableCell`/`RichTableHeader` → `data-bg` (رنگ خانه)
- تغییر عرض ستون جدول (`resizable`) خاموش است: prosemirror-tables در RTL درست کار نمی‌کند.
- لینک: پیش‌فرض Tiptap همه‌ی لینک‌ها را `nofollow` و `_blank` می‌کرد؛ حالا هر لینک خودش تعیین می‌کند.
- آپلود تصویر از `/api/admin/upload` (دکمه، Drag & Drop، Paste).

**قاعده:** هر گره‌ی تازه‌ی ادیتور باید در `app/styles/rich-content.css` استایل بگیرد — سایت فقط HTML ذخیره‌شده را رندر می‌کند.

## نمایش HTML — `lib/rich-html.ts`

`enhanceRichHtml(html)` پیش از رندر: شناسه به H2/H3 (و برگرداندن فهرست مطالب)، پیچیدن جدول‌ها در
`.rc-table-wrap` (اسکرول افقی فقط برای جدول)، حذف `nofollow/_blank` از لینک‌های داخلی، lazy برای
تصاویر به‌جز اولی. در `MagPostClient` و `PageView` استفاده می‌شود. بدون DOM است تا سرور و کلاینت یکسان باشند.

## سئوی مقاله

- `lib/blog-seo.ts` → `analyzeSeo()` تحلیل زنده در مرورگر (امتیاز ذخیره نمی‌شود). متن فارسی با
  `normalizeFa` یکدست می‌شود.
- `components/blog/SeoPanel.tsx` تب سئو: کلمه‌ی کلیدی اصلی، عنوان/توضیح با نوار طول، کلمات فرعی،
  canonical، noindex، پیش‌نمایش گوگل (دسکتاپ/موبایل) و اشتراک، چک‌لیست گروه‌بندی‌شده.
- ستون‌های تازه‌ی `BlogPost` (مهاجرت `20261006120000_blog_seo_fields`): `focusKeyword`، `canonicalUrl`، `noIndex`.
  - `noIndex` → متای robots `noindex,follow` و حذف از `app/sitemap.ts`
  - `canonicalUrl` نسبی → `canonicalPath`؛ کامل (http…) → مستقیم در `alternates`
  - PUT فقط وقتی این کلیدها در بدنه باشند می‌نویسدشان (مثل faq)
- اسکیمای Article حالا `articleSection`، `keywords` و `wordCount` دارد.

## صفحه‌های مجله

- پوسته: `app/styles/mag.css` — کلاس `.mag-root` متغیرهای `--mag-*` را برای روز و شب (`.dark`) از
  `--color-primary-*` می‌سازد؛ حالت شب سرمه‌ای از primary-900 است. هر سایتی با رنگ اصلی دیگر خودکار هماهنگ می‌شود.
- `/mag` (`app/mag/page.tsx` + `components/blog/MagHomeClient.tsx`): اسلایدر «داغ‌ترین‌ها» (۵ مطلب پربازدید)،
  نمای شبکه/فهرست (در localStorage)، جستجو، مرتب‌سازی `newest|popular|discussed`، فیلتر دسته و تگ.
  فیلترها در آدرس (`?cat=&tag=&q=&sort=`) و سرور همان‌ها را می‌خواند.
  کوئری مشترک سرور و `/api/mag` در `lib/mag-list.ts` است تا «مطالب بیشتر» تکراری/جاافتاده نیاورد.
- `/mag/[slug]` (`components/blog/MagPostClient.tsx`): سربرگ دوستونه با تصویر، نوار پیشرفت مطالعه،
  فهرست مطالب شماره‌دار H2/H3 با درصد پیشرفت (موبایل: بازشونده)، `.rich-content.article-body`،
  محصولات معرفی‌شده (قیمت صفر → «استعلام قیمت»)، نظرات، مطالب پیشنهادی (۴ تا) و دکمه‌ی برگشت به بالا.
- اجزای مشترک کارت‌ها: `components/blog/mag-ui.tsx` (`PostCardH` کارت افقی با تصویر بیرون‌زده).

## راهنما

موضوع `blogPost` در `components/admin/worklist/help-content.ts`، دکمه کنار عنوان فرم مقاله.
