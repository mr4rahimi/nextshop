/**
 * بارکد Code 128 (زیرمجموعه‌ی B برای متن، C برای عدد زوج‌رقمی) — بی‌وابستگی، برای
 * چاپ برچسب کالا (docs/plans/inventory-items.md بخش ۴). خروجی: پهنای میله و فاصله
 * به واحد «ماژول»، از میله‌ی اول.
 */

// الگوی هر مقدار ۰ تا ۱۰۶: پهنای میله/فاصله/میله/… (جمع ۱۱؛ توقف ۱۳)
const PATTERNS = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
  "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
  "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
  "114131 311141 411131 211412 211214 211232 2331112"
).split(" ");

const START_B = 104;
const START_C = 105;
const STOP = 106;

/** متن قابل بارکد؟ — فقط ASCII چاپی */
export const canEncode = (text: string) => !!text && /^[\x20-\x7e]+$/.test(text);

export function code128Values(text: string): number[] {
  if (!canEncode(text)) throw new Error("فقط حروف و ارقام لاتین در بارکد می‌آیند");
  const values: number[] = [];
  if (/^\d+$/.test(text) && text.length % 2 === 0 && text.length >= 4) {
    values.push(START_C);
    for (let i = 0; i < text.length; i += 2) values.push(Number(text.slice(i, i + 2)));
  } else {
    values.push(START_B);
    for (const ch of text) values.push(ch.charCodeAt(0) - 32);
  }
  const check = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  return [...values, check, STOP];
}

/** پهنای پشت‌سرهم میله و فاصله (میله‌ی اول) */
export function code128Widths(text: string): number[] {
  return code128Values(text).flatMap((v) => PATTERNS[v].split("").map(Number));
}

/** مستطیل‌های میله‌ها برای SVG — x و w به ماژول، با حاشیه‌ی سکوت */
export function code128Bars(text: string, quiet = 10): { bars: { x: number; w: number }[]; width: number } {
  const widths = code128Widths(text);
  const bars: { x: number; w: number }[] = [];
  let x = quiet;
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return { bars, width: x + quiet };
}
