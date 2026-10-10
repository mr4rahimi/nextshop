"use client";

/** ورود سریع کالا — ماتریس رنگ و سایز، یا چند کالا با هم (docs/plans/inventory-items.md بخش ۴) */

import { useState } from "react";
import InventoryTabs from "./InventoryTabs";
import MatrixBuilder from "./MatrixBuilder";
import BulkItemsGrid from "./BulkItemsGrid";
import { PageHeader, Segmented } from "../ui";

export default function QuickEntryClient() {
  const [mode, setMode] = useState<"matrix" | "bulk">("matrix");
  return (
    <div className="space-y-4">
      <PageHeader title="کالا و انبار" help="accountingQuickItems" desc="چند کالا را یک‌جا بسازید — بی‌آنکه محصولی در سایت ساخته شود." />
      <InventoryTabs />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "matrix", label: "یک مدل در چند رنگ و سایز" },
          { value: "bulk", label: "چند کالا با هم / از اکسل" },
        ]}
      />
      {mode === "matrix" ? <MatrixBuilder /> : <BulkItemsGrid />}
    </div>
  );
}
