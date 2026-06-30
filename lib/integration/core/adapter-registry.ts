import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";

// Registry از platformCode → Adapter instance
const registry = new Map<string, BaseAdapter>();

export function registerAdapter(adapter: BaseAdapter): void {
  registry.set(adapter.platformCode, adapter);
}

export function getAdapter(platformCode: string): BaseAdapter | undefined {
  return registry.get(platformCode);
}

export function getAllAdapters(): BaseAdapter[] {
  return Array.from(registry.values());
}

// Adapters در اینجا register می‌شوند وقتی پیاده‌سازی شدند
// مثال (بعد از پیاده‌سازی HesabanAdapter):
// import { HesabanAdapter } from "@/lib/integration/adapters/accounting/hesaban.adapter";
// registerAdapter(new HesabanAdapter());
