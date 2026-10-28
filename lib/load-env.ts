/**
 * بارگذاری متغیرهای محیطی برای پروسه‌های خارج از Next.js
 * (اسکریپت‌ها و Worker)
 *
 * ترتیب مثل خود Next است: .env.local اولویت دارد.
 * dotenv متغیرهای موجود را بازنویسی نمی‌کند، پس اولین مقدار برنده است.
 */
import { config } from "dotenv";

// quiet: پیام dotenv به stdout می‌رود و خروجی اسکریپت‌هایی مثل CSV را خراب می‌کند
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });