"use client";

/**
 * ساخت محصول از کالاها — docs/plans/inventory-items.md فاز ۵ (بخش ۵).
 * مدل بی‌محصول ← محصول تنوع‌دار؛ کالای تازه‌ی مدلِ محصول‌دار ← تنوع تازه؛
 * کالای بی‌مدل ← پیشنهاد مدل از عنوان یا محصول ساده. محصول همیشه پیش‌نویس (غیرفعال) است.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Empty, ErrorText, Field, inputCls, Money, PageHeader, SectionTitle, Sheet } from "../ui";

interface SugAttr {
  axisId: string;
  axis: string;
  valueId: string;
  value: string;
}
interface SugItem {
  id: string;
  code: string;
  title: string;
  qty: number;
  salePrice: string | null;
  attrs: SugAttr[];
}
interface ModelRow {
  id: string;
  title: string;
  product: { id: string; title: string } | null;
  items: SugItem[];
  qty: number;
}
interface Guess {
  title: string;
  modelId: string | null;
  items: { id: string; code: string; title: string; attrs: { axisId: string; axis: string; value: string }[] }[];
}
interface Data {
  additions: ModelRow[];
  models: ModelRow[];
  guesses: Guess[];
  loose: SugItem[];
  looseTotal: number;
  enabled: boolean;
  internal: boolean;
  categories: { id: string; title: string; parentId: string | null }[];
  brands: { id: string; title: string }[];
}
interface Skipped {
  id: string;
  code: string;
  title: string;
  reason: string;
}
interface ModelPlan {
  title: string;
  basePrice: string | null;
  axes: { axisId: string; axis: string; attributeId: string | null; attribute: string; candidates: { id: string; title: string; group: string }[]; newValues: string[] }[];
  variants: { itemId: string; code: string; title: string; label: string; price: string | null; qty: number }[];
  skipped: Skipped[];
}
interface AddPlan {
  product: { id: string; title: string };
  add: { itemId: string; code: string; label: string; action: "new" | "link"; price: string | null; qty: number }[];
  skipped: Skipped[];
  newValues: { attribute: string; values: string[] }[];
}

const URL_ = "/api/admin/accounting/items/to-product";
const attrsLabel = (a: { value: string }[]) => a.map((x) => x.value).join(" / ");

export default function ToProductClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ kind: "model"; row: ModelRow } | { kind: "simple"; item: SugItem } | null>(null);
  const [adding, setAdding] = useState<ModelRow | null>(null);
  const [done, setDone] = useState<{ id: string; title: string; note: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Data>(URL_)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const act = async (key: string, json: unknown, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      await api(URL_, { method: "POST", json });
      after?.();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const dismiss = (key: string, itemIds: string[], what: string) => {
    if (confirm(`${what} دیگر برای ساخت محصول پیشنهاد نشود؟ (در ویرایش کالا تیک «فروش آنلاین» را می‌شود دوباره زد)`)) void act(key, { action: "dismiss", itemIds });
  };

  const empty = data && !data.additions.length && !data.models.length && !data.guesses.length && !data.loose.length;

  return (
    <div className="space-y-4">
      <PageHeader title="کالا و انبار" help="accountingToProduct" desc="کالاهایی که هنوز در سایت نیستند — محصولشان را با یک کلیک بسازید." />
      <InventoryTabs />
      <ErrorText>{error}</ErrorText>

      {data && !data.enabled && (
        <p className="text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2 leading-6">
          تنوع محصول در «تنظیمات سایت ← نمایش محصولات» خاموش است. محصول تنوع‌دار ساخته می‌شود ولی تا روشنش نکنید انتخاب رنگ و سایز در سایت دیده نمی‌شود.
        </p>
      )}

      {done && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-emerald-200">
          <p className="text-sm font-bold">
            ✅ «{done.title}» {done.note}
          </p>
          <Link href={`/admin/products/${done.id}`} className={btn.primary}>
            تکمیل محصول (عکس، توضیح، فعال‌سازی)
          </Link>
        </Card>
      )}

      {!data && !error && <Card className="p-8 text-center text-sm text-gray-400">در حال خواندن…</Card>}
      {empty && (
        <Card>
          <Empty title="همه‌ی کالاها در سایت هستند" desc="کالای تازه‌ای که در «ورود سریع» یا فاکتور خرید بسازید و محصول نداشته باشد اینجا می‌آید." />
        </Card>
      )}

      {/* کالای تازه‌ی مدلی که محصول دارد */}
      {!!data?.additions.length && (
        <section className="space-y-2">
          <SectionTitle title="کالای تازه برای محصول‌های موجود" />
          {data.additions.map((m) => (
            <Card key={m.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">
                  {m.title}{" "}
                  <span className="text-xs font-bold text-gray-400">
                    — {faNum(m.items.length)} کالای تازه، محصول «{m.product!.title}»
                  </span>
                </p>
                <div className="flex gap-2">
                  <button className={btn.small} disabled={!!busy} onClick={() => dismiss(`d-${m.id}`, m.items.map((i) => i.id), "این کالاها")}>
                    فروش آنلاین ندارد
                  </button>
                  <button className={btn.primary} disabled={!!busy} onClick={() => setAdding(m)}>
                    افزودن به‌عنوان تنوع
                  </button>
                </div>
              </div>
              <ItemChips items={m.items} />
            </Card>
          ))}
        </section>
      )}

      {/* مدل بی‌محصول */}
      {!!data?.models.length && (
        <section className="space-y-2">
          <SectionTitle title="مدل‌های بی‌محصول" />
          {data.models.map((m) => (
            <Card key={m.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">
                  {m.title}{" "}
                  <span className="text-xs font-bold text-gray-400">
                    — {faNum(m.items.length)} کالا{data.internal ? `، ${faNum(m.qty)} عدد موجود` : ""}
                  </span>
                </p>
                <div className="flex gap-2">
                  <button className={btn.small} disabled={!!busy} onClick={() => dismiss(`d-${m.id}`, m.items.map((i) => i.id), `کالاهای «${m.title}»`)}>
                    فروش آنلاین ندارد
                  </button>
                  <button className={btn.primary} disabled={!!busy} onClick={() => setCreating({ kind: "model", row: m })}>
                    ساخت محصول
                  </button>
                </div>
              </div>
              <ItemChips items={m.items} />
            </Card>
          ))}
        </section>
      )}

      {/* پیشنهاد مدل از عنوان */}
      {!!data?.guesses.length && (
        <section className="space-y-2">
          <SectionTitle title="کالاهای شبیه هم — یک مدل؟" />
          {data.guesses.map((g) => (
            <GuessCard key={`${g.title}|${g.items[0].id}`} g={g} busy={!!busy} onApply={(title) => act(`g-${g.items[0].id}`, { action: "guess", title, items: g.items.map((i) => ({ id: i.id, attrs: i.attrs.map((a) => ({ axisId: a.axisId, value: a.value })) })) })} />
          ))}
        </section>
      )}

      {/* کالای تکی */}
      {!!data?.loose.length && (
        <section className="space-y-2">
          <SectionTitle title={`کالاهای تکی (${faNum(data.looseTotal)})`} />
          <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
            {data.loose.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{i.title}</span>
                  <span className="text-[11px] text-gray-400">
                    کد <span dir="ltr">{faNum(i.code)}</span>
                    {data.internal && ` · موجودی ${faNum(i.qty)}`}
                    {i.salePrice && (
                      <>
                        {" · "}
                        <Money value={i.salePrice} className="text-[11px]" />
                      </>
                    )}
                    {!!i.attrs.length && ` · ${attrsLabel(i.attrs)}`}
                  </span>
                </span>
                <button className={btn.small} disabled={!!busy} onClick={() => dismiss(`d-${i.id}`, [i.id], `«${i.title}»`)}>
                  فروش آنلاین ندارد
                </button>
                <button className={btn.small} disabled={!!busy} onClick={() => setCreating({ kind: "simple", item: i })}>
                  محصول ساده
                </button>
              </div>
            ))}
          </Card>
          {data.looseTotal > data.loose.length && <p className="text-[11px] text-gray-400">{faNum(data.loose.length)} کالای اول نشان داده شد.</p>}
        </section>
      )}

      {creating && data && (
        <CreateSheet
          target={creating}
          data={data}
          onClose={() => setCreating(null)}
          onDone={(p, note) => {
            setCreating(null);
            setDone({ ...p, note });
            load();
          }}
        />
      )}
      {adding && (
        <AddSheet
          row={adding}
          onClose={() => setAdding(null)}
          onDone={(p, note) => {
            setAdding(null);
            setDone({ ...p, note });
            load();
          }}
        />
      )}
    </div>
  );
}

function ItemChips({ items }: { items: SugItem[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i.id} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-[11px] font-bold" title={`${i.title} — کد ${i.code}`}>
          {i.attrs.length ? attrsLabel(i.attrs) : i.title}
          {i.qty !== 0 && <span className="text-gray-400 font-normal"> · {faNum(i.qty)}</span>}
        </span>
      ))}
    </div>
  );
}

function GuessCard({ g, busy, onApply }: { g: Guess; busy: boolean; onApply: (title: string) => void }) {
  const [title, setTitle] = useState(g.title);
  return (
    <Card className="p-4 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={g.modelId ? "به مدل موجود" : "نام مدل"} className="flex-1 min-w-[180px]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <button className={btn.primary} disabled={busy || !title.trim()} onClick={() => onApply(title)}>
          {g.modelId ? "افزودن به مدل" : "ساخت مدل"} از {faNum(g.items.length)} کالا
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {g.items.map((i) => (
          <span key={i.id} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-[11px]" title={i.title}>
            <b>{attrsLabel(i.attrs)}</b> <span className="text-gray-400">{i.attrs.map((a) => a.axis).join("/")}</span>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">کالاها فقط زیر مدل و با رنگ/سایزشان می‌نشینند؛ محصول بعد از آن از «مدل‌های بی‌محصول» ساخته می‌شود.</p>
    </Card>
  );
}

function useCategoryOptions(categories: Data["categories"]) {
  return useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const path = (c: Data["categories"][number], depth = 0): string => {
      const p = c.parentId ? byId.get(c.parentId) : null;
      return p && depth < 10 ? `${path(p, depth + 1)} ← ${c.title}` : c.title;
    };
    return categories.map((c) => ({ id: c.id, label: path(c) })).sort((a, b) => a.label.localeCompare(b.label, "fa"));
  }, [categories]);
}

function CreateSheet({
  target,
  data,
  onClose,
  onDone,
}: {
  target: { kind: "model"; row: ModelRow } | { kind: "simple"; item: SugItem };
  data: Data;
  onClose: () => void;
  onDone: (p: { id: string; title: string }, note: string) => void;
}) {
  const isModel = target.kind === "model";
  const cats = useCategoryOptions(data.categories);
  const [title, setTitle] = useState(isModel ? target.row.title : target.item.title);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [price, setPrice] = useState(isModel ? "" : (target.item.salePrice ?? ""));
  const [axisMap, setAxisMap] = useState<Record<string, string>>({});
  const [exclude, setExclude] = useState<string[]>([]);
  const [plan, setPlan] = useState<ModelPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // نوشتن متن با هوش مصنوعی بعد از ساخت — docs/features/ai-product-text.md
  // فقط وقتی کلید هست و کاربر به کاتالوگ دسترسی دارد (وگرنه این مسیر ۴۰۳ می‌دهد)
  const [aiReady, setAiReady] = useState(false);
  const [aiText, setAiText] = useState(true);
  useEffect(() => {
    fetch("/api/admin/ai-text").then((r) => (r.ok ? r.json() : null)).then((c) => setAiReady(!!c?.ready)).catch(() => {});
  }, []);

  const body = useMemo(
    () => (isModel ? { modelId: target.row.id, title, categoryId, brandId, price: price || null, axisMap, exclude } : { itemId: target.item.id, title, categoryId, brandId, price: price || null }),
    [isModel, target, title, categoryId, brandId, price, axisMap, exclude],
  );

  // پیش‌نمایش زنده — هیچ چیزی نمی‌نویسد
  useEffect(() => {
    if (!isModel) return;
    const h = setTimeout(() => {
      api<ModelPlan>(URL_, { method: "POST", json: { action: "plan-model", ...body } })
        .then((p) => {
          setPlan(p);
          setError(null);
          if (!price && p.basePrice) setPrice(p.basePrice);
        })
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModel, body]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ product: { id: string; title: string }; variants?: number; skipped?: Skipped[] }>(URL_, { method: "POST", json: { action: isModel ? "create-model" : "simple", ...body } });
      let note = isModel ? `با ${faNum(r.variants ?? 0)} تنوع به‌صورت پیش‌نویس ساخته شد.` : "به‌صورت پیش‌نویس ساخته شد.";
      if (aiReady && aiText) {
        // در پس‌زمینه‌ی سرور؛ نتیجه در گزارش فعالیت‌ها و خود محصول دیده می‌شود
        const ai = await fetch("/api/admin/ai-text/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: [r.product.id], sections: ["title", "short", "expert", "features", "faq", "seo"], retitle: true }),
        }).then((x) => x.json()).catch(() => null);
        note += ai?.jobId ? " عنوان استاندارد و متن محصول تا چند ثانیه‌ی دیگر با هوش مصنوعی نوشته می‌شود." : " نوشتن متن با هوش مصنوعی شروع نشد؛ از فرم محصول بنویسید.";
      }
      onDone(r.product, note);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const newAttr = plan?.axes.filter((a) => !a.attributeId) ?? [];
  const newVals = plan?.axes.filter((a) => a.attributeId && a.newValues.length) ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      wide={isModel}
      title={isModel ? `ساخت محصول از «${target.row.title}»` : "محصول ساده از کالا"}
      help="accountingToProduct"
      footer={
        <button className={`${btn.primary} w-full`} disabled={busy || !categoryId || (isModel && !plan)} onClick={submit}>
          {busy ? "در حال ساخت…" : isModel && plan ? `ساخت محصول با ${faNum(plan.variants.length)} تنوع (پیش‌نویس)` : "ساخت محصول (پیش‌نویس)"}
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="عنوان محصول">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="دسته">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">انتخاب کنید</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="برند (اختیاری)">
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="قیمت محصول (تومان)" hint={isModel ? "تنوعی که قیمت فروش کالایش با این فرق دارد قیمت خودش را می‌گیرد." : undefined}>
          <AmountInput value={price} onChange={setPrice} />
        </Field>

        {isModel && plan && (
          <>
            <div className="space-y-2">
              <p className="text-xs font-black">ویژگی‌های فروشگاه</p>
              {plan.axes.map((a) => (
                <div key={a.axisId} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="w-16 font-bold">{a.axis}</span>
                  <span className="text-gray-400">←</span>
                  <select
                    value={axisMap[a.axisId] ?? a.attributeId ?? "new"}
                    onChange={(e) => setAxisMap({ ...axisMap, [a.axisId]: e.target.value })}
                    className={`${inputCls} !py-1.5 flex-1 min-w-[160px]`}
                  >
                    {a.candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.group})
                      </option>
                    ))}
                    <option value="new">ویژگی تازه «{a.axis}» بساز</option>
                  </select>
                </div>
              ))}
              {(newAttr.length > 0 || newVals.length > 0) && (
                <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5 leading-5">
                  در فروشگاه ساخته می‌شود:{" "}
                  {[
                    ...newAttr.map((a) => `ویژگی «${a.axis}» (گروه «تنوع محصول») با ${a.newValues.join("، ")}`),
                    ...newVals.map((a) => `در «${a.attribute}»: ${a.newValues.join("، ")}`),
                  ].join(" · ")}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-black">تنوع‌ها</p>
              <div className="rounded-xl border border-gray-100 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
                {plan.variants.map((v) => (
                  <label key={v.itemId} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <input type="checkbox" checked onChange={() => setExclude([...exclude, v.itemId])} />
                    <span className="flex-1 font-bold">{v.label}</span>
                    <span className="text-gray-400" dir="ltr">
                      {faNum(v.code)}
                    </span>
                    <span className="w-24 text-left">{v.price ? <Money value={v.price} className="text-xs" /> : <span className="text-gray-400">قیمت محصول</span>}</span>
                    {data.internal && <span className="w-12 text-left">{faNum(v.qty)}</span>}
                  </label>
                ))}
                {plan.skipped.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs opacity-60">
                    <input type="checkbox" checked={false} disabled={!exclude.includes(s.id)} onChange={() => setExclude(exclude.filter((x) => x !== s.id))} />
                    <span className="flex-1">{s.title}</span>
                    <Badge tone="gray">{s.reason}</Badge>
                  </label>
                ))}
              </div>
              {!data.internal && <p className="text-[11px] text-gray-400">موجودی هر تنوع را بعداً در ویرایش محصول بنویسید.</p>}
            </div>
          </>
        )}
        {aiReady && (
          <label className="flex items-start gap-2 text-xs cursor-pointer rounded-xl bg-violet-50 dark:bg-violet-500/10 px-3 py-2">
            <input type="checkbox" checked={aiText} onChange={(e) => setAiText(e.target.checked)} className="mt-0.5" />
            <span>
              ✨ عنوان استاندارد و متن محصول با هوش مصنوعی نوشته شود
              <span className="block text-[11px] text-gray-500">توضیحات، ویژگی‌ها، سوالات متداول و سئو — بعد از ساخت، در پس‌زمینه.</span>
            </span>
          </label>
        )}
        <p className="text-[11px] text-gray-400 leading-5">محصول غیرفعال ساخته می‌شود؛ عکس، توضیح و سئو را در ویرایش محصول کامل کنید و بعد فعالش کنید.</p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function AddSheet({ row, onClose, onDone }: { row: ModelRow; onClose: () => void; onDone: (p: { id: string; title: string }, note: string) => void }) {
  const [plan, setPlan] = useState<AddPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const itemIds = useMemo(() => row.items.map((i) => i.id), [row]);

  useEffect(() => {
    api<AddPlan>(URL_, { method: "POST", json: { action: "plan-add", productId: row.product!.id, itemIds } })
      .then(setPlan)
      .catch((e) => setError(e.message));
  }, [row, itemIds]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ product: { id: string; title: string }; added: number }>(URL_, { method: "POST", json: { action: "add", productId: row.product!.id, itemIds } });
      onDone(r.product, `${faNum(r.added)} تنوع تازه گرفت.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`افزودن به «${row.product!.title}»`}
      help="accountingToProduct"
      footer={
        <button className={`${btn.primary} w-full`} disabled={busy || !plan?.add.length} onClick={submit}>
          {busy ? "در حال افزودن…" : `افزودن ${faNum(plan?.add.length ?? 0)} تنوع`}
        </button>
      }
    >
      <div className="space-y-3">
        {!plan && !error && <p className="text-sm text-gray-400">در حال بررسی…</p>}
        {plan && (
          <div className="rounded-xl border border-gray-100 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
            {plan.add.map((a) => (
              <div key={a.itemId} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="flex-1 font-bold">{a.label}</span>
                <Badge tone={a.action === "new" ? "blue" : "green"}>{a.action === "new" ? "تنوع تازه" : "وصل به تنوع موجود"}</Badge>
                <span className="w-24 text-left">{a.price ? <Money value={a.price} className="text-xs" /> : <span className="text-gray-400">قیمت محصول</span>}</span>
              </div>
            ))}
            {plan.skipped.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs opacity-60">
                <span className="flex-1">{s.title}</span>
                <Badge tone="gray">{s.reason}</Badge>
              </div>
            ))}
          </div>
        )}
        {!!plan?.newValues.length && (
          <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5 leading-5">
            در فروشگاه ساخته می‌شود: {plan.newValues.map((n) => `در «${n.attribute}»: ${n.values.join("، ")}`).join(" · ")}
          </p>
        )}
        <p className="text-[11px] text-gray-400 leading-5">تنوع‌های قبلی محصول دست نمی‌خورند. عکس رنگ تازه را در بخش «تنوع» ویرایش محصول بگذارید.</p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
