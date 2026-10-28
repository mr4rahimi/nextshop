/**
 * تصویرهای فروشگاه نمایشی (لوازم جانبی موبایل) — docs/plans/demo.md مرحله‌ی ۳.
 *
 *   node scripts/demo/make-assets.mjs
 *
 * فقط روی سیستم توسعه اجرا می‌شود (sharp روی سرور production بالا نمی‌آید) و
 * خروجی WebP در `scripts/demo/assets/` کامیت می‌شود؛ سید فقط کپی‌شان می‌کند.
 * همه‌ی تصویرها طراحی ساده‌ی برداری‌اند — هیچ عکس یا نشان تجاری واقعی نیست.
 * متن فارسی بنرها با فونت سیستم (Noto Sans Arabic) رندر می‌شود.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "assets");
mkdirSync(OUT, { recursive: true });

export const COLORS = {
  black: "#1f2937",
  white: "#e5e7eb",
  blue: "#2563eb",
  pink: "#f472b6",
  green: "#16a34a",
  red: "#dc2626",
  purple: "#7c3aed",
  gray: "#9ca3af",
};

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const frame = (body, bg = "#f1f5f9") => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${bg}"/></radialGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-opacity=".18"/></filter>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <ellipse cx="400" cy="690" rx="230" ry="26" fill="#000" opacity=".06"/>
  <g filter="url(#sh)">${body}</g>
</svg>`;

const DRAW = {
  case: (c) => `
    <rect x="250" y="110" width="300" height="580" rx="56" fill="${c}"/>
    <rect x="262" y="122" width="276" height="556" rx="46" fill="${shade(c, 1.08)}" opacity=".35"/>
    <rect x="290" y="150" width="130" height="130" rx="32" fill="${shade(c, 0.75)}"/>
    <circle cx="325" cy="185" r="24" fill="#111827"/><circle cx="385" cy="185" r="24" fill="#111827"/><circle cx="325" cy="245" r="24" fill="#111827"/>
    <circle cx="325" cy="185" r="10" fill="#334155"/><circle cx="385" cy="185" r="10" fill="#334155"/><circle cx="325" cy="245" r="10" fill="#334155"/>`,
  glass: () => `
    <rect x="250" y="110" width="300" height="580" rx="56" fill="#0f172a"/>
    <rect x="266" y="126" width="268" height="548" rx="44" fill="#1e3a8a"/>
    <path d="M266 420 L534 200 L534 290 L266 510 Z" fill="#fff" opacity=".18"/>
    <rect x="230" y="90" width="300" height="580" rx="56" fill="#e0f2fe" opacity=".35" stroke="#7dd3fc" stroke-width="4"/>`,
  charger: (c) => `
    <rect x="300" y="250" width="200" height="260" rx="40" fill="${c}"/>
    <rect x="300" y="250" width="200" height="60" rx="30" fill="${shade(c, 1.1)}" opacity=".5"/>
    <rect x="345" y="170" width="26" height="90" rx="8" fill="#9ca3af"/><rect x="429" y="170" width="26" height="90" rx="8" fill="#9ca3af"/>
    <rect x="370" y="440" width="60" height="26" rx="8" fill="#111827"/>
    <path d="M400 330 l-22 45 h20 l-12 40 l38-55 h-22 l14-30 z" fill="${c === COLORS.white ? "#2563eb" : "#fbbf24"}"/>`,
  cable: (c) => `
    <path d="M250 520 C 250 260, 560 260, 550 420 C 540 560, 330 560, 340 400 C 350 300, 470 300, 470 380" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round"/>
    <rect x="225" y="510" width="50" height="120" rx="14" fill="${shade(c, 0.85)}"/><rect x="235" y="620" width="30" height="40" rx="8" fill="#9ca3af"/>
    <rect x="445" y="320" width="50" height="110" rx="14" fill="${shade(c, 0.85)}" transform="rotate(180 470 375)"/><rect x="458" y="270" width="24" height="36" rx="8" fill="#9ca3af"/>`,
  powerbank: (c) => `
    <rect x="260" y="160" width="280" height="480" rx="44" fill="${c}"/>
    <rect x="276" y="176" width="248" height="448" rx="34" fill="${shade(c, 1.12)}" opacity=".3"/>
    <circle cx="350" cy="560" r="10" fill="#22c55e"/><circle cx="385" cy="560" r="10" fill="#22c55e"/><circle cx="420" cy="560" r="10" fill="#22c55e"/><circle cx="455" cy="560" r="10" fill="#334155"/>
    <rect x="360" y="148" width="80" height="20" rx="6" fill="#111827"/>`,
  earbuds: (c) => `
    <rect x="240" y="300" width="320" height="260" rx="120" fill="${c}"/>
    <rect x="240" y="300" width="320" height="110" rx="60" fill="${shade(c, 0.9)}"/>
    <line x1="250" y1="410" x2="550" y2="410" stroke="${shade(c, 0.7)}" stroke-width="5"/>
    <circle cx="400" cy="470" r="8" fill="#22c55e"/>
    <g transform="translate(250 150) rotate(-20)"><ellipse cx="60" cy="60" rx="50" ry="56" fill="${shade(c, 1.05)}"/><rect x="40" y="90" width="40" height="110" rx="20" fill="${shade(c, 1.05)}"/></g>
    <g transform="translate(470 120) rotate(20)"><ellipse cx="60" cy="60" rx="50" ry="56" fill="${shade(c, 1.05)}"/><rect x="40" y="90" width="40" height="110" rx="20" fill="${shade(c, 1.05)}"/></g>`,
  headphone: (c) => `
    <path d="M230 470 C 230 200, 570 200, 570 470" fill="none" stroke="${c}" stroke-width="40" stroke-linecap="round"/>
    <rect x="190" y="420" width="110" height="190" rx="48" fill="${c}"/><rect x="500" y="420" width="110" height="190" rx="48" fill="${c}"/>
    <rect x="215" y="445" width="60" height="140" rx="30" fill="${shade(c, 0.75)}"/><rect x="525" y="445" width="60" height="140" rx="30" fill="${shade(c, 0.75)}"/>`,
  holder: (c) => `
    <rect x="370" y="430" width="60" height="200" rx="20" fill="#374151"/>
    <circle cx="400" cy="640" r="70" fill="#1f2937"/>
    <rect x="260" y="200" width="280" height="250" rx="34" fill="${c}"/>
    <rect x="240" y="260" width="40" height="130" rx="16" fill="${shade(c, 0.7)}"/><rect x="520" y="260" width="40" height="130" rx="16" fill="${shade(c, 0.7)}"/>
    <rect x="300" y="240" width="200" height="170" rx="24" fill="#0f172a" opacity=".85"/>`,
  speaker: (c) => `
    <rect x="270" y="170" width="260" height="460" rx="110" fill="${c}"/>
    <rect x="290" y="250" width="220" height="300" rx="90" fill="${shade(c, 0.8)}"/>
    ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, k) => `<circle cx="${330 + k * 35}" cy="${300 + r * 40}" r="7" fill="${shade(c, 0.6)}"/>`).join("")).join("")}
    <circle cx="400" cy="205" r="12" fill="${shade(c, 1.2)}"/>`,
  watchband: (c) => `
    <rect x="335" y="80" width="130" height="640" rx="56" fill="${c}"/>
    ${Array.from({ length: 7 }, (_, i) => `<circle cx="400" cy="${470 + i * 32}" r="8" fill="${shade(c, 0.65)}"/>`).join("")}
    <rect x="290" y="290" width="220" height="250" rx="60" fill="#111827"/>
    <rect x="308" y="308" width="184" height="214" rx="46" fill="#1e293b"/>
    <text x="400" y="430" font-family="Noto Sans, sans-serif" font-size="56" font-weight="700" fill="#e2e8f0" text-anchor="middle">10:09</text>`,
  memory: (c) => `
    <path d="M280 170 h200 l60 60 v380 a30 30 0 0 1 -30 30 h-230 a30 30 0 0 1 -30 -30 v-410 a30 30 0 0 1 30 -30z" fill="${c}"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${300 + i * 34}" y="190" width="20" height="70" rx="4" fill="#fbbf24"/>`).join("")}
    <rect x="290" y="420" width="220" height="120" rx="16" fill="#fff" opacity=".9"/>
    <text x="400" y="500" font-family="Noto Sans, sans-serif" font-size="64" font-weight="800" fill="${c}" text-anchor="middle">128GB</text>`,
};

/** کالاها و رنگ‌هایی که سید لازم دارد — نام فایل: `<نوع>-<رنگ>.webp` */
export const PRODUCT_IMAGES = {
  case: ["black", "blue", "pink", "green", "purple", "red"],
  glass: ["clear"],
  charger: ["white", "black"],
  cable: ["white", "black", "red"],
  powerbank: ["black", "white", "blue"],
  earbuds: ["white", "black", "blue"],
  headphone: ["black", "white", "red"],
  holder: ["black", "gray"],
  speaker: ["black", "blue", "red", "green"],
  watchband: ["black", "pink", "blue", "green", "gray"],
  memory: ["blue", "red", "black"],
};

const banner = (w, h, from, to, title, sub, art) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.2}" cy="${h * 0.5}" r="${h * 0.55}" fill="#fff" opacity=".08"/>
  <circle cx="${w * 0.12}" cy="${h * 0.1}" r="${h * 0.25}" fill="#fff" opacity=".06"/>
  <g transform="translate(${w * 0.06} ${h * 0.08}) scale(${(h * 0.84) / 800})">${art}</g>
  <text x="${w * 0.92}" y="${h * 0.45}" font-family="Noto Sans Arabic" font-size="${h * 0.15}" font-weight="700" fill="#fff" text-anchor="start" direction="rtl">${title}</text>
  <text x="${w * 0.92}" y="${h * 0.64}" font-family="Noto Sans Arabic" font-size="${h * 0.07}" fill="#fff" opacity=".9" text-anchor="start" direction="rtl">${sub}</text>
</svg>`;

async function save(name, svg) {
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(path.join(OUT, name));
}

for (const [kind, colors] of Object.entries(PRODUCT_IMAGES)) {
  for (const color of colors) {
    await save(`${kind}-${color}.webp`, frame(DRAW[kind](COLORS[color] ?? COLORS.black)));
  }
}

// دسته‌ها — تصویر مربعی کوچک
for (const [kind, color] of Object.entries({ case: "blue", glass: "clear", charger: "white", cable: "red", powerbank: "black", earbuds: "white", headphone: "black", holder: "gray", speaker: "green", watchband: "pink", memory: "blue" })) {
  await sharp(Buffer.from(frame(DRAW[kind](COLORS[color] ?? COLORS.black), "#e0e7ff"))).resize(300, 300).webp({ quality: 80 }).toFile(path.join(OUT, `cat-${kind}.webp`));
}

await save("hero-1.webp", banner(1600, 560, "#4f46e5", "#0ea5e9", "قاب و گلس اصل", "برای همه‌ی مدل‌های آیفون و سامسونگ", DRAW.case(COLORS.pink)));
await save("hero-2.webp", banner(1600, 560, "#059669", "#84cc16", "شارژ سریع، همه‌جا", "پاوربانک و شارژر با گارانتی", DRAW.powerbank(COLORS.black)));
await save("hero-3.webp", banner(1600, 560, "#db2777", "#f97316", "صدای بی‌سیم", "هندزفری و اسپیکر بلوتوثی", DRAW.earbuds(COLORS.white)));
await save("banner-wide.webp", banner(1600, 400, "#0f172a", "#334155", "ارسال رایگان بالای ۵۰۰ هزار تومان", "تحویل یک‌روزه در تهران", DRAW.holder(COLORS.gray)));
await save("logo.webp", `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="56" fill="#4f46e5"/><rect x="78" y="40" width="100" height="176" rx="22" fill="#fff"/><rect x="92" y="58" width="72" height="124" rx="10" fill="#c7d2fe"/><circle cx="128" cy="198" r="8" fill="#4f46e5"/></svg>`);

console.log("✅ تصویرها در", OUT);
