"use client";

/**
 * قیمت آنلاین از قیمت فروشگاه — docs/plans/inventory-items.md بخش ۱۴.
 * قاعده‌ی کلی (درصد + گرد کردن)، درصد هر گروه، قیمت دستی کالاها؛ پیش‌نمایش و «ذخیره و اعمال».
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { applyRule, type RoundMode } from "@/lib/accounting/inventory/online-price-calc";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Empty, ErrorText, Field, inputCls, PageHeader, SectionTitle } from "../ui";

interface Change {
  itemId: string;
  code: string;
  title: string;
  store: string;
  pctBp: number;
  source: string | null;
  manual: boolean;
  productId: string;
  productTitle: string;
  variantId: string | null;
  current: string;
  next: string;
}
interface Data {
  rule: { enabled: boolean; pctBp: number; roundTo: number; roundMode: RoundMode };
  groups: { id: string; parentId: string | null; path: string; items: number; pctBp: number | null }[];
  overrides: { id: string; code: string; title: string; salePrice: string | null; onlinePrice: string }[];
  pending: { total: number; products: number; rows: Change[] };
  can: { manage: boolean };
}

const pctText = (bp: number) => (bp === 0 ? "همان قیمت" : `${bp > 0 ? "+" : "−"}${faNum(Math.abs(bp) / 100)}٪`);
/** «−۱۰»، «۱۰-»، «10» → صدم درصد؛ خالی ← null */
function parsePct(raw: string): number | null {
  const t = raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٫,]/g, ".").replace(/[−–]/g, "-").replace(/\s|٪|%/g, "");
  if (!t) return null;
  const neg = t.includes("-");
  const n = Number(t.replace(/-/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100);
}
const showPct = (bp: number | null) => (bp === null ? "" : `${bp < 0 ? "-" : ""}${Math.abs(bp) / 100}`);

export default function OnlinePricesClient() {
  const [d, setD] = useState<Data | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [pct, setPct] = useState("");
  const [roundTo, setRoundTo] = useState(0);
  const [mode, setMode] = useState<RoundMode>("nearest");
  const [gp, setGp] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Data["pending"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Data>("/api/admin/accounting/items/online-prices")
      .then((x) => {
        setD(x);
        setEnabled(x.rule.enabled);
        setPct(showPct(x.rule.pctBp));
        setRoundTo(x.rule.roundTo);
        setMode(x.rule.roundMode);
        setGp(Object.fromEntries(x.groups.map((g) => [g.id, showPct(g.pctBp)])));
        setPreview(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const pctBp = parsePct(pct) ?? 0;
  const groupChanges = useMemo(
    () => (d ? d.groups.filter((g) => parsePct(gp[g.id] ?? "") !== g.pctBp).map((g) => ({ id: g.id, pctBp: parsePct(gp[g.id] ?? "") })) : []),
    [d, gp],
  );
  const dirty = !!d && (enabled !== d.rule.enabled || pctBp !== d.rule.pctBp || roundTo !== d.rule.roundTo || mode !== d.rule.roundMode || groupChanges.length > 0);

  // درصد مؤثر هر گروه با ارث (برای نمایش)
  const effective = useMemo(() => {
    const out = new Map<string, number>();
    if (!d) return out;
    const byId = new Map(d.groups.map((g) => [g.id, g]));
    for (const g of d.groups) {
      let cur: (typeof d.groups)[number] | undefined = g;
      let bp: number | null = null;
      const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        bp = parsePct(gp[cur.id] ?? "");
        if (bp !== null) break;
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      out.set(g.id, bp ?? pctBp);
    }
    return out;
  }, [d, gp, pctBp]);

  async function send(commit: boolean) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await api<{ preview?: Data["pending"]; applied?: { changed: number; products: number } }>("/api/admin/accounting/items/online-prices", {
        method: "PATCH",
        json: { enabled, pctBp, roundTo, roundMode: mode, groups: groupChanges, commit },
      });
      if (r.preview) setPreview(r.preview);
      if (r.applied) {
        setNote(enabled ? `ذخیره شد — ${faNum(r.applied.changed)} قیمت در ${faNum(r.applied.products)} محصول سایت عوض شد` : "ذخیره شد — قیمت آنلاین خاموش است و قیمتی عوض نشد");
        load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function dropOverride(id: string) {
    setError(null);
    try {
      await api(`/api/admin/accounting/items/${id}`, { method: "PATCH", json: { onlinePrice: null } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    }
  }

  const manage = !!d?.can.manage;
  const list = preview ?? (dirty ? null : d?.pending ?? null);
  const sample = 450_000n;

  return (
    <div>
      <PageHeader
        title="کالا و انبار"
        help="accountingOnlinePrice"
        desc="قیمت فروشگاه همان قیمت کالاست (صندوق و فاکتور). قیمت سایت از روی آن ساخته می‌شود: یک درصد کلی، درصد جدا برای هر گروه، یا قیمت دستی برای یک کالا."
      />
      <InventoryTabs />
      {!d ? (
        error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <SectionTitle title="قاعده‌ی کلی" help="accountingOnlinePrice" />
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={enabled} disabled={!manage} onChange={(e) => setEnabled(e.target.checked)} className="mt-1 h-5 w-5 accent-blue-600" />
              <span>
                <span className="block text-sm font-black">قیمت سایت از قیمت فروشگاه ساخته شود</span>
                <span className="block text-[11px] leading-5 text-gray-500">
                  روشن: قیمت محصول و تنوع‌های سایتِ هر کالای قیمت‌دار از قاعده‌ی زیر می‌آید و با هر تغییر قیمت فروشگاه خودش به‌روز می‌شود. خاموش: قیمت سایت دستی است و دست نمی‌خورد.
                </span>
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="درصد نسبت به قیمت فروشگاه" hint="منفی = ارزان‌تر؛ مثلاً −۱۰">
                <input value={pct} onChange={(e) => setPct(e.target.value)} disabled={!manage} className={`${inputCls} text-left`} dir="ltr" placeholder="0" />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[-10, -5, 0, 5, 10].map((p) => (
                    <button key={p} type="button" disabled={!manage} onClick={() => setPct(String(p))} className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold dark:bg-white/5">
                      {pctText(p * 100)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="گرد کردن">
                <select value={roundTo} disabled={!manage} onChange={(e) => setRoundTo(Number(e.target.value))} className={inputCls}>
                  {[0, 100, 500, 1000, 5000, 10000, 50000].map((r) => (
                    <option key={r} value={r}>
                      {r ? `به ${formatAmount(r)} تومان` : "گرد نشود"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="جهت گرد کردن">
                <select value={mode} disabled={!manage || !roundTo} onChange={(e) => setMode(e.target.value as RoundMode)} className={inputCls}>
                  <option value="down">رو به پایین</option>
                  <option value="nearest">نزدیک‌ترین</option>
                  <option value="up">رو به بالا</option>
                </select>
              </Field>
            </div>
            <p className="rounded-xl bg-blue-500/5 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300">
              نمونه: قیمت فروشگاه {formatAmount(sample)} ← سایت {formatAmount(applyRule(sample, pctBp, roundTo, mode))} تومان
            </p>
          </Card>

          {d.groups.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 pt-4">
                <SectionTitle title="درصد هر گروه" />
                <p className="-mt-1 mb-3 text-[11px] text-gray-500">خالی = مثل گروه بالاتر، یا قاعده‌ی کلی. زیرگروه‌ها درصد گروه بالاتر را می‌گیرند مگر خودشان درصد داشته باشند.</p>
              </div>
              <div className="max-h-[420px] divide-y divide-[var(--adm-border)] overflow-y-auto">
                {d.groups.map((g) => {
                  const own = parsePct(gp[g.id] ?? "");
                  return (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{g.path}</span>
                      <span className="text-[11px] text-gray-400">{faNum(g.items)} کالا</span>
                      <input
                        value={gp[g.id] ?? ""}
                        disabled={!manage}
                        onChange={(e) => setGp((x) => ({ ...x, [g.id]: e.target.value }))}
                        placeholder={showPct(effective.get(g.id) ?? 0) || "0"}
                        className={`${inputCls} !w-24 !py-1.5 text-left ${own !== null ? "!border-blue-400" : ""}`}
                        dir="ltr"
                      />
                      <span className={`w-20 text-left text-xs font-black ${own !== null ? "text-blue-600" : "text-gray-400"}`}>{pctText(effective.get(g.id) ?? 0)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {manage && (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => send(false)} disabled={busy} className={btn.soft}>
                پیش‌نمایش تغییرها
              </button>
              <button onClick={() => send(true)} disabled={busy || (!dirty && !(d.pending.total && enabled))} className={btn.primary}>
                {busy ? "…" : dirty ? "ذخیره و اعمال روی سایت" : "اعمال روی سایت"}
              </button>
              {dirty && <span className="text-[11px] font-bold text-amber-600">تغییرها هنوز ذخیره نشده</span>}
            </div>
          )}
          <ErrorText>{error}</ErrorText>
          {note && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10">{note}</p>}

          {list && (
            <Card className="overflow-hidden">
              <div className="px-4 pt-4">
                <SectionTitle
                  title={
                    list.total
                      ? `${preview ? "با این قاعده" : enabled ? "قیمت‌هایی که هنوز با قاعده نمی‌خواند" : "اگر روشن کنید"}: ${faNum(list.total)} قیمت در ${faNum(list.products)} محصول عوض می‌شود`
                      : "قیمت سایت همه‌ی کالاهای وصل با قاعده یکی است"
                  }
                />
              </div>
              {list.total > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                      <tr>
                        <th className="px-3 py-2 text-right">کالا</th>
                        <th className="px-3 py-2 text-left">فروشگاه</th>
                        <th className="px-3 py-2 text-right">قاعده</th>
                        <th className="px-3 py-2 text-left">سایت الان</th>
                        <th className="px-3 py-2 text-left">سایت تازه</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-border)]">
                      {list.rows.map((r) => {
                        const up = BigInt(r.next) > BigInt(r.current);
                        return (
                          <tr key={`${r.productId}:${r.itemId}`}>
                            <td className="px-3 py-2">
                              <span className="block max-w-[18rem] truncate font-bold">{r.title}</span>
                              <span className="text-[11px] text-gray-400">{r.code}</span>
                            </td>
                            <td className="px-3 py-2 text-left tabular-nums">{formatAmount(r.store)}</td>
                            <td className="px-3 py-2 text-xs">{r.manual ? <Badge tone="amber">دستی</Badge> : <span className="text-gray-500">{pctText(r.pctBp)}{r.source ? ` · ${r.source}` : ""}</span>}</td>
                            <td className="px-3 py-2 text-left tabular-nums text-gray-400 line-through">{formatAmount(r.current)}</td>
                            <td className={`px-3 py-2 text-left font-black tabular-nums ${up ? "text-amber-600" : "text-emerald-600"}`}>{formatAmount(r.next)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {list.total > list.rows.length && <p className="px-4 py-2 text-[11px] text-gray-400">{faNum(list.total - list.rows.length)} ردیف دیگر هم هست.</p>}
                </div>
              )}
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="px-4 pt-4">
              <SectionTitle title="قیمت آنلاین دستی" />
              <p className="-mt-1 mb-2 text-[11px] text-gray-500">برای یک کالای تکی، در فرم همان کالا («موجودی» ← کالا ← ویرایش) «قیمت آنلاین دستی» را بنویسید؛ جای درصد را می‌گیرد.</p>
            </div>
            {!d.overrides.length ? (
              <Empty title="کالایی قیمت آنلاین دستی ندارد" />
            ) : (
              <div className="divide-y divide-[var(--adm-border)]">
                {d.overrides.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <Link href={`/admin/accounting/inventory/${o.id}`} className="min-w-0 flex-1 truncate font-bold hover:text-blue-600">
                      {o.title} <span className="text-[11px] text-gray-400">{o.code}</span>
                    </Link>
                    <span className="text-xs text-gray-400 tabular-nums">فروشگاه {formatAmount(o.salePrice ?? 0)}</span>
                    <span className="font-black tabular-nums">{formatAmount(o.onlinePrice)}</span>
                    {manage && (
                      <button onClick={() => dropOverride(o.id)} className="text-xs font-bold text-red-600">
                        برداشتن
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
