"use client";

/**
 * حذف و فعال/غیرفعال دسته‌ای کالا — docs/plans/webhesab-parity.md بخش ۱۲.
 * دو ورودی: کالاهای تیک‌خورده‌ی فهرست (`ids`) یا فهرست کد از اکسل/چسباندن (`ids` خالی).
 * حذف فقط کالای بی‌گردش را پاک می‌کند؛ گردش‌دارها به‌جایش غیرفعال می‌شوند.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { api, Badge, btn, ErrorText, Field, inputCls, Sheet } from "../ui";

type UseKey = "moves" | "invoices" | "transfers" | "adjusts" | "counts" | "stock" | "product" | "legacy" | "relabel" | "orders";
const USE_LABEL: Record<UseKey, string> = {
  moves: "کاردکس",
  invoices: "فاکتور",
  transfers: "حواله",
  adjusts: "ورود/خروج دستی",
  counts: "انبارگردانی",
  stock: "موجودی",
  product: "محصول سایت",
  legacy: "کد قبلی",
  relabel: "برچسب‌زنی",
  orders: "سفارش خرید",
};
interface Plan {
  free: { id: string; code: string; title: string }[];
  used: { id: string; code: string; title: string; isActive: boolean; uses: UseKey[] }[];
  withStock: number;
  active: number;
  inactive: number;
}
type Action = "activate" | "deactivate" | "delete";

const CODE_RE = /کد|code|بارکد|barcode|sku/i;
const SHOW = 100;

export default function ItemStatusSheet({ ids, onClose, onDone }: { ids: string[] | null; onClose: () => void; onDone: () => void }) {
  const byCodes = ids === null;
  const [itemIds, setItemIds] = useState<string[]>(ids ?? []);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [resolved, setResolved] = useState<{ unknown: string[]; expanded: { code: string; items: number }[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [list, setList] = useState<"free" | "used" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // فهرست کد
  const [file, setFile] = useState<{ sheets: { rows: string[][] }[] } | null>(null);
  const [col, setCol] = useState(0);
  const [paste, setPaste] = useState("");
  const head = file?.sheets[0]?.rows[0] ?? [];
  const codes = useMemo(() => {
    if (paste.trim()) return paste.split(/\r?\n/).map((l) => l.split("\t")[0].trim()).filter(Boolean);
    if (!file) return [];
    // سطر اول اگر سرستون است (کد نیست) رد می‌شود
    const rows = file.sheets[0].rows;
    return rows.slice(CODE_RE.test(rows[0]?.[col] ?? "") ? 1 : 0).map((r) => (r[col] ?? "").trim()).filter(Boolean);
  }, [paste, file, col]);

  useEffect(() => {
    if (byCodes) return;
    api<Plan>("/api/admin/accounting/items/status", { method: "POST", json: { action: "check", ids } })
      .then(setPlan)
      .catch((e) => setError(e.message));
  }, [byCodes, ids]);

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/accounting/import/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "فایل خوانده نشد");
      setFile(j);
      setPaste("");
      const h: string[] = j.sheets[0]?.rows[0] ?? [];
      setCol(Math.max(0, h.findIndex((x) => CODE_RE.test(x.trim()))));
      setPlan(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل خوانده نشد");
    } finally {
      setBusy(false);
    }
  }

  async function find() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api<{ ids: string[]; unknown: string[]; expanded: { code: string; items: number }[]; plan: Plan | null }>("/api/admin/accounting/items/status", {
        method: "POST",
        json: { action: "codes", codes },
      });
      setItemIds(r.ids);
      setPlan(r.plan);
      setResolved({ unknown: r.unknown, expanded: r.expanded });
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: Action) {
    if (action === "delete" && !confirm) return setConfirm(true);
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ changed: number; deleted: number; deactivated: number }>("/api/admin/accounting/items/status", {
        method: "POST",
        json: { action, ids: itemIds },
      });
      setMsg(
        action === "delete"
          ? [r.deleted && `${faNum(r.deleted)} کالا پاک شد`, r.deactivated && `${faNum(r.deactivated)} کالای گردش‌دار غیرفعال شد`].filter(Boolean).join("، ") || "تغییری لازم نبود"
          : r.changed
            ? `${faNum(r.changed)} کالا ${action === "activate" ? "فعال" : "غیرفعال"} شد`
            : "تغییری لازم نبود",
      );
      setPlan(null);
      setItemIds([]);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  const n = plan ? plan.free.length + plan.used.length : 0;
  const deactivatedByDelete = plan?.used.filter((u) => u.isActive).length ?? 0;
  const rows: Plan["used"] = !plan || !list ? [] : list === "used" ? plan.used : plan.free.map((f) => ({ ...f, isActive: true, uses: [] }));

  return (
    <Sheet open onClose={onClose} title={byCodes ? "فعال، غیرفعال یا حذف با فهرست کد" : `${faNum(ids.length)} کالای انتخاب‌شده`} help="accountingItemStatus" wide>
      <div className="space-y-4">
        {byCodes && (
          <div className="space-y-3">
            <p className="text-xs leading-6 text-gray-500">
              فایل اکسل یا CSV با ستون کد کالا (کد، بارکد یا کد قبلی). کد مدل همه‌ی رنگ و سایزهای آن مدل را می‌گیرد.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`${btn.soft} cursor-pointer`}>
                {busy && !file ? "در حال خواندن…" : "انتخاب فایل (xlsx یا csv)"}
                <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              {file && head.length > 1 && (
                <select value={col} onChange={(e) => setCol(Number(e.target.value))} className={`${inputCls} !w-auto`} aria-label="ستون کد">
                  {head.map((h, k) => (
                    <option key={k} value={k}>
                      {h || `ستون ${faNum(k + 1)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Field label="یا چسباندن" hint="هر خط یک کد">
              <textarea
                value={paste}
                onChange={(e) => {
                  setPaste(e.target.value);
                  setPlan(null);
                }}
                rows={4}
                dir="ltr"
                className={`${inputCls} font-mono text-xs`}
                placeholder={"110023-01\n110023-02"}
              />
            </Field>
            <button onClick={find} disabled={busy || !codes.length} className={btn.soft}>
              پیدا کردن کالاها {codes.length ? `(${faNum(codes.length)} کد)` : ""}
            </button>
            {resolved && (
              <div className="space-y-1 text-xs">
                {resolved.unknown.length > 0 && (
                  <p className="text-red-600">
                    {faNum(resolved.unknown.length)} کد پیدا نشد: <span dir="ltr">{resolved.unknown.slice(0, 30).join("، ")}</span>
                    {resolved.unknown.length > 30 && "…"}
                  </p>
                )}
                {resolved.expanded.length > 0 && (
                  <p className="text-gray-500">
                    کد مدل: {resolved.expanded.slice(0, 10).map((x) => `${x.code} ← ${faNum(x.items)} کالا`).join("، ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {!byCodes && !plan && !error && !msg && <p className="text-sm text-gray-400">در حال بررسی گردش کالاها…</p>}

        {plan && n > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button onClick={() => setList(list === "free" ? null : "free")} className="rounded-2xl border border-[var(--adm-border)] p-3 text-right">
                <span className="block text-xl font-black tabular-nums">{faNum(plan.free.length)}</span>
                <span className="text-xs text-gray-500">بی‌گردش — پاک‌شدنی</span>
              </button>
              <button onClick={() => setList(list === "used" ? null : "used")} className="rounded-2xl border border-[var(--adm-border)] p-3 text-right">
                <span className="block text-xl font-black tabular-nums">{faNum(plan.used.length)}</span>
                <span className="text-xs text-gray-500">گردش‌دار — فقط غیرفعال</span>
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {faNum(plan.active)} فعال، {faNum(plan.inactive)} غیرفعال
            </p>
            {plan.withStock > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {faNum(plan.withStock)} کالا هنوز موجودی دارد. غیرفعال کردن موجودی را صفر نمی‌کند؛ اگر کالا واقعاً نیست، اول با{" "}
                <Link href="/admin/accounting/inventory/adjustments" className="font-bold underline">
                  خروج دستی
                </Link>{" "}
                یا انبارگردانی صفرش کنید.
              </p>
            )}

            {list && (
              <div className="max-h-72 divide-y divide-[var(--adm-border)] overflow-y-auto rounded-2xl border border-[var(--adm-border)]">
                {rows.slice(0, SHOW).map((r) => (
                  <Link key={r.id} href={`/admin/accounting/inventory/${r.id}`} target="_blank" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                    <span className="min-w-0 flex-1 truncate">
                      {r.title} <span className="text-[11px] text-gray-400" dir="ltr">{r.code}</span>
                    </span>
                    {list === "used" && (
                      <span className="flex flex-wrap justify-end gap-1">
                        {!r.isActive && <Badge>غیرفعال</Badge>}
                        {r.uses.map((u) => (
                          <Badge key={u} tone={u === "stock" ? "amber" : "gray"}>
                            {USE_LABEL[u]}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </Link>
                ))}
                {rows.length > SHOW && (
                  <p className="px-3 py-2 text-[11px] text-gray-400">{faNum(rows.length - SHOW)} کالای دیگر</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {plan.inactive > 0 && (
                <button onClick={() => run("activate")} disabled={busy} className={btn.soft}>
                  فعال کردن {faNum(plan.inactive)}
                </button>
              )}
              {plan.active > 0 && (
                <button onClick={() => run("deactivate")} disabled={busy} className={btn.soft}>
                  غیرفعال کردن {faNum(plan.active)}
                </button>
              )}
              {(plan.free.length > 0 || deactivatedByDelete > 0) && (
                <button onClick={() => run("delete")} disabled={busy} className={confirm ? btn.danger : btn.soft}>
                  {confirm
                    ? `مطمئنم — ${faNum(plan.free.length)} کالا برای همیشه پاک شود${deactivatedByDelete ? ` و ${faNum(deactivatedByDelete)} غیرفعال` : ""}`
                    : plan.free.length
                      ? `حذف ${faNum(plan.free.length)} کالای بی‌گردش${deactivatedByDelete ? ` + غیرفعال ${faNum(deactivatedByDelete)}` : ""}`
                      : `حذف (همه گردش دارند: غیرفعال ${faNum(deactivatedByDelete)})`}
                </button>
              )}
            </div>
            {confirm && <p className="text-xs text-red-600">پاک کردن برگشت ندارد. کالای گردش‌دار پاک نمی‌شود و فقط غیرفعال می‌شود.</p>}
          </div>
        )}
        {plan && n === 0 && <p className="text-sm text-gray-400">کالایی پیدا نشد.</p>}
        {msg && <p className="text-sm font-bold text-emerald-600">{msg}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
