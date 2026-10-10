"use client";

/** گروه‌های کالا — درختی (docs/plans/inventory-items.md فاز ۲) */

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { faNum } from "@/lib/accounting/money";
import InventoryTabs from "./InventoryTabs";
import { api, btn, Card, Empty, ErrorText, Field, inputCls, PageHeader, Sheet } from "../ui";

interface G {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  items: number;
}

export default function ItemGroupsClient() {
  const [data, setData] = useState<{ items: G[]; can: { manage: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ item: G | null; parentId?: string } | null>(null);
  const load = useCallback(() => {
    api<{ items: G[]; can: { manage: boolean } }>("/api/admin/accounting/items/groups")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function remove(g: G) {
    if (!confirm(`گروه «${g.name}» حذف شود؟`)) return;
    try {
      await api(`/api/admin/accounting/items/groups/${g.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف نشد");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="کالا و انبار"
        help="accountingItemGroups"
        actions={
          data?.can.manage && (
            <button onClick={() => setForm({ item: null })} className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden />
              گروه تازه
            </button>
          )
        }
      />
      <InventoryTabs />
      <ErrorText>{error}</ErrorText>
      <Card className="divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((g) => (
          <div key={g.id} className="flex items-center gap-2 px-4 py-3">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold truncate">{g.path}</span>
              <span className="text-[11px] text-gray-400">{faNum(g.items)} کالا</span>
            </span>
            {data.can.manage && (
              <>
                <button onClick={() => setForm({ item: null, parentId: g.id })} className={btn.small}>
                  + زیرگروه
                </button>
                <button onClick={() => setForm({ item: g })} className={btn.small}>
                  ✏️
                </button>
                {!g.items && (
                  <button onClick={() => remove(g)} className={btn.small}>
                    🗑
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        {data && !data.items.length && <Empty title="هنوز گروهی نیست" desc="مثلاً «پوشاک» و زیرش «پیراهن» و «شلوار». گروه در فهرست کالا و گزارش‌ها کمک می‌کند." />}
      </Card>
      {form && data && (
        <GroupForm
          item={form.item}
          parentId={form.parentId}
          groups={data.items}
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

function GroupForm({ item, parentId, groups, onClose, onSaved }: { item: G | null; parentId?: string; groups: G[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [parent, setParent] = useState(item?.parentId ?? parentId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const json = { name, parentId: parent || null };
      if (item) await api(`/api/admin/accounting/items/groups/${item.id}`, { method: "PATCH", json });
      else await api("/api/admin/accounting/items/groups", { method: "POST", json });
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
      title={item ? `ویرایش ${item.name}` : "گروه تازه"}
      help="accountingItemGroups"
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "…" : "ذخیره"}
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="نام گروه">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus placeholder="مثلاً: پیراهن" />
        </Field>
        <Field label="زیرمجموعه‌ی">
          <select value={parent} onChange={(e) => setParent(e.target.value)} className={inputCls}>
            <option value="">— گروه اصلی —</option>
            {groups
              .filter((g) => g.id !== item?.id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.path}
                </option>
              ))}
          </select>
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
