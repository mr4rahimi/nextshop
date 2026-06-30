import { SITE_URL } from "@/lib/seo";

const TOROB_WEBHOOK_URL = "https://api.torob.com/update/webhook/v1/";

/**
 * Notify Torob of product changes so it re-crawls faster.
 * Requires TOROB_WEBHOOK_TOKEN in env. Safe to call without token — no-ops silently.
 * Max 100 slugs per call, max 20 calls/min.
 */
export async function notifyTorob(slugs: string[]): Promise<void> {
  const token = process.env.TOROB_WEBHOOK_TOKEN;
  if (!token || slugs.length === 0) return;

  const items = slugs.slice(0, 100).map((slug) => ({
    page_url: `${SITE_URL}/products/${slug}`,
    page_unique: slug,
  }));

  try {
    await fetch(TOROB_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    });
  } catch {
    // Fire-and-forget — webhook failure should never break product save
  }
}
