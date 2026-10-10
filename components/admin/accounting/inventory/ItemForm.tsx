"use client";

/**
 * فرم کالای حسابداری — docs/plans/inventory-items.md فاز ۱.
 * کد خالی = خودکار؛ کد عوض‌شده در «کدهای قبلی» می‌ماند و جستجو با آن هم کار می‌کند.
 */

import { useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import { api, Badge, btn, ErrorText, Field, inputCls, Sheet } from "../ui";

interface ItemData {
  item: {
    id: string;
    code: string;
    title: string;
    unit: string;
    salePrice: string | null;
    reorderPoint: number | null;
    sellOnline: boolean;
    isActive: boolean;
    barcodes: { barcode: string }[];
    aliases: { id: string; code: string; source: string }[];
  };
  product: { id: string; title: string; slug: string } | null;
}

export default function ItemForm({ itemId, onClose, onSaved }: { itemId: string | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [data, setData] = useState<ItemData | null>(null);
  const [auto, setAuto] = useState("");
  const [f, setF] = useState({ code: "", title: "", unit: "عدد", salePrice: "", reorderPoint: "", barcodes: "", sellOnline: true, isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      api<{ code: string }>("/api/admin/accounting/items").then((d) => setAuto(d.code)).catch(() => {});
      return;
    }
    api<ItemData>(`/api/admin/accounting/items/${itemId}`)
      .then((d) => {
        setData(d);
        const i = d.item;
        setF({
          code: i.code,
          title: i.title,
          unit: i.unit,
          salePrice: i.salePrice ?? "",
          reorderPoint: i.reorderPoint == null ? "" : String(i.reorderPoint),
          barcodes: i.barcodes.map((b) => b.barcode).join("\n"),
          sellOnline: i.sellOnline,
          isActive: i.isActive,
        });
      })
      .catch((e) => setError(e.message));
  }, [itemId]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const json = {
        code: f.code.trim() || null,
        title: f.title,
        unit: f.unit,
        salePrice: f.salePrice || null,
        reorderPoint: f.reorderPoint.trim() === "" ? null : f.reorderPoint,
        barcodes: f.barcodes.split(/[\s,،]+/).filter(Boolean),
        sellOnline: f.sellOnline,
        ...(itemId ? { isActive: f.isActive } : {}),
      };
      const r = itemId
        ? await api<{ item: { id: string } }>(`/api/admin/accounting/items/${itemId}`, { method: "PATCH", json })
        : await api<{ item: { id: string } }>("/api/admin/accounting/items", { method: "POST", json });
      onSaved(r.item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  const product = data?.product ?? null;
  const loading = itemId && !data;

  return (
    <Sheet
      open
      onClose={onClose}
      title={itemId ? "ویرایش کالا" : "کالای تازه"}
      help="accountingItem"
      footer={
        <button onClick={save} disabled={busy || !!loading} className={`${btn.primary} w-full`}>
          {busy ? "…" : "ذخیره"}
        </button>
      }
    >
      {loading ? (
        error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : (
        <div className="space-y-4">
          {product && (
            <p className="text-xs text-gray-500 leading-6">
              این کالا محصول سایت «{product.title}» است. تا وقتی نامش را اینجا عوض نکنید، با نام محصول همگام می‌ماند.
            </p>
          )}
          <Field label="نام کالا">
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} autoFocus={!itemId} placeholder="مثلاً: پیراهن قاجاری آبی سایز L" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="کد کالا" hint={itemId ? undefined : "خالی بگذارید تا خودکار بخورد"}>
              <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" placeholder={auto ? faNum(auto) : ""} />
            </Field>
            <Field label="واحد">
              <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={inputCls} placeholder="عدد، بسته، متر…" />
            </Field>
          </div>
          {!!data?.item.aliases.length && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
              کدهای قبلی:
              {data.item.aliases.map((a) => (
                <Badge key={a.id}>
                  <span dir="ltr">{a.code}</span>
                  {a.source !== "کد قبلی" && ` — ${a.source}`}
                </Badge>
              ))}
            </div>
          )}
          <Field label="بارکد" hint="هر بارکد در یک خط؛ می‌توانید با بارکدخوان اسکن کنید.">
            <textarea value={f.barcodes} onChange={(e) => setF({ ...f, barcodes: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {!product && (
              <Field label="قیمت فروش" hint="پیش‌فرض فاکتور فروش">
                <AmountInput value={f.salePrice} onChange={(v) => setF({ ...f, salePrice: v })} compact />
              </Field>
            )}
            <Field label="هشدار موجودی" hint={product ? "خالی = همان حد هشدار محصول" : "وقتی موجودی به این عدد برسد"}>
              <input value={f.reorderPoint} onChange={(e) => setF({ ...f, reorderPoint: e.target.value })} className={inputCls} inputMode="numeric" />
            </Field>
          </div>
          {!product && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={f.sellOnline} onChange={(e) => setF({ ...f, sellOnline: e.target.checked })} />
              <span>
                در فروشگاه اینترنتی فروخته می‌شود
                <span className="block text-[11px] text-gray-400">برای مواد اولیه، بسته‌بندی و کالای مصرفی خاموش کنید.</span>
              </span>
            </label>
          )}
          {itemId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!f.isActive} onChange={(e) => setF({ ...f, isActive: !e.target.checked })} />
              غیرفعال (در انتخاب کالای فاکتور نمی‌آید؛ تاریخچه‌اش می‌ماند)
            </label>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Sheet>
  );
}
