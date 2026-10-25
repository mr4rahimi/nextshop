"use client";

/**
 * ورود و خروج دستی کالا — docs/plans/webhesab-parity.md بخش ۷.
 * فهرست با فیلتر جهت و دلیل (هر ردیف ← صفحه‌ی سند)، فرم ثبت (اسکن، چسباندن از اکسل) و دلیل‌ها.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, Settings2 } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, toLatinDigits } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import ProductPicker, { type ProductOption } from "../ProductPicker";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import AccountPicker, { type AccountOption } from "../AccountPicker";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet } from "../ui";

type Dir = "IN" | "OUT";
interface Reason {
  id: string;
  name: string;
  direction: Dir;
  accountId: string;
  isActive: boolean;
  sortOrder: number;
  account: { id: string; code: string; name: string; detailKind: "NONE" | "PARTY" | "TREASURY" } | null;
}
interface W {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}
interface Doc {
  id: string;
  number: number;
  date: string;
  direction: Dir;
  status: "POSTED" | "VOID";
  note: string | null;
  warehouseId: string;
  createdByName: string;
  reason: { id: string; name: string };
  lineCount: number;
  units: number;
}

export const DIR_LABEL: Record<Dir, string> = { IN: "ورود", OUT: "خروج" };

export default function AdjustmentsClient() {
  const [data, setData] = useState<{ items: Doc[]; warehouses: W[]; can: { manage: boolean } } | null>(null);
  const [reasons, setReasons] = useState<{ list: Reason[]; can: { manage: boolean; account: boolean } } | null>(null);
  const [dir, setDir] = useState<"" | Dir>("");
  const [reasonId, setReasonId] = useState("");
  const [form, setForm] = useState<Dir | null>(null);
  const [editReasons, setEditReasons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (dir) p.set("direction", dir);
    if (reasonId) p.set("reasonId", reasonId);
    api<{ items: Doc[]; warehouses: W[]; can: { manage: boolean } }>(`/api/admin/accounting/inventory/adjustments?${p}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [dir, reasonId]);
  const loadReasons = useCallback(() => {
    api<{ reasons: Reason[]; can: { manage: boolean; account: boolean } }>("/api/admin/accounting/inventory/adjustments/reasons?all=1")
      .then((d) => setReasons({ list: d.reasons, can: d.can }))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  useEffect(loadReasons, [loadReasons]);

  const whName = (id: string) => data?.warehouses.find((w) => w.id === id)?.name ?? "—";
  const shown = (reasons?.list ?? []).filter((r) => !dir || r.direction === dir);

  return (
    <div className="space-y-4">
      <PageHeader
        title="کالا و انبار"
        help="accountingAdjustments"
        actions={
          data?.can.manage && (
            <>
              <button onClick={() => setForm("OUT")} className={btn.primary}>
                <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                خروج کالا
              </button>
              <button onClick={() => setForm("IN")} className={btn.soft}>
                <ArrowDownToLine className="h-4 w-4" aria-hidden />
                ورود کالا
              </button>
              <button onClick={() => setEditReasons(true)} className={btn.soft} title="دلیل‌های ورود و خروج">
                <Settings2 className="h-4 w-4" aria-hidden />
                دلیل‌ها
              </button>
            </>
          )
        }
      />
      <InventoryTabs />
      <div className="flex flex-wrap items-center gap-2">
        <Chips<"" | Dir>
          value={dir}
          onChange={(d) => (setDir(d), setReasonId(""))}
          options={[
            { value: "", label: "همه" },
            { value: "OUT", label: "خروج" },
            { value: "IN", label: "ورود" },
          ]}
        />
        {shown.length > 1 && (
          <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} className={`${inputCls} w-auto`} aria-label="دلیل">
            <option value="">همه‌ی دلیل‌ها</option>
            {shown.map((r) => (
              <option key={r.id} value={r.id}>
                {DIR_LABEL[r.direction]} — {r.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <ErrorText>{error}</ErrorText>

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((d) => (
          <Link key={d.id} href={`/admin/accounting/inventory/adjustments/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${d.status === "VOID" ? "line-through text-gray-400" : ""}`}>
                {DIR_LABEL[d.direction]} {faNum(d.number)} — {d.reason.name}
              </span>
              <span className="block text-[11px] text-gray-400 mt-0.5">
                {formatJalali(new Date(d.date))} · {whName(d.warehouseId)} · {faNum(d.units)} عدد از {faNum(d.lineCount)} کالا · {d.createdByName}
                {d.note ? ` · ${d.note}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <Badge tone={d.direction === "IN" ? "green" : "amber"}>{DIR_LABEL[d.direction]}</Badge>
              {d.status === "VOID" && <Badge tone="red">باطل</Badge>}
            </span>
          </Link>
        ))}
        {data && !data.items.length && (
          <Empty title="هنوز ورود و خروج دستی ثبت نشده" desc="کالایی که مصرف داخلی شد، خراب شد، هدیه رفت یا بی‌فاکتور به انبار آمد را اینجا با دلیلش ثبت کنید؛ سند حسابداری‌اش خودکار است." />
        )}
      </Card>

      {form && data && reasons && (
        <AdjustForm
          direction={form}
          reasons={reasons.list.filter((r) => r.isActive && r.direction === form)}
          warehouses={data.warehouses.filter((w) => w.isActive)}
          onClose={() => setForm(null)}
          onSaved={(id) => (window.location.href = `/admin/accounting/inventory/adjustments/${id}`)}
          onReasons={() => setEditReasons(true)}
        />
      )}
      {editReasons && reasons && <ReasonsSheet reasons={reasons.list} can={reasons.can} onClose={() => setEditReasons(false)} onChanged={loadReasons} />}
    </div>
  );
}

// ── فرم ثبت ────────────────────────────────────────────────────────────────

interface Line {
  id: string;
  title: string;
  code: string;
  qty: string;
  /** موجودی همین انبار — فقط برای کالای انتخابی (چسبانده‌ها ندارند) */
  byWarehouse: Record<string, number> | null;
}

function AdjustForm({
  direction,
  reasons,
  warehouses,
  onClose,
  onSaved,
  onReasons,
}: {
  direction: Dir;
  reasons: Reason[];
  warehouses: W[];
  onClose: () => void;
  onSaved: (id: string) => void;
  onReasons: () => void;
}) {
  const [reasonId, setReasonId] = useState(reasons[0]?.id ?? "");
  const [wh, setWh] = useState(warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "");
  const [date, setDate] = useState(dayValue(todayKey()));
  const [party, setParty] = useState<PartyOption | null>(null);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [paste, setPaste] = useState<string | null>(null);
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = reasons.find((r) => r.id === reasonId);
  const needParty = reason?.account?.detailKind === "PARTY";
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  function merge(add: { id: string; title: string; code: string; qty: number; byWarehouse: Record<string, number> | null }[]) {
    setLines((x) => {
      const out = [...x];
      for (const a of add) {
        const i = out.findIndex((l) => l.id === a.id);
        if (i >= 0) out[i] = { ...out[i], qty: String((Number(out[i].qty) || 0) + a.qty), byWarehouse: out[i].byWarehouse ?? a.byWarehouse };
        else out.push({ id: a.id, title: a.title, code: a.code, qty: String(a.qty), byWarehouse: a.byWarehouse });
      }
      return out;
    });
  }
  const pick = (p: ProductOption) => merge([{ id: p.id, title: p.title, code: p.sku ?? "", qty: 1, byWarehouse: p.byWarehouse }]);

  async function resolvePaste() {
    if (!paste?.trim()) return;
    setPasteMsg(null);
    try {
      const r = await api<{ lines: { productId: string; qty: number; title: string; code: string }[]; unknown: string[]; ambiguous: string[]; invalid: string[] }>(
        "/api/admin/accounting/inventory/adjustments/resolve",
        { method: "POST", json: { text: paste } },
      );
      merge(r.lines.map((l) => ({ id: l.productId, title: l.title, code: l.code, qty: l.qty, byWarehouse: null })));
      const bad = [
        r.unknown.length ? `ناشناخته: ${r.unknown.slice(0, 20).join("، ")}` : "",
        r.ambiguous.length ? `کد قبلی چندرنگ/سایز (با اسکن انتخاب کنید): ${r.ambiguous.slice(0, 20).join("، ")}` : "",
        r.invalid.length ? `تعداد نامعتبر: ${r.invalid.slice(0, 20).join("، ")}` : "",
      ].filter(Boolean);
      setPasteMsg(`✓ ${faNum(r.lines.length)} کالا اضافه شد.${bad.length ? ` ${bad.join(" · ")}` : ""}`);
      setPaste(bad.length ? paste : null);
    } catch (e) {
      setPasteMsg(e instanceof Error ? e.message : "خوانده نشد");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/api/admin/accounting/inventory/adjustments", {
        method: "POST",
        json: { date, direction, reasonId, warehouseId: wh, partyId: party?.id ?? null, note, lines: lines.map((l) => ({ productId: l.id, qty: Number(l.qty) })) },
      });
      onSaved(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={direction === "OUT" ? "خروج کالا" : "ورود کالا"}
      help="accountingAdjustments"
      footer={
        <button onClick={save} disabled={busy || !lines.length || !reasonId || (needParty && !party)} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : `ثبت ${DIR_LABEL[direction]} (${faNum(total)} عدد)`}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="دلیل"
            hint={
              <button type="button" onClick={onReasons} className="text-blue-600 font-bold">
                دلیل تازه یا ویرایش ←
              </button>
            }
          >
            <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} className={inputCls}>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="انبار">
            <select value={wh} onChange={(e) => setWh(e.target.value)} className={inputCls}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاریخ">
            <JalaliDatePicker value={date} onChange={setDate} />
          </Field>
          <Field label={needParty ? "شخص (لازم)" : "شخص (اختیاری)"} hint={needParty ? `سرفصل «${reason?.account?.name}» شخص می‌خواهد` : "مثلاً کارمندی که کالا را برد"}>
            <PartyPicker value={party} onChange={setParty} compact />
          </Field>
        </div>
        <Field label="کالاها" hint="بارکد را اسکن کنید یا نام/کد را بنویسید؛ هر اسکن یک عدد اضافه می‌کند">
          <ProductPicker onPick={pick} warehouseId={wh} autoFocus />
        </Field>
        {paste === null ? (
          <button type="button" onClick={() => setPaste("")} className={btn.small}>
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            چسباندن از اکسل
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-gray-200 dark:border-white/10 p-3">
            <p className="text-[11px] text-gray-500">ستون اول کد کالا، ستون دوم تعداد (نبود = یک عدد). از اکسل کپی کنید و اینجا بچسبانید.</p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} dir="ltr" className={`${inputCls} font-mono text-xs`} />
            <div className="flex gap-2">
              <button type="button" onClick={resolvePaste} className={btn.small}>
                افزودن به فهرست
              </button>
              <button type="button" onClick={() => (setPaste(null), setPasteMsg(null))} className="text-xs text-gray-500 px-2">
                بستن
              </button>
            </div>
          </div>
        )}
        {pasteMsg && <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{pasteMsg}</p>}
        <div className="space-y-2">
          {lines.map((l) => {
            const avail = l.byWarehouse ? (l.byWarehouse[wh] ?? 0) : null;
            const over = direction === "OUT" && avail !== null && (Number(l.qty) || 0) > avail;
            return (
              <div key={l.id} className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{l.title}</span>
                  <span className={`block text-[11px] ${over ? "text-red-600 font-bold" : "text-gray-400"}`}>
                    {l.code}
                    {avail !== null && ` · موجودی انبار ${faNum(avail)}`}
                  </span>
                </span>
                <input
                  value={l.qty}
                  onChange={(e) => setLines((x) => x.map((y) => (y.id === l.id ? { ...y, qty: toLatinDigits(e.target.value).replace(/\D/g, "") } : y)))}
                  inputMode="numeric"
                  aria-label="تعداد"
                  className="w-20 px-2 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-center font-bold"
                />
                <button onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))} className="text-gray-400 hover:text-red-600 px-1" aria-label="حذف ردیف">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <Field label="توضیح (اختیاری)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder={direction === "OUT" ? "مثلاً: مصرف ویترین مهر" : "مثلاً: نمونه‌ی رایگان تأمین‌کننده"} />
        </Field>
        <p className="text-[11px] text-gray-400 leading-5">
          {direction === "OUT"
            ? `کالا با میانگین بها از انبار کم می‌شود و همین مبلغ به «${reason?.account?.name ?? "سرفصل دلیل"}» می‌رود.`
            : `کالا با میانگین بهای فعلی به انبار اضافه می‌شود و طرف مقابلش «${reason?.account?.name ?? "سرفصل دلیل"}» است. کالای خریداری‌شده را با فاکتور خرید ثبت کنید، نه اینجا.`}
        </p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ── دلیل‌ها ─────────────────────────────────────────────────────────────────

function ReasonsSheet({ reasons, can, onClose, onChanged }: { reasons: Reason[]; can: { manage: boolean; account: boolean }; onClose: () => void; onChanged: () => void }) {
  const [dir, setDir] = useState<Dir>("OUT");
  const [name, setName] = useState("");
  const [account, setAccount] = useState<AccountOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => reasons.filter((r) => r.direction === dir), [reasons, dir]);

  async function save(body: Record<string, unknown>) {
    setError(null);
    try {
      await api("/api/admin/accounting/inventory/adjustments/reasons", { method: "POST", json: body });
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
      return false;
    }
  }

  return (
    <Sheet open onClose={onClose} title="دلیل‌های ورود و خروج" help="accountingAdjustments">
      <div className="space-y-4">
        <Segmented<Dir> value={dir} onChange={setDir} options={[{ value: "OUT", label: "خروج" }, { value: "IN", label: "ورود" }]} />
        <div className="divide-y divide-gray-100 dark:divide-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
          {list.map((r) => (
            <ReasonRow key={`${r.id}:${r.name}:${r.accountId}`} r={r} can={can} onSave={(b) => save({ id: r.id, ...b })} />
          ))}
          {!list.length && <p className="px-3 py-6 text-center text-xs text-gray-400">دلیلی نیست.</p>}
        </div>
        {can.manage && (
          <div className="space-y-2 rounded-2xl bg-gray-50 dark:bg-white/5 p-3">
            <p className="text-xs font-black text-gray-600 dark:text-gray-300">دلیل تازه‌ی {DIR_LABEL[dir]}</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: نمایش در ویترین" className={inputCls} />
            {can.account && (
              <Field label="سرفصل طرف مقابل" hint="خالی = «کسری و اضافات انبار»">
                <AccountPicker value={account} onChange={setAccount} compact />
              </Field>
            )}
            <button
              onClick={async () => {
                if (await save({ name, direction: dir, accountId: account?.id })) {
                  setName("");
                  setAccount(null);
                }
              }}
              disabled={!name.trim()}
              className={btn.small}
            >
              + افزودن
            </button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        <p className="text-[11px] text-gray-400 leading-5">
          هر دلیل یک سرفصل دارد که مبلغ کالا به آن می‌رود (خروج بدهکار، ورود بستانکار). عوض کردن سرفصل مجوز «تنظیمات حسابداری» می‌خواهد و فقط روی سندهای بعدی اثر دارد.
        </p>
      </div>
    </Sheet>
  );
}

function ReasonRow({ r, can, onSave }: { r: Reason; can: { manage: boolean; account: boolean }; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(r.name);
  const [acc, setAcc] = useState<AccountOption | null>(r.account ? { id: r.account.id, code: r.account.code, name: r.account.name, detailKind: r.account.detailKind } : null);
  return (
    <div className="px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2">
        {can.manage ? (
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== r.name && onSave({ name })} className={`${inputCls} flex-1`} aria-label="نام دلیل" />
        ) : (
          <span className="flex-1 text-sm font-bold">{r.name}</span>
        )}
        {can.manage && (
          <button onClick={() => onSave({ isActive: !r.isActive })} className={btn.small}>
            {r.isActive ? "غیرفعال" : "فعال کن"}
          </button>
        )}
      </div>
      {can.account ? (
        <AccountPicker
          value={acc}
          compact
          onChange={async (a) => {
            setAcc(a);
            if (a && a.id !== r.accountId && !(await onSave({ accountId: a.id }))) setAcc(r.account ? { ...r.account } : null);
          }}
        />
      ) : (
        <p className="text-[11px] text-gray-400">
          سرفصل: {r.account ? `${faNum(r.account.code)} ${r.account.name}` : "—"}
          {!r.isActive && " · غیرفعال"}
        </p>
      )}
    </div>
  );
}
