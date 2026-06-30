export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startIntegrationWorker } = await import(
      "@/lib/integration/core/bootstrap"
    );
    startIntegrationWorker();
  }
}
