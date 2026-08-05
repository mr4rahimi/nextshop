/**
 * کلید عمومی تأیید امضای بسته‌های بروزرسانی.
 * کلید خصوصی متناظر فقط روی سیستم توسعه‌دهنده است.
 */
export const RELEASE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA9tP7ByNglp6z8cj5iV4FmrMYyBjBM+lWQpf1Cpwsdys=
-----END PUBLIC KEY-----`;

/** آدرس رجیستری نسخه‌ها */
export const RELEASE_REGISTRY_URL =
  process.env.RELEASE_REGISTRY_URL ?? "https://updates.9dm.ir";

/** نسخه فعلی — هنگام ساخت بسته به‌روز می‌شود */
export const APP_VERSION = "2.11.0";