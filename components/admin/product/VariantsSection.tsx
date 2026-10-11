"use client";

/**
 * تنوع‌های محصول در ویرایش ادمین — docs/plans/inventory-items.md فاز ۴.
 * فقط وقتی «تنوع محصول» در تنظیمات فروشگاه روشن است دیده می‌شود.
 * ویژگی‌ها (رنگ، سایز) از ویژگی‌های فروشگاه؛ هر ترکیب قیمت، موجودی، کد و
 * کالای حسابداری خودش را دارد؛ هر عکس می‌تواند مال یک رنگ باشد.
 */

import { useEffect, useMemo, useRef, useState } from "react";

interface Attr {
  id: string;
  title: string;
  group: string;
  values: { id: string; value: string; colorHex: string | null }[];
}
interface Row {
  key: string;
  options: Record<string, string>;
  price: string;
  salePrice: string;
  stock: string;
  sku: string;
  accItem: { id: string; code: string; title: string } | null;
  isActive: boolean;
}
interface Data {
  enabled: boolean;
  product: { id: string; title: string; price: string; salePrice: string | null };
  axes: { attributeId: string; display: string }[];
  variants: { optionKey: string; options: Record<string, string>; price: string | null; salePrice: string | null; stock: number; sku: string | null; isActive: boolean; accItem: { id: string; code: string; title: string } | null }[];
  images: { id: string; url: string; attributeValueId: string | null }[];
  attributes: Attr[];
  accountingInternal: boolean;
}

const inp =
  "w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-primary-500";
const keyOf = (axes: string[], o: Record<string, string>) => axes.map((a) => `${a}:${o[a]}`).join("|");
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export default function VariantsSection({ productId }: { productId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [axes, setAxes] = useState<{ attributeId: string; display: string }[]>([]);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [imgColor, setImgColor] = useState<Record<string, string>>({});
  const [newVal, setNewVal] = useState<Record<string, { value: string; hex: string }>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function apply(d: Data) {
    setData(d);
    setAxes(d.axes);
    const p: Record<string, string[]> = {};
    for (const a of d.axes) p[a.attributeId] = [...new Set(d.variants.map((v) => v.options[a.attributeId]).filter(Boolean))];
    setPicked(p);
    setRows(
      d.variants.map((v) => ({
        key: keyOf(d.axes.map((a) => a.attributeId), v.options),
        options: v.options,
        price: v.price ?? "",
        salePrice: v.salePrice ?? "",
        stock: String(v.stock),
        sku: v.sku ?? "",
        accItem: v.accItem,
        isActive: v.isActive,
      })),
    );
    setImgColor(Object.fromEntries(d.images.map((i) => [i.id, i.attributeValueId ?? ""])));
  }

  useEffect(() => {
    fetch(`/api/admin/products/${productId}/variants`)
      .then((r) => r.json())
      .then((d) => d.product && apply(d))
      .catch(() => {});
  }, [productId]);

  const attrById = useMemo(() => new Map((data?.attributes ?? []).map((a) => [a.id, a])), [data]);
  if (!data?.enabled) return null;

  const axisIds = axes.map((a) => a.attributeId);
  const valueTitle = (attrId: string, valueId: string) => attrById.get(attrId)?.values.find((v) => v.id === valueId)?.value ?? "?";
  const allValues = axes.flatMap((a) => (picked[a.attributeId] ?? []).map((vid) => ({ id: vid, label: `${attrById.get(a.attributeId)?.title}: ${valueTitle(a.attributeId, vid)}` })));

  function generate() {
    const lists = axisIds.map((a) => picked[a] ?? []);
    if (!lists.length || lists.some((l) => !l.length)) {
      setMsg({ ok: false, text: "برای هر ویژگی دست‌کم یک مقدار انتخاب کنید" });
      return;
    }
    const combos = lists.reduce<string[][]>((acc, l) => acc.flatMap((c) => l.map((x) => [...c, x])), [[]]);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    setRows(
      combos.map((c) => {
        const options = Object.fromEntries(axisIds.map((a, i) => [a, c[i]]));
        const key = keyOf(axisIds, options);
        return byKey.get(key) ?? { key, options, price: "", salePrice: "", stock: "0", sku: "", accItem: null, isActive: true };
      }),
    );
    setMsg(null);
  }

  async function addValue(attrId: string) {
    const nv = newVal[attrId];
    if (!nv?.value.trim()) return;
    const r = await fetch(`/api/admin/products/${productId}/variants/value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributeId: attrId, value: nv.value, colorHex: nv.hex || null }),
    });
    const d = await r.json();
    if (!r.ok) return setMsg({ ok: false, text: d.error ?? "ساخته نشد" });
    setData((x) => x && { ...x, attributes: x.attributes.map((a) => (a.id === attrId && !a.values.some((v) => v.id === d.value.id) ? { ...a, values: [...a.values, d.value] } : a)) });
    setPicked((p) => ({ ...p, [attrId]: [...new Set([...(p[attrId] ?? []), d.value.id])] }));
    setNewVal((x) => ({ ...x, [attrId]: { value: "", hex: "" } }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          axes: rows.length ? axes : [],
          variants: rows.map((v) => ({ options: v.options, price: v.price || null, salePrice: v.salePrice || null, stock: v.stock, sku: v.sku, accItemId: v.accItem?.id ?? null, isActive: v.isActive })),
          images: Object.entries(imgColor).map(([imageId, attributeValueId]) => ({ imageId, attributeValueId: attributeValueId || null })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "ذخیره نشد");
      apply(d);
      setMsg({ ok: true, text: rows.length ? `${fa(rows.length)} تنوع ذخیره شد — موجودی محصول جمع موجودی تنوع‌هاست` : "تنوع‌ها برداشته شد — محصول ساده است" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ذخیره نشد" });
    } finally {
      setBusy(false);
    }
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-5">
      <div>
        <p className="text-sm font-black text-gray-900 dark:text-white">🎨 تنوع (رنگ، سایز…)</p>
        <p className="text-[11px] text-gray-400 mt-1 leading-5">
          هر ترکیب (مثلاً آبی L) قیمت و موجودی خودش را دارد. قیمت خالی = قیمت محصول ({fa(Number(data.product.salePrice ?? data.product.price).toLocaleString("en"))} تومان). بدون تنوع، محصول مثل همیشه ساده است.
        </p>
      </div>

      {/* محورها */}
      <div className="space-y-3">
        {axes.map((ax, ai) => {
          const at = attrById.get(ax.attributeId);
          if (!at) return null;
          return (
            <div key={ax.attributeId} className="rounded-xl border border-gray-100 dark:border-white/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black flex-1">
                  {at.title} <span className="text-gray-400 font-normal">({at.group})</span>
                </span>
                <label className="flex items-center gap-1 text-[11px] text-gray-500">
                  <input type="checkbox" checked={ax.display === "SWATCH"} onChange={(e) => setAxes((a) => a.map((x, j) => (j === ai ? { ...x, display: e.target.checked ? "SWATCH" : "CHIP" } : x)))} />
                  نمایش نمونه‌رنگ
                </label>
                <button type="button" onClick={() => setAxes((a) => a.filter((_, j) => j !== ai))} className="text-[11px] text-rose-500">
                  حذف ویژگی
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {at.values.map((v) => {
                  const on = picked[at.id]?.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPicked((p) => ({ ...p, [at.id]: on ? (p[at.id] ?? []).filter((x) => x !== v.id) : [...(p[at.id] ?? []), v.id] }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${on ? "bg-primary-600 text-white border-primary-600" : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"}`}
                    >
                      {v.colorHex && <span className="w-3 h-3 rounded-full border border-white/50" style={{ background: v.colorHex }} />}
                      {v.value}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={newVal[at.id]?.value ?? ""}
                  onChange={(e) => setNewVal((x) => ({ ...x, [at.id]: { value: e.target.value, hex: x[at.id]?.hex ?? "" } }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addValue(at.id);
                    }
                  }}
                  placeholder={`${at.title} تازه`}
                  className={inp}
                />
                {ax.display === "SWATCH" && (
                  <input type="color" value={newVal[at.id]?.hex || "#000000"} onChange={(e) => setNewVal((x) => ({ ...x, [at.id]: { value: x[at.id]?.value ?? "", hex: e.target.value } }))} className="w-10 h-8 rounded" aria-label="رنگ" />
                )}
                <button type="button" onClick={() => addValue(at.id)} className="px-3 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-bold shrink-0">
                  افزودن
                </button>
              </div>
            </div>
          );
        })}
        <select
          value=""
          onChange={(e) => e.target.value && setAxes((a) => [...a, { attributeId: e.target.value, display: /رنگ|color/i.test(attrById.get(e.target.value)?.title ?? "") ? "SWATCH" : "CHIP" }])}
          className={inp}
        >
          <option value="">+ افزودن ویژگی تنوع (رنگ، سایز…)</option>
          {data.attributes
            .filter((a) => !axisIds.includes(a.id))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} — {a.group}
              </option>
            ))}
        </select>
        {!data.attributes.length && <p className="text-[11px] text-amber-600">اول در «ویژگی‌ها»ی فروشگاه ویژگی «رنگ» یا «سایز» را بسازید.</p>}
        {axes.length > 0 && (
          <button type="button" onClick={generate} className="w-full py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black">
            ساخت ترکیب‌ها از مقدارهای انتخاب‌شده
          </button>
        )}
      </div>

      {/* ردیف‌ها */}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-[760px] space-y-1">
            <div className="grid gap-1.5 px-1 text-[10px] font-black text-gray-400" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.7fr 0.9fr 1.4fr 50px 28px" }}>
              <span>تنوع</span>
              <span>قیمت (خالی = محصول)</span>
              <span>قیمت ویژه</span>
              <span>موجودی</span>
              <span>کد (SKU)</span>
              <span>کالای حسابداری</span>
              <span>فعال</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const fromAcc = data.accountingInternal && !!r.accItem;
              return (
                <div key={r.key} className={`grid gap-1.5 items-center ${r.isActive ? "" : "opacity-50"}`} style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.7fr 0.9fr 1.4fr 50px 28px" }}>
                  <span className="text-xs font-bold truncate">{axisIds.map((a) => valueTitle(a, r.options[a])).join(" / ")}</span>
                  <input value={r.price} onChange={(e) => setRow(i, { price: e.target.value.replace(/\D/g, "") })} className={inp} dir="ltr" inputMode="numeric" />
                  <input value={r.salePrice} onChange={(e) => setRow(i, { salePrice: e.target.value.replace(/\D/g, "") })} className={inp} dir="ltr" inputMode="numeric" disabled={!r.price} />
                  <input value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value.replace(/\D/g, "") })} className={inp} dir="ltr" inputMode="numeric" disabled={fromAcc} title={fromAcc ? "از انبار حسابداری" : undefined} />
                  <input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} className={inp} dir="ltr" />
                  <ItemPick value={r.accItem} onChange={(accItem) => setRow(i, { accItem })} />
                  <input type="checkbox" checked={r.isActive} onChange={(e) => setRow(i, { isActive: e.target.checked })} aria-label="فعال" />
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-rose-500 text-sm" aria-label="حذف">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          {data.accountingInternal && <p className="text-[11px] text-gray-400 mt-2">موجودی تنوعِ وصل به کالای حسابداری از انبار می‌آید و اینجا دستی نوشته نمی‌شود.</p>}
          {data.accountingInternal && rows.some((r) => r.isActive && !r.accItem) && (
            <p className="text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5 mt-2">
              ⚠️ {rows.filter((r) => r.isActive && !r.accItem).length.toLocaleString("fa-IR")} تنوع کالای حسابداری ندارد — موجودی‌اش از کجا می‌آید؟ فروشش در انبار ثبت نمی‌شود؛ برای هر کدام کالا انتخاب کنید.
            </p>
          )}
        </div>
      )}

      {/* عکس هر رنگ */}
      {rows.length > 0 && data.images.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black">عکس هر رنگ</p>
          <p className="text-[11px] text-gray-400">با انتخاب رنگ در صفحه‌ی محصول، عکس‌های همان رنگ و عکس‌های «همه» نشان داده می‌شوند. عکس تازه را اول در «تصاویر» بگذارید و محصول را ذخیره کنید.</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {data.images.map((im) => (
              <div key={im.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="w-full aspect-square object-cover rounded-lg bg-gray-100" />
                <select value={imgColor[im.id] ?? ""} onChange={(e) => setImgColor((x) => ({ ...x, [im.id]: e.target.value }))} className={inp}>
                  <option value="">همه</option>
                  {allValues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && <p className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      <button type="button" onClick={save} disabled={busy} className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-black disabled:opacity-50">
        {busy ? "…" : "ذخیره‌ی تنوع‌ها"}
      </button>
    </div>
  );
}

/** انتخاب کالای حسابداری برای تنوع — اگر کاربر مجوز انبار ندارد، فقط نمایش */
function ItemPick({ value, onChange }: { value: Row["accItem"]; onChange: (v: Row["accItem"]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; title: string; code: string }[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!q.trim()) return;
    const h = setTimeout(() => {
      fetch(`/api/admin/accounting/inventory/products?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setItems(d.items ?? []))
        .catch(() => setItems([]));
    }, 220);
    return () => clearTimeout(h);
  }, [q]);
  if (value)
    return (
      <span className="flex items-center gap-1 text-[11px] min-w-0">
        <span className="truncate" title={value.title}>
          <span dir="ltr" className="font-mono">{value.code}</span> {value.title}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-rose-500 shrink-0" aria-label="برداشتن کالا">
          ×
        </button>
      </span>
    );
  return (
    <div ref={box} className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="کد یا نام کالا" className={inp} />
      {open && q.trim() && (
        <div className="absolute z-30 mt-1 w-64 max-h-56 overflow-y-auto rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl">
          {items.map((it) => (
            <button key={it.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ id: it.id, code: it.code, title: it.title }); setQ(""); setOpen(false); }} className="block w-full text-right px-2.5 py-1.5 text-[11px] hover:bg-gray-50 dark:hover:bg-white/5">
              <span dir="ltr" className="font-mono text-gray-400">{it.code}</span> {it.title}
            </button>
          ))}
          {!items.length && <p className="px-2.5 py-2 text-[11px] text-gray-400">کالایی نیست</p>}
        </div>
      )}
    </div>
  );
}
