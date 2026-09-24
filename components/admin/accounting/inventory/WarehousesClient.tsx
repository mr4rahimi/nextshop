"use client";

/** تعریف انبارها — قابل فروش بودن یعنی موجودی‌اش در سایت دیده می‌شود */

import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, PageHeader, Sheet } from "../ui";

interface W {
  id: string;
  code: number;
  name: string;
  address: string | null;
  sellable: boolean;
  isDefault: boolean;
  isActive: boolean;
  products: number;
  qty: number;
}

export default function WarehousesClient() {
  const [data, setData] = useState<{ items: W[]; can: { manage: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ item: W | null } | null>(null);

  const load = useCallback(() => {
    api<{ items: W[]; can: { manage: boolean } }>("/api/admin/accounting/inventory/warehouses")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="کالا و انبار"
        help="accountingWarehouses"
        actions={
          data?.can.manage && (
            <button onClick={() => setForm({ item: null })} className={btn.primary}>
              ➕ انبار تازه
            </button>
          )
        }
      />
      <InventoryTabs />
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.items.map((w) => (
          <Card key={w.id} className={`p-4 ${!w.isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-black">🏬 {w.name}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <Badge>کد {faNum(w.code)}</Badge>
                  {w.isDefault && <Badge tone="blue">پیش‌فرض</Badge>}
                  {w.sellable ? <Badge tone="green">موجودی در سایت</Badge> : <Badge tone="amber">فقط انبار — در سایت نه</Badge>}
                  {!w.isActive && <Badge tone="red">غیرفعال</Badge>}
                </div>
              </div>
              {data.can.manage && (
                <button onClick={() => setForm({ item: w })} className={btn.small}>
                  ✏️
                </button>
              )}
            </div>
            {w.address && <p className="text-xs text-gray-500 mt-2">{w.address}</p>}
            <p className="text-xs text-gray-500 mt-3">
              {faNum(w.products)} کالا · {faNum(w.qty)} عدد
            </p>
          </Card>
        ))}
      </div>
      {form && (
        <WarehouseForm
          item={form.item}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function WarehouseForm({ item, onClose, onSaved }: { item: W | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: item?.name ?? "", address: item?.address ?? "", sellable: item?.sellable ?? true, isDefault: item?.isDefault ?? false, isActive: item?.isActive ?? true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (item) await api(`/api/admin/accounting/inventory/warehouses/${item.id}`, { method: "PATCH", json: f });
      else await api("/api/admin/accounting/inventory/warehouses", { method: "POST", json: f });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={item ? `ویرایش ${item.name}` : "انبار تازه"}
      help="accountingWarehouses"
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "…" : "ذخیره"}
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="نام انبار">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} autoFocus placeholder="مثلاً: انبار مغازه، انبار مرکزی" />
        </Field>
        <Field label="آدرس (اختیاری)">
          <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={inputCls} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.sellable} onChange={(e) => setF({ ...f, sellable: e.target.checked })} />
          <span>
            موجودی این انبار در سایت قابل فروش است
            <span className="block text-[11px] text-gray-400">برای انبار ضایعات، امانی یا رزرو خاموش کنید. فقط برای انبار خالی عوض می‌شود.</span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} />
          انبار پیش‌فرض (فروش و خرید خودکار از/به این انبار)
        </label>
        {item && !item.isDefault && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!f.isActive} onChange={(e) => setF({ ...f, isActive: !e.target.checked })} />
            غیرفعال (فقط وقتی خالی است)
          </label>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
