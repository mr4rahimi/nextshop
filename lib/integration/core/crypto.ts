import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// کلید 32 بایتی از env — باید در هر deployment تنظیم شود
function getKey(): Buffer {
  const hex = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    // در dev بدون کلید، از یک کلید ثابت استفاده می‌کنیم (ناامن برای production)
    if (process.env.NODE_ENV === "production") {
      throw new Error("INTEGRATION_ENCRYPTION_KEY must be set in production (64-char hex)");
    }
    return Buffer.from("0".repeat(64), "hex");
  }
  return Buffer.from(hex, "hex");
}

const ALGO = "aes-256-gcm";
const IV_LEN = 12;    // GCM standard
const TAG_LEN = 16;

export function encryptCredentials(data: Record<string, string>): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // فرمت: iv(12) + tag(16) + encrypted — همه به hex
  return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

export function decryptCredentials(encrypted: string): Record<string, string> {
  const key = getKey();
  const buf = Buffer.from(encrypted, "hex");

  const iv  = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const json = decipher.update(data) + decipher.final("utf8");
  return JSON.parse(json);
}
