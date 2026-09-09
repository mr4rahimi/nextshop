export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startIntegrationWorker } = await import(
      "@/lib/integration/core/bootstrap"
    );
    startIntegrationWorker();

    // زمان‌بند کارتابل — جدا از worker یکپارچه‌سازی و با گیت خودش
    // (`StoreSettings.worklistEnabled`). مستندات: docs/features/staff-worklist.md
    const { startWorklistScheduler } = await import("@/lib/worklist/scheduler");
    startWorklistScheduler();
  }
}
