import { runWorkerCycle } from "./worker";
import { prisma } from "@/lib/prisma";

let started = false;

// در server component یا instrumentation.ts فراخوانی می‌شود
export function startIntegrationWorker(): void {
  if (started || typeof window !== "undefined") return;
  started = true;

  async function tick() {
    try {
      await runWorkerCycle();
    } catch {
      // worker error نباید server را crash کند
    }
  }

  // اولین اجرا بعد از 10 ثانیه (زمان boot)
  setTimeout(async () => {
    await tick();
    const settings = await prisma.integSettings.findUnique({ where: { id: "singleton" } });
    const intervalMs = (settings?.workerIntervalSec ?? 30) * 1000;
    setInterval(tick, intervalMs);
  }, 10_000);
}
