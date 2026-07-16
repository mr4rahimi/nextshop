import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import { HesabanAdapter } from "@/lib/integration/adapters/accounting/hesaban.adapter";
import { BasalamAdapter } from "@/lib/integration/adapters/marketplace/basalam.adapter";
import { TapsiAdapter } from "@/lib/integration/adapters/marketplace/tapsi.adapter";

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

// ── ثبت همه Adapterها ────────────────────────────────────────────────
registerAdapter(new HesabanAdapter());
registerAdapter(new BasalamAdapter());
registerAdapter(new TapsiAdapter());
