import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import { HesabanAdapter } from "@/lib/integration/adapters/accounting/hesaban.adapter";
import { BasalamAdapter } from "@/lib/integration/adapters/marketplace/basalam.adapter";
import { TapsiAdapter } from "@/lib/integration/adapters/marketplace/tapsi.adapter";
import { SnappShopAdapter } from "@/lib/integration/adapters/marketplace/snappshop.adapter";
import { isDemo } from "@/lib/demo";
import { DEMO_MARKETPLACES, DemoChatMarketplaceAdapter, DemoMarketplaceAdapter } from "@/lib/demo/marketplace";

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
registerAdapter(new SnappShopAdapter());

// دمو (docs/plans/demo.md): بازارگاه‌ها شبیه‌سازی می‌شوند و هیچ درخواستی بیرون نمی‌رود
if (isDemo()) {
  for (const m of DEMO_MARKETPLACES) {
    registerAdapter(m.chat ? new DemoChatMarketplaceAdapter(m.code, m.name) : new DemoMarketplaceAdapter(m.code, m.name));
  }
}
