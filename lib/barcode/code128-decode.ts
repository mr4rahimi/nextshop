/**
 * خواندن Code 128 از تصویر دوربین — بی‌وابستگی، جای‌گزین BarcodeDetector مرورگر وقتی
 * روی گوشی نیست یا code_128 را نمی‌شناسد (docs/plans/inventory-items.md بخش ۱۵.۱).
 *
 * روش: چند خط افقی (و عمودی) از وسط تصویر برداشته می‌شود، با آستانه‌ی محلی سیاه/سفید
 * می‌شود، پهنای پشت‌سرهم میله‌ها و فاصله‌ها اندازه گرفته و با الگوی ۶تایی هر نماد مقایسه
 * می‌شود. رقم کنترل باید درست باشد، پس خوانش اشتباه تقریباً ناممکن است.
 */

const PATTERNS = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
  "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
  "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
  "114131 311141 411131 211412 211214 211232 233111"
)
  .split(" ")
  .map((p) => p.split("").map(Number));

const STOP = 106;

/**
 * نزدیک‌ترین نماد به ۶ پهنا؛ null اگر هیچ‌کدام نزدیک نیست. فاصله‌ی «لبه تا لبه»
 * (میله+فاصله‌ی کنارش) پخش جوهر و تاری را خنثی می‌کند؛ پهنای تک‌تک فقط برای تمایز.
 */
function matchSymbol(runs: number[], at: number): number | null {
  let sum = 0;
  for (let k = 0; k < 6; k++) sum += runs[at + k];
  if (!sum) return null;
  const unit = sum / 11;
  const e = [0, 1, 2, 3].map((k) => (runs[at + k] + runs[at + k + 1]) / unit);
  let best = -1;
  let bestD = Infinity;
  for (let v = 0; v < PATTERNS.length; v++) {
    const p = PATTERNS[v];
    let d = 0;
    for (let k = 0; k < 4; k++) d += Math.abs(e[k] - p[k] - p[k + 1]);
    let r = 0;
    for (let k = 0; k < 6; k++) r += Math.abs(runs[at + k] / unit - p[k]);
    d += r * 0.3;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return bestD <= 2.2 ? best : null;
}

/** مقدارها (بی شروع/کنترل/توقف) ← متن، با مجموعه‌های A، B، C */
function valuesToText(start: number, vals: number[]): string | null {
  let set = start === 103 ? "A" : start === 104 ? "B" : "C";
  let out = "";
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (set === "C") {
      if (v < 100) out += String(v).padStart(2, "0");
      else if (v === 100) set = "B";
      else if (v === 101) set = "A";
      else if (v === 102) continue; // FNC1
      else return null;
      continue;
    }
    if (v === 99) set = "C";
    else if (v === 100 && set === "A") set = "B";
    else if (v === 101 && set === "B") set = "A";
    else if (v === 98) {
      // shift: فقط نماد بعدی در مجموعه‌ی دیگر
      const n = vals[++i];
      if (n === undefined) return null;
      out += set === "A" ? String.fromCharCode(n + 32) : n < 64 ? String.fromCharCode(n + 32) : String.fromCharCode(n - 64);
    } else if (v >= 96) continue; // FNC
    else if (set === "B") out += String.fromCharCode(v + 32);
    else out += v < 64 ? String.fromCharCode(v + 32) : String.fromCharCode(v - 64);
  }
  return out || null;
}

/** از پهنای پشت‌سرهم (اولی میله‌ی سیاه) */
export function decodeRuns(runs: number[]): string | null {
  for (let i = 0; i + 6 <= runs.length; i += 2) {
    const start = matchSymbol(runs, i);
    if (start === null || start < 103 || start > 105) continue;
    // حاشیه‌ی سفید پیش از شروع (دست‌کم ~۳ ماژول؛ لبه‌ی تصویر هم قبول)
    let s6 = 0;
    for (let k = 0; k < 6; k++) s6 += runs[i + k];
    if (i > 0 && runs[i - 1] < (s6 / 11) * 3) continue;
    const vals: number[] = [start];
    let j = i + 6;
    let ok = false;
    while (j + 6 <= runs.length) {
      const v = matchSymbol(runs, j);
      if (v === null) break;
      if (v === STOP) {
        // میله‌ی آخر توقف (۲ ماژول) و حاشیه‌ی سفید بعدش — جلوی خوانش اتفاقی از بافت پارچه
        let s = 0;
        for (let k = 0; k < 6; k++) s += runs[j + k];
        const u = s / 11;
        const bar = runs[j + 6];
        const quiet = runs[j + 7];
        ok = bar !== undefined && bar > u * 1.2 && bar < u * 3 && (quiet === undefined || quiet > u * 3);
        break;
      }
      if (v >= 103) break;
      vals.push(v);
      j += 6;
    }
    if (!ok || vals.length < 3) continue;
    const check = vals[vals.length - 1];
    const body = vals.slice(0, -1);
    const sum = body.reduce((a, v, k) => a + v * (k === 0 ? 1 : k), 0) % 103;
    if (sum !== check) continue;
    const text = valuesToText(start, body.slice(1))?.trim();
    if (text) return text;
  }
  return null;
}

/**
 * یک خط روشنایی (۰ تا ۲۵۵) ← پهنای پشت‌سرهم از اولین میله‌ی سیاه. آستانه‌ی محلی (وسط
 * کمینه و بیشینه‌ی پنجره) و جای لبه با درون‌یابی زیرپیکسلی — برچسب کوچک در تصویر هم خوانده شود.
 */
export function lineRuns(line: ArrayLike<number>): number[] {
  const n = line.length;
  const w = Math.max(8, Math.round(n / 12));
  // کمینه/بیشینه‌ی بلوک‌ها، بعد پنجره‌ی ۵ بلوکی دور هر پیکسل — خطی، نه n×پنجره
  const B = Math.max(4, Math.round(w / 2));
  const nb = Math.ceil(n / B);
  const bLo = new Uint8Array(nb).fill(255);
  const bHi = new Uint8Array(nb);
  for (let x = 0; x < n; x++) {
    const k = (x / B) | 0;
    const v = line[x];
    if (v < bLo[k]) bLo[k] = v;
    if (v > bHi[k]) bHi[k] = v;
  }
  const bTh = new Float32Array(nb);
  for (let k = 0; k < nb; k++) {
    let lo = 255;
    let hi = 0;
    for (let j = Math.max(0, k - 2); j <= Math.min(nb - 1, k + 2); j++) {
      if (bLo[j] < lo) lo = bLo[j];
      if (bHi[j] > hi) hi = bHi[j];
    }
    bTh[k] = hi - lo > 40 ? (hi + lo) / 2 : -1; // -1: کنتراست کم، سفید
  }
  const th = new Float32Array(n);
  for (let x = 0; x < n; x++) th[x] = bTh[(x / B) | 0];
  const edges: number[] = [];
  let dark = false;
  for (let x = 0; x < n; x++) {
    const d = th[x] >= 0 && line[x] < th[x];
    if (d === dark) continue;
    let pos = x;
    if (x > 0 && th[x] >= 0) {
      const v0 = line[x - 1];
      const v1 = line[x];
      if (v0 !== v1) pos = x - 1 + Math.min(1, Math.max(0, (th[x] - v0) / (v1 - v0))) + 0.5;
    }
    edges.push(pos);
    dark = d;
  }
  const runs: number[] = [];
  for (let i = 1; i < edges.length; i++) runs.push(edges[i] - edges[i - 1]);
  return runs;
}

/** یک خط ← متن بارکد (هر دو جهت) */
export function decodeLine(line: ArrayLike<number>): string | null {
  const runs = lineRuns(line);
  if (runs.length < 25) return null;
  const fwd = decodeRuns(runs);
  if (fwd) return fwd;
  // وارونه: اگر طول زوج است آخرین پهنا سفید است، کنار گذاشته می‌شود
  const rev = runs.slice(0, runs.length % 2 === 0 ? -1 : undefined).reverse();
  return decodeRuns(rev);
}

/**
 * تصویر RGBA ← متن بارکد. خطوط افقی وسط تصویر و (اگر نیافت) خطوط عمودی.
 */
export function decodeImage(data: Uint8ClampedArray, width: number, height: number): string | null {
  const gray = (i: number) => (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  const row = new Uint8Array(width);
  for (let f = 0.2; f <= 0.8; f += 0.04) {
    const y = Math.round(height * f);
    for (let x = 0; x < width; x++) row[x] = gray((y * width + x) * 4);
    const t = decodeLine(row);
    if (t) return t;
  }
  const col = new Uint8Array(height);
  for (let f = 0.2; f <= 0.8; f += 0.06) {
    const x = Math.round(width * f);
    for (let y = 0; y < height; y++) col[y] = gray((y * width + x) * 4);
    const t = decodeLine(col);
    if (t) return t;
  }
  return null;
}
