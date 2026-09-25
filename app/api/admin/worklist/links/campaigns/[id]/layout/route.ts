import { saveLayout } from "@/lib/marketing/link-service";
import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ذخیره‌ی مختصات گره‌ها و صفحه‌های هدف — **تنها نوشتنیِ بوم**. اگر بوم به
 * اندپوینت دیگری نیاز پیدا کرد، یعنی لایه‌ی سرور ناقص بسته شده.
 */
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", async (access) => {
    const body = await readJson(req);
    const placements = Array.isArray(body.placements) ? body.placements : [];
    return { saved: await saveLayout(id, placements, access) };
  });
}
