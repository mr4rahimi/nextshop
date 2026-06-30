import { NextResponse } from "next/server";
import { runWorkerCycle } from "@/lib/integration/core/worker";

export const dynamic = "force-dynamic";

// این endpoint توسط یک setInterval یا cron خارجی فراخوانی می‌شود
// محافظت ساده با secret header
export async function POST(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  if (secret !== (process.env.INTEGRATION_WORKER_SECRET ?? "dev-worker")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runWorkerCycle();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Worker error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
