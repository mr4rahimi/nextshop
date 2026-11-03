"use client";

/**
 * شماره سریال کالا — docs/plans/webhesab-parity.md بخش ۱۴.
 * فهرست و جستجوی سریال، سابقه‌ی هر سریال، و ثبت سریال برای موجودی بی‌سریال (تکی، چسباندن از اکسل،
 * فایل، ساخت ترتیبی مثل وب حساب).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { faNum } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import InventoryTabs from "./InventoryTabs";
import ProductPicker from "../ProductPicker";
import { splitSerials } from "./SerialField";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet } from "../ui";

type Status = "all" | "IN_STOCK" | "TRANSIT" | "OUT";
const STATUS: Record<string, { label: string; tone: "green" | "amber" | "gray" }> = {
  IN_STOCK: { label: "در انبار", tone: "green" },
  TRANSIT: { label: "در راه", tone: "amber" },
  OUT: { label: "خارج‌شده", tone: "gray" },
  NEW: { label: "بی‌گردش", tone: "gray" },
};
const MOVE: Record<string, string> = {
  REGISTER: "ثبت برای موجودی",
  PURCHASE: "خرید",
  SALE: "فروش",
  SALE_RETURN: "برگشت از فروش",
  PURCHASE_RETURN: "برگشت از خرید",
  ADJUST_IN: "ورود دستی",
  ADJUST_OUT: "خروج دستی",
  TRANSFER_OUT: "حواله — خروج",
  TRANSFER_IN: "حواله — ورود",
};

interface Row {
  id: string;
  serial: string;
  status: string;
  warehouseId: string | null;
  warehouseName: string | null;
  lastType: string | null;
  lastDate: string | null;
  partyId: string | null;
  partyName: string | null;
  item: { id: string; code: string; title: string };
}
interface Data {
  warehouses: { id: string; name: string }[];
  item: { id: string; code: string; title: string; hasSerial: boolean; warrantyDays: number | null } | null;
  summary: { inStock: number; transit: number; out: number; warehouses: { warehouseId: string; name: string; qty: number; serials: number }[] } | null;
  rows: Row[];
  total: number;
  capped: boolean;
  counts: Record<string, number>;
  can: { edit: boolean };
}
interface History {
  serial: { id: string; serial: string; status: string; warehouseName: string | null; item: { id: string; code: string; title: string; warrantyDays: number | null } };
  guaranty: { endDate: string; auto: boolean } | null;
  moves: { id: string; date: string; type: string; label: string; warehouseName: string | null; party: { id: string; name: string } | null; doc: { label: string; href: string | null }; createdByName: string }[];
}

export default function SerialsClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const itemId = sp.get("itemId") ?? "";
  const warehouseId = sp.get("w") ?? "";
  const status = (sp.get("status") as Status) || "all";
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reg, setReg] = useState(false);

  const setParam = useCallback(
    (k: string, v: string | null) => {
      const p = new URLSearchParams(sp.toString());
      if (v) p.set(k, v);
      else p.delete(k);
      router.replace(`${pathname}?${p}`);
    },
    [sp, router, pathname],
  );

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (sp.get("q")) p.set("q", sp.get("q")!);
    if (itemId) p.set("itemId", itemId);
    if (warehouseId) p.set("warehouseId", warehouseId);
    if (status !== "all") p.set("status", status);
    api<Data>(`/api/admin/accounting/serials?${p}`)
      .then((x) => {
        setD(x);
        setError(null);
        // سریال دقیق (اسکن) ← پنجره‌ی سابقه
        const term = sp.get("q")?.trim().toUpperCase();
        if (term && x.rows.length === 1 && x.rows[0].serial === term) setOpenId(x.rows[0].id);
      })
      .catch((e) => setError(e.message));
  }, [sp, itemId, warehouseId, status]);
  useEffect(load, [load]);

  useEffect(() => {
    const h = window.setTimeout(() => {
      if ((sp.get("q") ?? "") !== q.trim()) setParam("q", q.trim() || null);
    }, 300);
    return () => window.clearTimeout(h);
  }, [q, sp, setParam]);

  const count = (s: string) => d?.counts[s] ?? 0;
  const all = Object.values(d?.counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="شماره سریال کالا"
        help="accountingSerials"
        desc="هر واحد کالای سریال‌دار: کی آمد، کجاست، به چه کسی فروخته شد. سریال در خرید، فروش، صندوق، حواله و ورود و خروج دستی ثبت می‌شود."
        actions={
          d?.can.edit && d.item?.hasSerial ? (
            <button onClick={() => setReg(true)} className={btn.primary}>
              + ثبت سریال برای موجودی
            </button>
          ) : undefined
        }
      />
      <InventoryTabs />

      <Card className="mb-4 space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_200px]">
          <Field label="جستجو" hint="شماره سریال (اسکن)، نام یا کد کالا">
            <input value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} font-mono`} placeholder="مثلاً 3569…" autoFocus />
          </Field>
          <Field label="کالا">
            {d?.item ? (
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                <Link href={`/admin/accounting/inventory/${d.item.id}`} className="min-w-0 flex-1 truncate font-bold text-blue-600 hover:underline">
                  {d.item.title} <span className="text-[11px] text-gray-400">({faNum(d.item.code)})</span>
                </Link>
                {!d.item.hasSerial && <Badge tone="amber">سریال‌دار نیست</Badge>}
                <button onClick={() => setParam("itemId", null)} className="text-gray-400 hover:text-red-600" aria-label="برداشتن کالا">
                  ✕
                </button>
              </div>
            ) : (
              <ProductPicker onPick={(p) => setParam("itemId", p.id)} placeholder="همه‌ی کالاها — انتخاب یک کالا" />
            )}
          </Field>
          <Field label="انبار">
            <select value={warehouseId} onChange={(e) => setParam("w", e.target.value || null)} className={inputCls}>
              <option value="">همه</option>
              {d?.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Chips
          value={status}
          onChange={(v) => setParam("status", v === "all" ? null : v)}
          options={[
            { value: "all", label: "همه", count: all },
            { value: "IN_STOCK", label: "در انبار", count: count("IN_STOCK") },
            { value: "TRANSIT", label: "در راه", count: count("TRANSIT") },
            { value: "OUT", label: "خارج‌شده", count: count("OUT") },
          ]}
        />
      </Card>

      {d?.item && d.summary && (
        <Card className="mb-4 p-4">
          <p className="mb-2 text-xs font-bold text-gray-500">
            موجودی و سریال «{d.item.title}»{d.item.warrantyDays ? ` · گارانتی ${faNum(d.item.warrantyDays)} روز` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {d.summary.warehouses.map((w) => {
              const gap = w.qty - w.serials;
              return (
                <button
                  key={w.warehouseId}
                  onClick={() => {
                    setParam("w", w.warehouseId);
                  }}
                  className="rounded-xl bg-gray-50 px-3 py-2 text-right text-xs hover:bg-blue-50 dark:bg-white/5 dark:hover:bg-blue-500/10"
                >
                  <span className="block font-black text-gray-800 dark:text-gray-100">{w.name}</span>
                  <span className="tabular-nums text-gray-500">
                    کاردکس {faNum(w.qty)} · سریال‌دار {faNum(w.serials)}
                  </span>
                  {gap > 0 && <span className="block font-bold text-amber-600">{faNum(gap)} عدد بی‌سریال</span>}
                  {gap < 0 && <span className="block font-bold text-red-600">{faNum(-gap)} سریال بیش از موجودی</span>}
                </button>
              );
            })}
            {!d.summary.warehouses.length && <p className="text-xs text-gray-400">موجودی ندارد.</p>}
          </div>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      {!d ? (
        <p className="p-6 text-center text-sm text-gray-400">…</p>
      ) : !d.rows.length ? (
        <Empty
          title="سریالی پیدا نشد"
          desc={d.item && !d.item.hasSerial ? "این کالا سریال‌دار نیست؛ در کارت کالا «سریال‌دار» را روشن کنید." : "سریال با فاکتور خرید، صندوق، حواله یا «ثبت سریال برای موجودی» ساخته می‌شود."}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-right">سریال</th>
                  {!d.item && <th className="px-3 py-2 text-right">کالا</th>}
                  <th className="px-3 py-2 text-right">وضعیت</th>
                  <th className="px-3 py-2 text-right">انبار</th>
                  <th className="px-3 py-2 text-right">آخرین گردش</th>
                  <th className="px-3 py-2 text-right">طرف حساب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {d.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <button onClick={() => setOpenId(r.id)} className="font-mono font-bold text-blue-600 hover:underline" dir="ltr">
                        {r.serial}
                      </button>
                    </td>
                    {!d.item && (
                      <td className="px-3 py-2">
                        <Link href={`/admin/accounting/inventory/${r.item.id}`} className="hover:underline">
                          {r.item.title}
                        </Link>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Badge tone={STATUS[r.status]?.tone ?? "gray"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{r.warehouseName ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {r.lastType ? MOVE[r.lastType] ?? r.lastType : "—"}
                      {r.lastDate && <span className="mr-1 tabular-nums">{formatJalali(new Date(r.lastDate))}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.partyId ? (
                        <Link href={`/admin/accounting/parties/${r.partyId}`} className="text-blue-600 hover:underline">
                          {r.partyName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.capped && <p className="border-t border-gray-100 p-2 text-center text-[11px] text-gray-400 dark:border-white/5">{faNum(d.rows.length)} از {faNum(d.total)} — برای دیدن بقیه جستجو یا فیلتر کنید.</p>}
        </Card>
      )}

      {openId && <HistorySheet id={openId} canEdit={!!d?.can.edit} onClose={() => setOpenId(null)} onChanged={load} />}
      {reg && d?.item && (
        <RegisterSheet
          item={d.item}
          warehouses={d.warehouses}
          summary={d.summary}
          defaultWarehouse={warehouseId || d.summary?.warehouses.find((w) => w.qty > w.serials)?.warehouseId || d.warehouses[0]?.id || ""}
          onClose={() => setReg(false)}
          onDone={() => {
            setReg(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function HistorySheet({ id, canEdit, onClose, onChanged }: { id: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [h, setH] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<History>(`/api/admin/accounting/serials?id=${id}`)
      .then(setH)
      .catch((e) => setError(e.message));
  }, [id]);
  const onlyRegister = !!h && h.moves.every((m) => m.type === "REGISTER");
  async function remove() {
    if (!window.confirm("این سریال پاک شود؟ (فقط برای سریالی که اشتباه ثبت شده)")) return;
    setBusy(true);
    try {
      await api("/api/admin/accounting/serials", { method: "POST", json: { action: "delete", id } });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "پاک نشد");
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={h ? <span dir="ltr" className="font-mono">{h.serial.serial}</span> : "سریال"}
      help="accountingSerials"
      footer={
        canEdit && onlyRegister ? (
          <button onClick={remove} disabled={busy} className={btn.danger}>
            پاک کردن سریال
          </button>
        ) : undefined
      }
    >
      <ErrorText>{error}</ErrorText>
      {!h ? (
        <p className="text-sm text-gray-400">…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/admin/accounting/inventory/${h.serial.item.id}`} className="font-bold text-blue-600 hover:underline">
              {h.serial.item.title}
            </Link>
            <Badge tone={STATUS[h.serial.status]?.tone ?? "gray"}>{STATUS[h.serial.status]?.label ?? h.serial.status}</Badge>
            {h.serial.warehouseName && <span className="text-xs text-gray-500">{h.serial.warehouseName}</span>}
          </div>
          {h.guaranty && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              🛡️ گارانتی {h.guaranty.auto ? "خودکار" : "دستی"} تا {formatJalali(new Date(h.guaranty.endDate))} —{" "}
              <Link href={`/admin/guaranty?search=${encodeURIComponent(h.serial.serial)}`} className="font-bold underline">
                گارانتی‌ها
              </Link>
            </p>
          )}
          <ol className="relative space-y-3 border-r-2 border-gray-100 pr-4 dark:border-white/10">
            {h.moves.map((m) => (
              <li key={m.id} className="relative">
                <span className="absolute -right-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 dark:border-[#111620]" />
                <p className="text-sm font-bold">
                  {m.label}
                  {m.doc.href ? (
                    <Link href={m.doc.href} className="mr-1.5 text-xs font-bold text-blue-600 hover:underline">
                      {m.doc.label}
                    </Link>
                  ) : null}
                </p>
                <p className="text-[11px] text-gray-500">
                  <span className="tabular-nums">{formatJalali(new Date(m.date))}</span>
                  {m.warehouseName && ` · ${m.warehouseName}`}
                  {m.party && (
                    <>
                      {" · "}
                      <Link href={`/admin/accounting/parties/${m.party.id}`} className="text-blue-600 hover:underline">
                        {m.party.name}
                      </Link>
                    </>
                  )}
                  {` · ${m.createdByName}`}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Sheet>
  );
}

function RegisterSheet({
  item,
  warehouses,
  summary,
  defaultWarehouse,
  onClose,
  onDone,
}: {
  item: NonNullable<Data["item"]>;
  warehouses: Data["warehouses"];
  summary: Data["summary"];
  defaultWarehouse: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"list" | "seq">("list");
  const [w, setW] = useState(defaultWarehouse);
  const [text, setText] = useState("");
  const [seq, setSeq] = useState({ prefix: "", from: "", to: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = splitSerials(text);
  const room = (() => {
    const r = summary?.warehouses.find((x) => x.warehouseId === w);
    return r ? Math.max(0, r.qty - r.serials) : 0;
  })();
  const seqCount = (() => {
    const a = Number(seq.from.replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x))));
    const b = Number(seq.to.replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x))));
    return Number.isInteger(a) && Number.isInteger(b) && b >= a && seq.from && seq.to ? b - a + 1 : 0;
  })();
  const n = mode === "list" ? list.length : seqCount;

  async function upload(f: File) {
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/accounting/import/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "فایل خوانده نشد");
      const rows: string[][] = j.sheets[0]?.rows ?? [];
      const col = Math.max(0, (rows[0] ?? []).findIndex((h) => /سریال|serial/i.test(h)));
      const hasHead = /سریال|serial/i.test(rows[0]?.[col] ?? "");
      const vals = rows.slice(hasHead ? 1 : 0).map((r) => r[col] ?? "").filter((x) => x.trim());
      setText((t) => [t.trim(), ...vals].filter(Boolean).join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل خوانده نشد");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/accounting/serials", {
        method: "POST",
        json: { action: "register", itemId: item.id, warehouseId: w, ...(mode === "list" ? { serials: list } : { seq }) },
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`ثبت سریال — ${item.title}`}
      help="accountingSerials"
      footer={
        <button onClick={save} disabled={busy || !n || !w} className={`${btn.primary} w-full`}>
          ثبت {faNum(n)} سریال
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-6 text-gray-500">
          برای کالایی که بی‌سریال وارد شده (اول دوره، خرید قبلی). سریال‌ها «در انبار» می‌شوند و از موجودی کاردکس همان انبار بیشتر نمی‌شوند. خرید تازه سریالش را در خود فاکتور خرید می‌گیرد.
        </p>
        <Field label="انبار" hint={`جای خالی برای سریال: ${faNum(room)} عدد بی‌سریال`}>
          <select value={w} onChange={(e) => setW(e.target.value)} className={inputCls}>
            {warehouses.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "list", label: "فهرست / اکسل" },
            { value: "seq", label: "ساخت ترتیبی" },
          ]}
        />
        {mode === "list" ? (
          <>
            <Field label="شماره سریال‌ها" hint="هر خط یکی — ستون سریال را از اکسل کپی کنید یا با بارکدخوان پشت‌سرهم اسکن کنید">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} dir="ltr" className={`${inputCls} font-mono`} />
            </Field>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-blue-600">
              📄 خواندن از فایل اکسل (ستون «سریال»، وگرنه ستون اول)
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Field label="بخش حرفی">
              <input value={seq.prefix} onChange={(e) => setSeq({ ...seq, prefix: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" placeholder="IM" />
            </Field>
            <Field label="از شماره">
              <input value={seq.from} onChange={(e) => setSeq({ ...seq, from: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" inputMode="numeric" placeholder="0001" />
            </Field>
            <Field label="تا شماره">
              <input value={seq.to} onChange={(e) => setSeq({ ...seq, to: e.target.value })} className={`${inputCls} font-mono`} dir="ltr" inputMode="numeric" placeholder="0050" />
            </Field>
            <p className="col-span-3 text-[11px] text-gray-500" dir="ltr">
              {seqCount > 0 ? `${seq.prefix.toUpperCase()}${seq.from} … ${seq.prefix.toUpperCase()}${seq.to}` : ""}
            </p>
          </div>
        )}
        {n > room && <p className="text-xs font-bold text-amber-600">{faNum(n)} سریال از {faNum(room)} عدد بی‌سریال این انبار بیشتر است؛ ثبت نمی‌شود.</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
