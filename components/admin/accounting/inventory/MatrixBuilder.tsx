"use client";

/**
 * ساخت ماتریسی کالا — مدل × رنگ × سایز — docs/plans/inventory-items.md بخش ۴.
 * پیش‌نمایش زنده (بی‌ثبت)، بازنویسی هر ردیف، و ثبت همه با کد خودکار پشت‌سرهم.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, Segmented } from "../ui";
import { useItemGroups } from "./ItemForm";

interface Axis {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}
interface Row {
  key: string;
  values: { axis: string; value: string }[];
  title: string;
  existing: { id: string; code: string; title: string } | null;
}
interface Preview {
  model: { id: string | null; title: string; isNew: boolean };
  rows: Row[];
}
type Override = { title?: string; code?: string; barcode?: string; salePrice?: string; skip?: boolean };

const splitValues = (s: string) => s.split(/[,،\n]+/).map((x) => x.trim()).filter(Boolean);

export default function MatrixBuilder() {
  const groups = useItemGroups();
  const [axes, setAxes] = useState<Axis[]>([]);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [modelTitle, setModelTitle] = useState("");
  const [modelQ, setModelQ] = useState("");
  const [models, setModels] = useState<{ id: string; title: string; items: number }[]>([]);
  const [modelId, setModelId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [unit, setUnit] = useState("عدد");
  const [price, setPrice] = useState("");
  /** محور ← مقدارهای انتخاب‌شده به ترتیب */
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newAxis, setNewAxis] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [over, setOver] = useState<Record<string, Override>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; code: string; title: string }[] | null>(null);

  useEffect(() => {
    api<{ items: Axis[] }>("/api/admin/accounting/items/axes")
      .then((d) => setAxes(d.items))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (mode !== "existing") return;
    const h = setTimeout(() => {
      api<{ items: { id: string; title: string; items: number }[] }>(`/api/admin/accounting/items/models?q=${encodeURIComponent(modelQ)}`)
        .then((d) => setModels(d.items))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(h);
  }, [modelQ, mode]);

  const body = useMemo(
    () => ({
      modelId: mode === "existing" ? modelId || null : null,
      modelTitle: mode === "new" ? modelTitle : null,
      groupId: groupId || null,
      unit,
      salePrice: price || null,
      axes: Object.entries(picked)
        .filter(([, v]) => v.length)
        .map(([axisId, values]) => ({ axisId, values })),
    }),
    [mode, modelId, modelTitle, groupId, unit, price, picked],
  );
  const ready = body.axes.length > 0 && (mode === "new" ? modelTitle.trim() : modelId);

  useEffect(() => {
    if (!ready) {
      setPreview(null);
      return;
    }
    const h = setTimeout(() => {
      api<Preview>("/api/admin/accounting/items/matrix", { method: "POST", json: { ...body, commit: false } })
        .then((d) => {
          setPreview(d);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, 350);
    return () => clearTimeout(h);
  }, [body, ready]);

  function toggle(axisId: string, value: string) {
    setPicked((p) => {
      const cur = p[axisId] ?? [];
      return { ...p, [axisId]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }
  function addValues(axisId: string) {
    const vals = splitValues(draft[axisId] ?? "");
    if (!vals.length) return;
    setPicked((p) => ({ ...p, [axisId]: [...(p[axisId] ?? []), ...vals.filter((v) => !(p[axisId] ?? []).includes(v))] }));
    setAxes((a) => a.map((x) => (x.id === axisId ? { ...x, values: [...x.values, ...vals.filter((v) => !x.values.some((y) => y.value === v)).map((v) => ({ id: `new:${v}`, value: v }))] } : x)));
    setDraft((d) => ({ ...d, [axisId]: "" }));
  }
  async function createAxis() {
    if (!newAxis.trim()) return;
    try {
      const r = await api<{ item: Axis }>("/api/admin/accounting/items/axes", { method: "POST", json: { name: newAxis } });
      setAxes((a) => [...a, r.item]);
      setNewAxis("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخته نشد");
    }
  }
  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const rows = Object.fromEntries(Object.entries(over).map(([k, o]) => [k, { ...o, salePrice: o.salePrice || null }]));
      const r = await api<{ created: { id: string; code: string; title: string }[] }>("/api/admin/accounting/items/matrix", { method: "POST", json: { ...body, rows, commit: true } });
      setDone(r.created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Card className="p-5 space-y-3">
        <p className="text-base font-black">✅ {faNum(done.length)} کالا ساخته شد</p>
        <div className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
          {done.map((i) => (
            <Link key={i.id} href={`/admin/accounting/inventory/${i.id}`} className="flex justify-between py-2 hover:text-blue-600">
              <span>{i.title}</span>
              <span dir="ltr" className="text-xs text-gray-400 font-mono">
                {faNum(i.code)}
              </span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/accounting/inventory/labels/print?items=${done.map((i) => `${i.id}:1`).join(",")}`} target="_blank" className={btn.soft}>
            چاپ برچسب همه
          </Link>
          <Link href="/admin/accounting/purchases" className={btn.soft}>
            ثبت فاکتور خرید
          </Link>
          <button
            onClick={() => {
              setDone(null);
              setPicked({});
              setOver({});
              setModelTitle("");
              setModelId("");
            }}
            className={btn.primary}
          >
            مدل بعدی
          </button>
        </div>
      </Card>
    );

  const fresh = preview?.rows.filter((r) => !r.existing && !over[r.key]?.skip) ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setPreview(null);
          }}
          options={[
            { value: "new", label: "مدل تازه" },
            { value: "existing", label: "افزودن به مدل موجود" },
          ]}
        />
        {mode === "new" ? (
          <Field label="نام مدل">
            <input value={modelTitle} onChange={(e) => setModelTitle(e.target.value)} className={inputCls} placeholder="مثلاً: پیراهن قاجاری" autoFocus />
          </Field>
        ) : (
          <Field label="مدل">
            <input value={modelQ} onChange={(e) => setModelQ(e.target.value)} className={inputCls} placeholder="جستجوی مدل" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${modelId === m.id ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-white/5"}`}
                >
                  {m.title} · {faNum(m.items)}
                </button>
              ))}
              {!models.length && <span className="text-xs text-gray-400">مدلی نیست — اول با «مدل تازه» بسازید.</span>}
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="گروه">
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
              <option value="">بی‌گروه</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.path}
                </option>
              ))}
            </select>
          </Field>
          <Field label="واحد">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
          </Field>
          <Field label="قیمت فروش همه" className="col-span-2 sm:col-span-1">
            <AmountInput value={price} onChange={setPrice} compact />
          </Field>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        {axes.map((a) => (
          <div key={a.id} className="space-y-2">
            <p className="text-sm font-black">
              {a.name}
              {!!picked[a.id]?.length && <span className="text-xs font-bold text-blue-600 mr-2">{faNum(picked[a.id].length)} انتخاب</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {a.values.map((v) => {
                const on = picked[a.id]?.includes(v.value);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggle(a.id, v.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${on ? "acc-chip-on bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "acc-chip bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"}`}
                  >
                    {on && `${faNum(picked[a.id].indexOf(v.value) + 1)}. `}
                    {v.value}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={draft[a.id] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addValues(a.id);
                  }
                }}
                className={inputCls}
                placeholder={`${a.name} تازه — چندتا را با ویرگول جدا کنید`}
              />
              <button type="button" onClick={() => addValues(a.id)} className={btn.soft}>
                افزودن
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
          <input value={newAxis} onChange={(e) => setNewAxis(e.target.value)} className={inputCls} placeholder="ویژگی دیگر، مثلاً: جنس، طرح" />
          <button type="button" onClick={createAxis} className={btn.soft}>
            ویژگی تازه
          </button>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {preview && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-white/5">
            <span className="text-sm font-black">
              {preview.model.isNew ? "مدل تازه" : "مدل"} «{preview.model.title}» — {faNum(preview.rows.length)} ترکیب
            </span>
            <span className="text-xs text-gray-500">کد خالی = خودکار پشت‌سرهم</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {preview.rows.map((r) => {
              const o = over[r.key] ?? {};
              const set = (patch: Override) => setOver((x) => ({ ...x, [r.key]: { ...x[r.key], ...patch } }));
              if (r.existing)
                return (
                  <div key={r.key} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm opacity-60">
                    <span>{r.existing.title}</span>
                    <Badge>
                      هست — کد <span dir="ltr">{faNum(r.existing.code)}</span>
                    </Badge>
                  </div>
                );
              return (
                <div key={r.key} className={`px-4 py-2.5 grid gap-2 sm:grid-cols-[auto_1.6fr_1fr_1fr_1fr] items-center ${o.skip ? "opacity-40" : ""}`}>
                  <input type="checkbox" checked={!o.skip} onChange={(e) => set({ skip: !e.target.checked })} aria-label="ساخته شود" />
                  <input value={o.title ?? r.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} />
                  <input value={o.code ?? ""} onChange={(e) => set({ code: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" placeholder="کد: خودکار" />
                  <input value={o.barcode ?? ""} onChange={(e) => set({ barcode: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" placeholder="بارکد" />
                  <AmountInput value={o.salePrice ?? ""} onChange={(v) => set({ salePrice: v })} compact placeholder="قیمت جدا" />
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-gray-100 dark:border-white/5">
            <button onClick={commit} disabled={busy || !fresh.length} className={`${btn.primary} w-full`}>
              {busy ? "…" : fresh.length ? `ساخت ${faNum(fresh.length)} کالا` : "ترکیب تازه‌ای نیست"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
