import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const OUT = "./release-keys";
if (existsSync(`${OUT}/private.pem`)) {
  console.error("❌ کلید از قبل وجود دارد. اگر واقعاً می‌خواهی بازتولید کنی، اول دستی حذفش کن.");
  console.error("   توجه: با تغییر کلید، همه سایت‌های موجود دیگر بسته‌ها را نمی‌پذیرند.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync("ed25519");

writeFileSync(`${OUT}/private.pem`, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
writeFileSync(`${OUT}/public.pem`, publicKey.export({ type: "spki", format: "pem" }));

console.log("✅ کلیدها ساخته شد در ./release-keys");
console.log("\n⚠️  private.pem را هرگز کامیت نکن و از آن بکاپ آفلاین بگیر.");
console.log("   اگر گم شود، دیگر نمی‌توانی بسته جدید امضا کنی و باید همه سایت‌ها را دستی بروز کنی.");
console.log("\nمحتوای public.pem را در lib/release-key.ts قرار بده:\n");
console.log(publicKey.export({ type: "spki", format: "pem" }));