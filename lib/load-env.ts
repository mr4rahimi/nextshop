/**
 * بارگذاری متغیرهای محیطی برای پروسه‌های خارج از Next.js
 * (اسکریپت‌ها و Worker)
 *
 * ترتیب مثل خود Next است: .env.local اولویت دارد.
 * dotenv متغیرهای موجود را بازنویسی نمی‌کند، پس اولین مقدار برنده است.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });