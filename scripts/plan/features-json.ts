/**
 * فهرست امکانات فروختنی برای پنل گردانوس — docs/plans/licensing.md
 *
 *   npx tsx scripts/plan/features-json.ts > ../gardanos-panel/src/data/features.json
 *
 * پنل گردانوس بسته‌ها را از همین کلیدها می‌سازد؛ کلید تازه در lib/plan/features.ts
 * یعنی اجرای دوباره‌ی همین دستور.
 */
import { FEATURES } from "../../lib/plan/features";

console.log(JSON.stringify(FEATURES.map(({ key, label, description }) => ({ key, label, description })), null, 2));
