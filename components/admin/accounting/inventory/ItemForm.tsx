"use client";

/**
 * فرم کالای حسابداری — docs/plans/inventory-items.md فاز ۱ و ۲.
 * کد خالی = خودکار؛ کد عوض‌شده در «کدهای قبلی» می‌ماند و جستجو با آن هم کار می‌کند.
 * `initial` برای ساخت درجا (انتخابگر کالا) و «کپی کالا».
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import { api, Badge, btn, ErrorText, Field, inputCls, Sheet } from "../ui";

interface ItemData {
  item: {
    id: string;
    code: string;
    title: string;
    unit: string;
    salePrice: string | null;
    onlinePrice: string | null;
    reorderPoint: number | null;
    sellOnline: boolean;
    isActive: boolean;
    groupId: string | null;
    supplierId: string | null;
    barcodes: { barcode: string }[];
    aliases: { id: string; code: string; source: string }[];
    model: { id: string; title: string } | null;
    attrs: { axisId: string; axis: { name: string; sortOrder: number }; value: { value: string } }[];
  };
  product: { id: string; title: string; slug: string } | null;
  /** قیمت آنلاین از قیمت فروشگاه (۲.۹۶.۰) */
  online?: { enabled: boolean; price?: string | null; pctBp?: number; source?: string | null; manual?: boolean };
}

export interface ItemInitial {
  title?: string;
  barcode?: string;
  unit?: string;
  salePrice?: string;
  groupId?: string | null;
  sellOnline?: boolean;
}

type Group = { id: string; path: string };

/** عرضه‌کننده‌ها برای فرم کالا — دیدن اشخاص مجوز جدا دارد؛ نبودش فقط فیلد را خالی می‌گذارد */
function useSuppliers() {
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api<{ parties: { id: string; name: string }[] }>("/api/admin/accounting/parties?role=supplier&take=300")
      .then((d) => setList(d.parties))
      .catch(() => {});
  }, []);
  return list;
}

export function useItemGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    api<{ items: Group[] }>("/api/admin/accounting/items/groups")
      .then((d) => setGroups(d.items))
      .catch(() => {});
  }, []);
  return groups;
}

export default function ItemForm({
  itemId,
  initial,
  onClose,
  onSaved,
}: {
  itemId: string | null;
  initial?: ItemInitial;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [data, setData] = useState<ItemData | null>(null);
  const [auto, setAuto] = useState("");
  const [copyOf, setCopyOf] = useState<ItemInitial | null>(null);
  const groups = useItemGroups();
  const suppliers = useSuppliers();
  const [f, setF] = useState({
    code: "",
    title: initial?.title ?? "",
    unit: initial?.unit ?? "عدد",
    salePrice: initial?.salePrice ?? "",
    onlinePrice: "",
    reorderPoint: "",
    barcodes: initial?.barcode ?? "",
    sellOnline: initial?.sellOnline ?? true,
    isActive: true,
    groupId: initial?.groupId ?? "",
    supplierId: "",
  });
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
          onlinePrice: i.onlinePrice ?? "",
          reorderPoint: i.reorderPoint == null ? "" : String(i.reorderPoint),
          barcodes: i.barcodes.map((b) => b.barcode).join("\n"),
          sellOnline: i.sellOnline,
          isActive: i.isActive,
          groupId: i.groupId ?? "",
          supplierId: i.supplierId ?? "",
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
        ...(online?.enabled ? { onlinePrice: f.onlinePrice || null } : {}),
        reorderPoint: f.reorderPoint.trim() === "" ? null : f.reorderPoint,
        barcodes: f.barcodes.split(/[\s,،]+/).filter(Boolean),
        sellOnline: f.sellOnline,
        groupId: f.groupId || null,
        ...(suppliers.length || f.supplierId ? { supplierId: f.supplierId || null } : {}),
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

  // کپی: فرم تازه با همه‌چیز جز کد و بارکد (یکتا هستند)
  if (copyOf) return <ItemForm itemId={null} initial={copyOf} onClose={onClose} onSaved={onSaved} />;

  const product = data?.product ?? null;
  const online = data?.online ?? null;
  const loading = itemId && !data;
  const attrs = [...(data?.item.attrs ?? [])].sort((a, b) => a.axis.sortOrder - b.axis.sortOrder);

  return (
    <Sheet
      open
      onClose={onClose}
      title={itemId ? "ویرایش کالا" : "کالای تازه"}
      help="accountingItem"
      footer={
        <div className="flex gap-2">
          <button onClick={save} disabled={busy || !!loading} className={`${btn.primary} flex-1`}>
            {busy ? "…" : "ذخیره"}
          </button>
          {itemId && data && (
            <>
              <button
                type="button"
                onClick={() => setCopyOf({ title: `${f.title} (کپی)`, unit: f.unit, salePrice: f.salePrice, groupId: f.groupId || null, sellOnline: f.sellOnline })}
                className={btn.soft}
              >
                کپی
              </button>
              <Link href={`/admin/accounting/inventory/labels/print?items=${itemId}:1`} target="_blank" className={btn.soft}>
                برچسب
              </Link>
            </>
          )}
        </div>
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
          {data?.item.model && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              مدل «{data.item.model.title}»
              {attrs.map((a) => (
                <Badge key={a.axisId} tone="blue">
                  {a.axis.name}: {a.value.value}
                </Badge>
              ))}
            </div>
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
          <Field label="گروه کالا">
            <select value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })} className={inputCls}>
              <option value="">بی‌گروه</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.path}
                </option>
              ))}
            </select>
          </Field>
          {(suppliers.length > 0 || f.supplierId) && (
            <Field label="عرضه‌کننده" hint="برای گزارش فروش به تفکیک عرضه‌کننده؛ خالی = طرف آخرین فاکتور خرید">
              <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })} className={inputCls}>
                <option value="">از آخرین خرید</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {f.supplierId && !suppliers.some((s) => s.id === f.supplierId) && <option value={f.supplierId}>(عرضه‌کننده‌ی فعلی)</option>}
              </select>
            </Field>
          )}
          <Field label="بارکد" hint="هر بارکد در یک خط؛ می‌توانید با بارکدخوان اسکن کنید.">
            <textarea value={f.barcodes} onChange={(e) => setF({ ...f, barcodes: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {(!product || online?.enabled) && (
              <Field label={online?.enabled ? "قیمت فروشگاه" : "قیمت فروش"} hint={online?.enabled ? "صندوق و فاکتور؛ قیمت سایت از این ساخته می‌شود" : "پیش‌فرض فاکتور فروش"}>
                <AmountInput value={f.salePrice} onChange={(v) => setF({ ...f, salePrice: v })} compact />
              </Field>
            )}
            {online?.enabled && (
              <Field
                label="قیمت آنلاین دستی"
                hint={
                  online.price && !online.manual
                    ? `خالی = از قاعده: ${formatAmount(online.price)} (${online.pctBp ? `${online.pctBp > 0 ? "+" : "−"}${faNum(Math.abs(online.pctBp) / 100)}٪` : "همان قیمت"}${online.source ? ` · ${online.source}` : ""})`
                    : "خالی = از قاعده‌ی «قیمت آنلاین»"
                }
              >
                <AmountInput value={f.onlinePrice} onChange={(v) => setF({ ...f, onlinePrice: v })} compact />
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
