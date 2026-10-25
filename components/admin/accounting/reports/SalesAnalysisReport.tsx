"use client";

/**
 * تحلیل فروش کالا — docs/plans/webhesab-parity.md بخش ۵.
 * سطر «بر اساس» (گروه، کالا، مدل، عرضه‌کننده، رنگ/سایز، مشخصه، انبار، کانال، صندوق، فروشنده، ماه)،
 * ستون اختیاری (انبار، ماه، کانال). کلیک روی هر سطر یا خانه ← پنجره‌ی جزئیات: کالاهای پشت آن عدد
 * (لینک کاردکس) و فاکتورها (لینک فاکتور و شخص).
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { faNum, toLatinDigits } from "@/lib/accounting/money";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { formatJalali } from "@/lib/club/jalali";
import { btn, Card, inputCls, Segmented, Sheet } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

interface Cell {
  qty: number;
  revenue: string;
}
interface Row {
  key: string;
  label: string;
  soldQty: number;
  returnQty: number;
  netQty: number;
  revenue: string;
  cost: string | null;
  profit: string | null;
  marginBp: number | null;
  shareBp: number;
  stock: number | null;
  cells: Record<string, Cell> | null;
}
interface Data {
  rows: Row[];
  columns: { key: string; label: string }[];
  totals: { soldQty: number; returnQty: number; netQty: number; revenue: string; cost: string | null; stock: number | null };
  costs: boolean;
  stock: boolean;
  dims: { axes: { id: string; name: string }[]; specs: string[] };
  suppliers: { id: string; name: string }[];
  groups: { id: string; name: string; parentId: string | null }[];
  warehouses: { id: string; name: string }[];
}
interface Detail {
  label: string;
  colLabel: string | null;
  items: { productId: string | null; label: string; netQty: number; revenue: string; stock: number | null }[];
  lines: { invoiceId: string; type: "SALES" | "SALES_RETURN"; number: number | null; date: string; partyId: string; partyName: string; productId: string | null; title: string; qty: number; revenue: string }[];
  lineCount: number;
}

const FIXED: { value: string; label: string }[] = [
  { value: "group", label: "گروه کالا" },
  { value: "group1", label: "گروه اصلی" },
  { value: "item", label: "کالا" },
  { value: "model", label: "مدل" },
  { value: "supplier", label: "عرضه‌کننده" },
  { value: "warehouse", label: "انبار" },
  { value: "channel", label: "کانال فروش" },
  { value: "terminal", label: "صندوق" },
  { value: "seller", label: "فروشنده" },
  { value: "month", label: "ماه" },
];
const COLS = [
  { value: "", label: "بی‌ستون" },
  { value: "warehouse", label: "به تفکیک انبار" },
  { value: "month", label: "به تفکیک ماه" },
  { value: "channel", label: "به تفکیک کانال" },
];
/** بُعدهایی که «فقط همین» معنا دارد — فیلتر گزارش می‌شوند */
const FILTERABLE: Record<string, "groupId" | "warehouseId" | "supplierId"> = { group: "groupId", group1: "groupId", warehouse: "warehouseId", supplier: "supplierId" };

const pct = (bp: number | null) => (bp === null ? "—" : `${(bp / 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`);
const NONE = "_none";

function groupOptions(groups: Data["groups"]) {
  const out: { id: string; label: string }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const g of groups.filter((x) => x.parentId === parent)) {
      out.push({ id: g.id, label: `${"— ".repeat(depth)}${g.name}` });
      walk(g.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default function SalesAnalysisReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [by, setBy] = useState("group");
  const [col, setCol] = useState("");
  const [f, setF] = useState({ groupId: "", warehouseId: "", supplierId: "" });
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<{ row: Row; cell: string | null } | null>(null);
  const params = { from: range.from, to: range.to, by, col, ...f };
  const { data, error, loading } = useReport<Data>("sales", params);

  const dimLabel =
    FIXED.find((x) => x.value === by)?.label ??
    (by.startsWith("axis:") ? data?.dims.axes.find((a) => `axis:${a.id}` === by)?.name : by.startsWith("spec:") ? by.slice(5) : null) ??
    "سطر";
  const rows = useMemo(() => {
    const t = toLatinDigits(q.trim()).toLowerCase();
    return (data?.rows ?? []).filter((r) => !t || toLatinDigits(r.label).toLowerCase().includes(t));
  }, [data, q]);
  const cols = col ? (data?.columns ?? []) : [];

  function exportCsv() {
    if (!data) return;
    const head = [dimLabel, ...(cols.length ? cols.map((c) => c.label) : []), "فروخته", "برگشتی", "خالص", "فروش خالص (تومان)", "سهم ٪", "میانگین قیمت"];
    if (data.costs) head.push("بهای تمام‌شده", "سود", "درصد سود");
    if (data.stock) head.push("موجودی فعلی", "نرخ فروش ٪");
    downloadCsv(`sales-by-${by.replace(":", "-")}${col ? `-${col}` : ""}`, head, rows.map((r) => [
      r.label,
      ...cols.map((c) => r.cells?.[c.key]?.qty ?? 0),
      r.soldQty,
      r.returnQty,
      r.netQty,
      r.revenue,
      r.shareBp / 100,
      r.netQty > 0 ? (BigInt(r.revenue) / BigInt(r.netQty)).toString() : "",
      ...(data.costs ? [r.cost, r.profit, r.marginBp === null ? "" : r.marginBp / 100] : []),
      ...(data.stock ? [r.stock, sellThrough(r) ?? ""] : []),
    ]));
  }

  const open = (row: Row, cell: string | null = null) => setDetail({ row, cell });
  const totalMargin = data?.costs && data.totals.cost !== null && BigInt(data.totals.revenue) > 0n ? Number(((BigInt(data.totals.revenue) - BigInt(data.totals.cost)) * 10_000n) / BigInt(data.totals.revenue)) : null;

  return (
    <ReportFrame
      title="تحلیل فروش کالا"
      help="accountingSalesAnalysis"
      desc="فروش خالص (بعد از تخفیف، بی مالیات، منهای برگشتی) به تفکیک هر چه بخواهید. روی هر سطر یا عدد بزنید تا کالاها و فاکتورهای پشتش را ببینید."
      printSub={`${rangeText(range)} — بر اساس ${dimLabel}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <RangeBar value={range} onChange={setRange} />
          <div className="flex flex-wrap gap-2">
            <select value={by} onChange={(e) => setBy(e.target.value)} className={`${inputCls} w-auto`} aria-label="بر اساس">
              <optgroup label="بر اساس">
                {FIXED.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              {!!data?.dims.axes.length && (
                <optgroup label="ویژگی (رنگ، سایز، …)">
                  {data.dims.axes.map((a) => (
                    <option key={a.id} value={`axis:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {!!data?.dims.specs.length && (
                <optgroup label="مشخصه‌ی مدل">
                  {data.dims.specs.map((s) => (
                    <option key={s} value={`spec:${s}`}>
                      {s}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <select value={col} onChange={(e) => setCol(e.target.value)} className={`${inputCls} w-auto`} aria-label="ستون‌ها">
              {COLS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {!!data?.groups.length && (
              <select value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })} className={`${inputCls} w-auto`} aria-label="گروه">
                <option value="">همه‌ی گروه‌ها</option>
                {groupOptions(data.groups).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            )}
            {(data?.warehouses.length ?? 0) > 1 && (
              <select value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })} className={`${inputCls} w-auto`} aria-label="انبار">
                <option value="">همه‌ی انبارها</option>
                {data!.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
            {!!data?.suppliers.length && (
              <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })} className={`${inputCls} w-auto`} aria-label="عرضه‌کننده">
                <option value="">همه‌ی عرضه‌کننده‌ها</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`جستجو در ${dimLabel}`} className={`${inputCls} flex-1 min-w-[9rem]`} />
          </div>
        </>
      }
    >
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">فروش خالص</p>
              <p className="text-lg mt-1">
                <Amt v={data.totals.revenue} strong />
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">تعداد خالص</p>
              <p className="text-lg mt-1 font-black tabular-nums">{faNum(data.totals.netQty)}</p>
              <p className="text-[11px] text-gray-400">
                {faNum(data.totals.soldQty)} فروخته · {faNum(data.totals.returnQty)} برگشتی
              </p>
            </Card>
            {data.costs && (
              <Card className="p-4">
                <p className="text-[11px] text-gray-500">سود ناخالص</p>
                <p className="text-lg mt-1">
                  <Amt v={(BigInt(data.totals.revenue) - BigInt(data.totals.cost ?? "0")).toString()} strong />
                </p>
                <p className="text-[11px] text-gray-400">{pct(totalMargin)} از فروش</p>
              </Card>
            )}
            {data.stock && (
              <Card className="p-4">
                <p className="text-[11px] text-gray-500">موجودی فعلی همین سطرها</p>
                <p className="text-lg mt-1 font-black tabular-nums">{faNum(data.totals.stock ?? 0)}</p>
              </Card>
            )}
          </div>

          <Table
            head={
              <tr>
                <th className={th}>{dimLabel}</th>
                {cols.map((c) => (
                  <th key={c.key} className={thNum}>
                    {c.label}
                  </th>
                ))}
                {!cols.length && (
                  <>
                    <th className={thNum}>فروخته</th>
                    <th className={thNum}>برگشتی</th>
                  </>
                )}
                <th className={thNum}>خالص</th>
                <th className={thNum}>فروش خالص</th>
                <th className={thNum}>سهم</th>
                {!cols.length && <th className={thNum}>میانگین قیمت</th>}
                {data.costs && !cols.length && (
                  <>
                    <th className={thNum}>سود</th>
                    <th className={thNum}>درصد سود</th>
                  </>
                )}
                {data.stock && (
                  <>
                    <th className={thNum}>موجودی</th>
                    <th className={thNum} title="خالص فروش ÷ (خالص فروش + موجودی)">
                      نرخ فروش
                    </th>
                  </>
                )}
              </tr>
            }
            foot={
              <tr>
                <td className={td}>جمع</td>
                {cols.map((c) => (
                  <td key={c.key} className={`${tdNum} tabular-nums`}>
                    {faNum(rows.reduce((s, r) => s + (r.cells?.[c.key]?.qty ?? 0), 0))}
                  </td>
                ))}
                {!cols.length && (
                  <>
                    <td className={`${tdNum} tabular-nums`}>{faNum(data.totals.soldQty)}</td>
                    <td className={`${tdNum} tabular-nums`}>{faNum(data.totals.returnQty)}</td>
                  </>
                )}
                <td className={`${tdNum} tabular-nums`}>{faNum(data.totals.netQty)}</td>
                <td className={tdNum}>
                  <Amt v={data.totals.revenue} strong />
                </td>
                <td className={tdNum}>۱۰۰٪</td>
                {!cols.length && <td className={tdNum} />}
                {data.costs && !cols.length && (
                  <>
                    <td className={tdNum}>
                      <Amt v={(BigInt(data.totals.revenue) - BigInt(data.totals.cost ?? "0")).toString()} strong />
                    </td>
                    <td className={tdNum}>{pct(totalMargin)}</td>
                  </>
                )}
                {data.stock && (
                  <>
                    <td className={`${tdNum} tabular-nums`}>{faNum(data.totals.stock ?? 0)}</td>
                    <td className={tdNum} />
                  </>
                )}
              </tr>
            }
          >
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} max-w-[20rem]`}>
                  <button onClick={() => open(r)} className="block max-w-full truncate text-right font-bold text-blue-700 dark:text-blue-300 hover:underline" title="کالاها و فاکتورهای این سطر">
                    {r.label}
                  </button>
                  <RowLinks by={by} row={r} />
                </td>
                {cols.map((c) => {
                  const v = r.cells?.[c.key];
                  return (
                    <td key={c.key} className={`${tdNum} tabular-nums`}>
                      {v?.qty ? (
                        <button onClick={() => open(r, c.key)} className={`hover:underline ${v.qty < 0 ? "text-red-600" : "text-blue-700 dark:text-blue-300"}`} title="جزئیات این خانه">
                          {faNum(v.qty)}
                        </button>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">۰</span>
                      )}
                    </td>
                  );
                })}
                {!cols.length && (
                  <>
                    <td className={`${tdNum} tabular-nums`}>{faNum(r.soldQty)}</td>
                    <td className={`${tdNum} tabular-nums ${r.returnQty ? "text-red-600" : "text-gray-300 dark:text-gray-600"}`}>{faNum(r.returnQty)}</td>
                  </>
                )}
                <td className={`${tdNum} tabular-nums font-bold`}>{faNum(r.netQty)}</td>
                <td className={tdNum}>
                  <Amt v={r.revenue} />
                </td>
                <td className={`${tdNum} w-28`}>
                  <span className="flex items-center gap-1.5 justify-end">
                    <span className="text-[11px] tabular-nums text-gray-500">{pct(r.shareBp)}</span>
                    <span className="h-1.5 w-12 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" aria-hidden>
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, r.shareBp / 100))}%` }} />
                    </span>
                  </span>
                </td>
                {!cols.length && <td className={tdNum}>{r.netQty > 0 ? <Amt v={(BigInt(r.revenue) / BigInt(r.netQty)).toString()} muted /> : "—"}</td>}
                {data.costs && !cols.length && (
                  <>
                    <td className={tdNum}>
                      <Amt v={r.profit} strong />
                    </td>
                    <td className={`${tdNum} tabular-nums ${r.marginBp !== null && r.marginBp < 0 ? "text-red-600" : ""}`}>{pct(r.marginBp)}</td>
                  </>
                )}
                {data.stock && (
                  <>
                    <td className={`${tdNum} tabular-nums`}>{faNum(r.stock ?? 0)}</td>
                    <td className={`${tdNum} tabular-nums text-gray-500`}>{sellThrough(r) === null ? "—" : `${sellThrough(r)!.toLocaleString("fa-IR")}٪`}</td>
                  </>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={12}>
                  در این بازه و با این فیلترها فروشی نیست.
                </td>
              </tr>
            )}
          </Table>
          <p className="text-[11px] text-gray-400 leading-5">
            «نرخ فروش» = فروش خالص ÷ (فروش خالص + موجودی فعلی) — هرچه بیشتر، کالا زودتر تمام می‌شود. عرضه‌کننده‌ی کالایی که در فرم کالا خالی است از
            آخرین فاکتور خرید می‌آید. کرایه و مالیات در این گزارش نیستند.
          </p>
        </>
      )}

      {detail && data && (
        <DetailSheet
          params={{ ...params, row: detail.row.key, cell: detail.cell }}
          title={detail.row.label}
          onClose={() => setDetail(null)}
          filterKey={detail.row.key !== NONE ? FILTERABLE[by] : undefined}
          onOnly={() => {
            const k = FILTERABLE[by];
            if (!k) return;
            setF({ ...f, [k]: detail.row.key });
            setBy("item");
            setDetail(null);
          }}
        />
      )}
    </ReportFrame>
  );
}

function sellThrough(r: Row): number | null {
  if (r.stock === null || r.netQty <= 0) return null;
  const all = r.netQty + Math.max(0, r.stock);
  return all ? Math.round((r.netQty / all) * 100) : null;
}

/** پیوند مستقیم به صفحه‌ی خودِ سطر، اگر صفحه دارد */
function RowLinks({ by, row }: { by: string; row: Row }) {
  if (row.key === NONE) return null;
  const link = by === "item" ? { href: `/admin/accounting/inventory/${row.key}`, label: "کاردکس" } : by === "supplier" ? { href: `/admin/accounting/parties/${row.key}`, label: "صورت‌حساب" } : null;
  if (!link) return null;
  return (
    <Link href={link.href} className="text-[10px] font-bold text-gray-400 hover:text-blue-600">
      {link.label} ←
    </Link>
  );
}

function DetailSheet({
  params,
  title,
  onClose,
  filterKey,
  onOnly,
}: {
  params: Record<string, string | null>;
  title: string;
  onClose: () => void;
  filterKey?: string;
  onOnly: () => void;
}) {
  const [tab, setTab] = useState<"items" | "lines">("items");
  const { data, error, loading } = useReport<{ detail: Detail }>("sales", params);
  const d = data?.detail;

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={d?.colLabel ? `${title} — ${d.colLabel}` : title}
      footer={
        filterKey && (
          <button onClick={onOnly} className={`${btn.soft} w-full`}>
            کل گزارش فقط برای «{title}»، به تفکیک کالا
          </button>
        )
      }
    >
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {loading && !d && <p className="text-xs text-gray-400">در حال بارگذاری…</p>}
      {d && (
        <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "items", label: `کالاها (${faNum(d.items.length)})` },
              { value: "lines", label: `فاکتورها (${faNum(d.lineCount)})` },
            ]}
          />
          {tab === "items" ? (
            <div className="divide-y divide-gray-100 dark:divide-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
              {d.items.map((it, i) => (
                <div key={it.productId ?? `s${i}`} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex-1 min-w-0">
                    {it.productId ? (
                      <Link href={`/admin/accounting/inventory/${it.productId}`} className="block truncate text-sm font-bold text-blue-700 dark:text-blue-300 hover:underline">
                        {it.label}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-bold">{it.label}</span>
                    )}
                    {it.stock !== null && <span className="text-[11px] text-gray-400">موجودی فعلی {faNum(it.stock)}</span>}
                  </span>
                  <span className="text-sm font-black tabular-nums">{faNum(it.netQty)}</span>
                  <span className="w-28 text-left text-xs">
                    <Amt v={it.revenue} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                {d.lines.map((l, i) => (
                  <div key={`${l.invoiceId}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-bold">{l.title}</span>
                      <span className="block text-[11px] text-gray-400">
                        <Link href={`/admin/accounting/invoices/${l.invoiceId}`} className="font-bold text-blue-600 hover:underline">
                          {l.type === "SALES" ? "فاکتور" : "برگشت"} {l.number ? faNum(l.number) : ""}
                        </Link>
                        {" · "}
                        {formatJalali(new Date(l.date))}
                        {" · "}
                        <Link href={`/admin/accounting/parties/${l.partyId}`} className="hover:text-blue-600 hover:underline">
                          {l.partyName}
                        </Link>
                      </span>
                    </span>
                    <span className={`text-sm font-black tabular-nums ${l.qty < 0 ? "text-red-600" : ""}`}>{faNum(l.qty)}</span>
                    <span className="w-28 text-left text-xs">
                      <Amt v={l.revenue} />
                    </span>
                  </div>
                ))}
              </div>
              {d.lineCount > d.lines.length && <p className="text-[11px] text-gray-400">تازه‌ترین {faNum(d.lines.length)} ردیف از {faNum(d.lineCount)} نشان داده شد.</p>}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
