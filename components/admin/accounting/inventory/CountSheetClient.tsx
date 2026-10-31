"use client";

/**
 * برگه‌ی انبارگردانی — docs/plans/inventory-items.md بخش ۱۵. برای گوشی و بارکدخوان.
 *
 * «شمارش»: هر اسکن در سرور اتمی اضافه می‌شود (چند گوشی هم‌زمان)، با بخش/قفسه و
 * تعداد هر اسکن؛ کد قبلی چندرنگ/سایز پنجره‌ی رنگ × سایز باز می‌کند.
 * «بازبینی»: فیلتر اختلاف/شمرده‌نشده/بخش، اصلاح عدد، خروجی CSV.
 * «ورود از فایل»: چسباندن ستون کد و تعداد از اکسل.
 * شمارنده‌ی کور (فقط ACC_STOCK_COUNT) عدد دفتری و اختلاف را نمی‌بیند.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Download, ListChecks, RotateCcw, ScanBarcode, Undo2, Upload } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount, toLatinDigits } from "@/lib/accounting/money";
import ModelPicker from "../pos/ModelPicker";
import { beep, local, type ModelPick, type PosItem } from "../pos/shared";
import { api, Badge, btn, Card, Chips, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet, Stat } from "../ui";

interface Row {
  productId: string;
  title: string;
  code: string;
  counted: number;
  recount: number | null;
  final: number;
  book: number | null;
  diff: number | null;
  zone: string | null;
  place: string | null;
  uncounted: boolean;
  value: string | null;
  updatedAt: string | null;
}
interface Summary {
  lines: number;
  units: number;
  diffLines: number;
  shortageUnits: number;
  surplusUnits: number;
  shortageValue: string | null;
  surplusValue: string | null;
  uncounted: number;
  uncountedUnits: number;
  zones: { zone: string; lines: number; units: number }[];
}
interface Data {
  count: {
    id: string;
    number: number;
    date: string;
    status: "DRAFT" | "POSTED" | "VOID";
    note: string | null;
    scope: "PARTIAL" | "FULL";
    round: number;
    applyTo: "ADJUST" | "OPENING";
    voucherId: string | null;
    voidReason: string | null;
    postedByName: string | null;
  };
  warehouse: { id: string; name: string } | null;
  group: { id: string; name: string } | null;
  rows: Row[];
  summary: Summary;
  entries: { id: string; productId: string; title: string; qty: number; zone: string | null; createdAt: string }[];
  can: { count: boolean; manage: boolean; costs: boolean; blind: boolean; opening: boolean; openingWhy: string | null };
}
interface LineView {
  productId: string;
  countedQty: number;
  recountQty: number | null;
  final: number;
  zone: string | null;
}
type ScanReply =
  | { kind: "added"; line: LineView; title: string; code: string }
  | { kind: "model"; pick: ModelPick }
  | { kind: "list"; items: PosItem[] };

type Tab = "count" | "review" | "import";
type Filter = "all" | "diff" | "uncounted" | "recount";

const PAGE = 300;

export default function CountSheetClient({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("count");
  const [busy, setBusy] = useState(false);
  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/inventory/counts/${id}?entries=1`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  // بعد از چند اسکن پشت سر هم یک بار کامل خوانده می‌شود (خلاصه و اختلاف‌ها)
  const loadSoon = useCallback(() => {
    if (refresh.current) clearTimeout(refresh.current);
    refresh.current = setTimeout(load, 2500);
  }, [load]);

  /** ردیف را بی خواندن دوباره‌ی کل برگه به‌روز می‌کند */
  const patchRow = useCallback((line: LineView | null, productId: string, meta?: { title: string; code: string }) => {
    setData((d) => {
      if (!d) return d;
      const i = d.rows.findIndex((r) => r.productId === productId);
      if (!line) return { ...d, rows: d.rows.filter((r) => r.productId !== productId || r.uncounted) };
      const base = i >= 0 ? d.rows[i] : { productId, title: meta?.title ?? "", code: meta?.code ?? "", book: null, diff: null, value: null, place: null, uncounted: false, updatedAt: null };
      const next: Row = {
        ...base,
        uncounted: false,
        counted: line.countedQty,
        recount: line.recountQty,
        final: line.final,
        zone: line.zone,
        diff: base.book === null ? null : line.final - base.book,
        updatedAt: new Date().toISOString(),
      };
      const rows = i >= 0 ? d.rows.map((r, k) => (k === i ? next : r)) : [next, ...d.rows];
      return { ...d, rows };
    });
  }, []);

  async function act(action: "fill" | "recount" | "void", extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/inventory/counts/${id}`, { method: "POST", json: { action, ...extra } });
      if (action === "void" && data?.count.status === "DRAFT") {
        window.location.href = "/admin/accounting/inventory/counts";
        return;
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const [posting, setPosting] = useState(false);

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const { count, summary, can } = data;
  const draft = count.status === "DRAFT";
  const scopeLabel = `${count.scope === "FULL" ? "کل انبار" : "فقط کالاهای شمرده‌شده"}${data.group ? ` · گروه ${data.group.name}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`انبارگردانی ${faNum(count.number)} — ${data.warehouse?.name ?? ""}`}
        help="accountingCounts"
        desc={`${formatJalali(new Date(count.date))} · ${scopeLabel}${count.note ? ` · ${count.note}` : ""}`}
        back={{ href: "/admin/accounting/inventory/counts", label: "انبارگردانی‌ها" }}
      />

      {!draft && (
        <Card className="p-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={count.status === "POSTED" ? "green" : "red"}>{count.status === "POSTED" ? "ثبت شد" : "باطل"}</Badge>
          {count.status === "POSTED" && count.applyTo === "OPENING" && <Badge tone="blue">روی موجودی اول دوره</Badge>}
          {count.postedByName && <span className="text-xs text-gray-500">ثبت: {count.postedByName}</span>}
          {count.voucherId && (
            <a href={`/admin/accounting/vouchers/${count.voucherId}`} className="text-xs font-bold text-blue-600">
              دیدن سند حسابداری ←
            </a>
          )}
          {count.voidReason && <span className="text-xs text-red-600">{count.voidReason}</span>}
        </Card>
      )}
      {draft && count.round === 2 && (
        <Card className="p-3 text-sm font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10">
          شمارش دوم: فقط کالاهای اختلاف‌دار را دوباره بشمارید. عدد شمارش دوم جای شمارش اول را می‌گیرد.
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="شمرده‌شده" value={faNum(summary.lines)} sub={`${faNum(summary.units)} عدد`} />
        {!can.blind && (
          <>
            <Stat label="دارای اختلاف" value={faNum(summary.diffLines)} tone={summary.diffLines ? "amber" : "gray"} />
            <Stat
              label="کسری / اضافی"
              value={`${faNum(summary.shortageUnits)} / ${faNum(summary.surplusUnits)}`}
              sub={can.costs && summary.shortageValue !== null ? `${formatAmount(summary.shortageValue)} / ${formatAmount(summary.surplusValue)} تومان` : "عدد"}
              tone={summary.shortageUnits ? "red" : "gray"}
            />
            <Stat
              label="شمرده‌نشده"
              value={faNum(summary.uncounted)}
              sub={count.scope === "FULL" ? `در ثبت صفر می‌شوند (${faNum(summary.uncountedUnits)} عدد)` : "دست نمی‌خورند"}
              tone={summary.uncounted && count.scope === "FULL" ? "red" : "gray"}
            />
          </>
        )}
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ...(draft && can.count ? [{ value: "count" as Tab, label: "شمارش" }] : []),
          { value: "review" as Tab, label: "بازبینی" },
          ...(draft && can.manage ? [{ value: "import" as Tab, label: "ورود از فایل" }] : []),
        ]}
      />

      {tab === "count" && draft && can.count ? (
        <CountTab data={data} id={id} onLine={patchRow} onChanged={loadSoon} />
      ) : tab === "import" && draft && can.manage ? (
        <ImportTab id={id} zones={summary.zones} onDone={load} />
      ) : (
        <ReviewTab data={data} id={id} onLine={patchRow} onChanged={loadSoon} />
      )}

      <ErrorText>{error}</ErrorText>
      {can.manage && count.status !== "VOID" && (
        <div className="flex flex-wrap gap-2 sticky bottom-20 md:bottom-4">
          {draft && (
            <button onClick={() => setPosting(true)} disabled={busy || (!summary.lines && !(count.scope === "FULL" && summary.uncounted))} className={`${btn.primary} flex-1 sm:flex-none shadow-lg`}>
              ✓ ثبت نهایی
            </button>
          )}
          {draft && count.round === 1 && summary.diffLines > 0 && (
            <button
              onClick={() => window.confirm("شمارش دوم شروع شود؟ از این به بعد فقط کالاهای اختلاف‌دار دوباره شمرده می‌شوند و عدد تازه جای قبلی را می‌گیرد.") && act("recount")}
              disabled={busy}
              className={btn.soft}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              شمارش دوم اختلاف‌ها
            </button>
          )}
          {draft && count.round === 1 && summary.uncounted > 0 && (
            <button
              onClick={() => window.confirm("کالاهای شمرده‌نشده با همان عدد دفتری اضافه شوند؟ بعد فقط اختلاف‌ها را عوض کنید.") && act("fill")}
              disabled={busy}
              className={btn.soft}
              title="کالاهای شمرده‌نشده با عدد دفتری اضافه می‌شوند"
            >
              <ListChecks className="h-4 w-4" aria-hidden />
              بقیه با عدد دفتری
            </button>
          )}
          <button
            onClick={() => {
              if (draft) {
                if (window.confirm("این پیش‌نویس و همه‌ی شمارش‌هایش حذف شود؟")) act("void");
              } else {
                const reason = window.prompt("دلیل ابطال؟ موجودی به قبل از انبارگردانی برمی‌گردد.") ?? "";
                if (reason) act("void", { reason });
              }
            }}
            disabled={busy}
            className={btn.danger}
          >
            {draft ? "حذف پیش‌نویس" : "ابطال"}
          </button>
        </div>
      )}

      {posting && <PostSheet data={data} id={id} onClose={() => setPosting(false)} onDone={load} />}
    </div>
  );
}

// ── شمارش ─────────────────────────────────────────────────────────────────

function CountTab({
  data,
  id,
  onLine,
  onChanged,
}: {
  data: Data;
  id: string;
  onLine: (line: LineView | null, productId: string, meta?: { title: string; code: string }) => void;
  onChanged: () => void;
}) {
  const [code, setCode] = useState("");
  const [zone, setZone] = useState(() => local.get(`count:${id}:zone`, ""));
  const [step, setStep] = useState("1");
  const [flash, setFlash] = useState<{ ok: boolean; text: string; big?: string } | null>(null);
  const [pick, setPick] = useState<ModelPick | null>(null);
  const [list, setList] = useState<PosItem[] | null>(null);
  const [mine, setMine] = useState(data.entries);
  const input = useRef<HTMLInputElement>(null);
  const qty = Math.max(1, Number(toLatinDigits(step)) || 1);

  useEffect(() => setMine(data.entries), [data.entries]);
  useEffect(() => local.set(`count:${id}:zone`, zone), [id, zone]);

  const added = (r: Extract<ScanReply, { kind: "added" }>) => {
    beep(true);
    onLine(r.line, r.line.productId, { title: r.title, code: r.code });
    setFlash({ ok: true, text: `${r.title} · ${r.code}`, big: faNum(r.line.final) });
    setMine((m) => [{ id: `local-${Date.now()}`, productId: r.line.productId, title: r.title, qty, zone: zone || null, createdAt: new Date().toISOString() }, ...m].slice(0, 25));
    onChanged();
  };
  const failed = (msg: string) => {
    beep(false);
    setFlash({ ok: false, text: msg });
  };
  const refocus = () => setTimeout(() => input.current?.focus(), 30);

  async function scan() {
    const term = code.trim();
    if (!term) return;
    setCode("");
    setList(null);
    try {
      const r = await api<ScanReply>(`/api/admin/accounting/inventory/counts/${id}`, { method: "POST", json: { action: "scan", code: term, qty, zone } });
      if (r.kind === "added") added(r);
      else if (r.kind === "model") setPick(r.pick);
      else if (!r.items.length) failed(`«${term}» پیدا نشد`);
      else setList(r.items);
    } catch (e) {
      failed(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      refocus();
    }
  }

  async function addItem(item: PosItem) {
    setPick(null);
    setList(null);
    try {
      const r = await api<{ line: LineView }>(`/api/admin/accounting/inventory/counts/${id}`, {
        method: "POST",
        json: { action: "add", productId: item.id, qty, zone },
      });
      added({ kind: "added", line: r.line, title: item.title, code: item.code });
    } catch (e) {
      failed(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      refocus();
    }
  }

  async function undo() {
    try {
      const r = await api<{ undone: { productId: string; qty: number; line: LineView | null } | null }>(
        `/api/admin/accounting/inventory/counts/${id}`,
        { method: "POST", json: { action: "undo" } },
      );
      if (!r.undone) return failed("اسکنی از شما برای برگرداندن نمانده");
      onLine(r.undone.line, r.undone.productId);
      setMine((m) => {
        const i = m.findIndex((e) => e.productId === r.undone!.productId);
        return i < 0 ? m : m.filter((_, k) => k !== i);
      });
      setFlash({ ok: true, text: `برگشت: ${faNum(r.undone.qty)} عدد` });
      onChanged();
    } catch (e) {
      failed(e instanceof Error ? e.message : "برنگشت");
    } finally {
      refocus();
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-3 sticky top-2 z-20 shadow-md">
        <div className="flex gap-2">
          <label className="flex-1 min-w-0 text-[11px] font-bold text-gray-500">
            بخش / قفسه
            <input value={zone} onChange={(e) => setZone(e.target.value)} list={`zones-${id}`} placeholder="مثلاً قفسه ۳" className={`${inputCls} mt-1`} />
            <datalist id={`zones-${id}`}>
              {data.summary.zones.filter((z) => z.zone).map((z) => (
                <option key={z.zone} value={z.zone} />
              ))}
            </datalist>
          </label>
          <label className="w-24 shrink-0 text-[11px] font-bold text-gray-500">
            تعداد هر اسکن
            <input value={step} onChange={(e) => setStep(e.target.value)} onBlur={() => setStep(String(qty))} inputMode="numeric" className={`${inputCls} mt-1 text-center font-black`} />
          </label>
        </div>
        <div className="relative">
          <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" aria-hidden />
          <input
            ref={input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                scan();
              }
            }}
            autoFocus
            enterKeyHint="send"
            placeholder="بارکد را اسکن کنید یا کد/نام کالا را بنویسید"
            className={`${inputCls} pr-10 text-base`}
          />
        </div>
        {flash && (
          <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${flash.ok ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
            {flash.big && <span className="text-3xl font-black tabular-nums text-emerald-600">{flash.big}</span>}
            <span className={`flex-1 min-w-0 text-xs font-bold truncate ${flash.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>{flash.text}</span>
          </div>
        )}
        {list && (
          <div className="divide-y divide-gray-100 dark:divide-white/5 rounded-xl border border-gray-200 dark:border-white/10 max-h-72 overflow-y-auto">
            {list.map((it) => (
              <button key={it.id} onClick={() => addItem(it)} className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-white/5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{it.title}</span>
                  <span className="block text-[11px] text-gray-400">{it.code}</span>
                </span>
                <span className="text-xs font-bold text-blue-600">+ {faNum(qty)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-gray-400">هر اسکن {faNum(qty)} عدد به شمارش اضافه می‌کند — چند گوشی هم‌زمان می‌شمارند.</span>
          <button onClick={undo} className={btn.small}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            برگرداندن آخرین اسکن من
          </button>
        </div>
      </Card>

      {data.count.round === 2 && !data.can.blind && <RecountList rows={data.rows} />}

      <section>
        <h3 className="text-xs font-black text-gray-500 mb-2">اسکن‌های اخیر من</h3>
        <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
          {mine.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">{e.title || "—"}</span>
                <span className="block text-[11px] text-gray-400">
                  {new Date(e.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                  {e.zone ? ` · ${e.zone}` : ""}
                </span>
              </span>
              <span className={`text-sm font-black tabular-nums ${e.qty < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {e.qty > 0 ? "+" : "−"}
                {faNum(Math.abs(e.qty))}
              </span>
            </div>
          ))}
          {!mine.length && <p className="px-4 py-8 text-center text-xs text-gray-400">هنوز اسکنی ثبت نکرده‌اید. بارکد اولین کالا را اسکن کنید.</p>}
        </Card>
      </section>

      {pick && <ModelPicker pick={pick} terminalId="" canCreate={false} onPick={addItem} onClose={() => (setPick(null), refocus())} />}
    </div>
  );
}

function RecountList({ rows }: { rows: Row[] }) {
  const left = rows.filter((r) => (r.diff ?? 0) !== 0 && r.recount === null);
  if (!left.length) return <Card className="p-3 text-xs font-bold text-emerald-600">همه‌ی اختلاف‌ها دوباره شمرده شد.</Card>;
  return (
    <section>
      <h3 className="text-xs font-black text-gray-500 mb-2">مانده برای شمارش دوم ({faNum(left.length)})</h3>
      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5 max-h-80 overflow-y-auto">
        {left.slice(0, 200).map((r) => (
          <div key={r.productId} className="flex items-center gap-3 px-3 py-2">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold truncate">{r.title}</span>
              <span className="block text-[11px] text-gray-400">
                {r.code}
                {r.zone ? ` · ${r.zone}` : ""}
              </span>
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

// ── بازبینی ────────────────────────────────────────────────────────────────

function ReviewTab({
  data,
  id,
  onLine,
  onChanged,
}: {
  data: Data;
  id: string;
  onLine: (line: LineView | null, productId: string) => void;
  onChanged: () => void;
}) {
  const { count, can } = data;
  const draft = count.status === "DRAFT";
  const editable = draft && can.count;
  const [filter, setFilter] = useState<Filter>("all");
  const [zone, setZone] = useState<string | "*">("*");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "diff">("recent");
  const [shown, setShown] = useState(PAGE);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = toLatinDigits(q.trim()).toLowerCase();
    let out = data.rows.filter((r) => {
      if (filter === "diff" && !(r.diff ?? 0)) return false;
      if (filter === "uncounted" && !r.uncounted) return false;
      if (filter === "recount" && (r.recount === null || r.uncounted)) return false;
      if (filter === "all" && r.uncounted) return false;
      if (zone !== "*" && (r.zone ?? "") !== zone) return false;
      return !term || r.title.toLowerCase().includes(term) || r.code.toLowerCase().includes(term);
    });
    if (sort === "diff") {
      const mag = (r: Row) => (r.value !== null ? Math.abs(Number(r.value)) : Math.abs(r.diff ?? 0));
      out = [...out].sort((a, b) => mag(b) - mag(a));
    }
    return out;
  }, [data.rows, filter, zone, q, sort]);

  async function save(r: Row) {
    const raw = edit[r.productId];
    if (raw === undefined) return;
    const v = toLatinDigits(raw).replace(/\D/g, "");
    setEdit((m) => {
      const rest = { ...m };
      delete rest[r.productId];
      return rest;
    });
    if (v === "" || Number(v) === (count.round === 2 ? r.recount : r.counted)) return;
    try {
      const res = await api<{ lines: (LineView | null)[] }>(`/api/admin/accounting/inventory/counts/${id}`, {
        method: "PUT",
        json: { lines: [{ productId: r.productId, countedQty: Number(v) }] },
      });
      onLine(res.lines[0], r.productId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    }
  }

  async function remove(r: Row) {
    if (!window.confirm(count.round === 2 ? `شمارش دوم «${r.title}» پاک شود؟` : `«${r.title}» از برگه حذف شود؟ همه‌ی اسکن‌هایش پاک می‌شود.`)) return;
    try {
      const res = await api<{ lines: (LineView | null)[] }>(`/api/admin/accounting/inventory/counts/${id}`, {
        method: "PUT",
        json: { lines: [{ productId: r.productId, countedQty: null }] },
      });
      onLine(res.lines[0], r.productId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف نشد");
    }
  }

  const n = (f: Filter) =>
    data.rows.filter((r) => (f === "diff" ? !!(r.diff ?? 0) : f === "uncounted" ? r.uncounted : f === "recount" ? r.recount !== null && !r.uncounted : !r.uncounted)).length;

  return (
    <div className="space-y-3">
      <Chips
        value={filter}
        onChange={(f) => (setFilter(f), setShown(PAGE))}
        options={[
          { value: "all", label: "شمرده‌شده‌ها", count: n("all") },
          ...(!can.blind ? [{ value: "diff" as Filter, label: "دارای اختلاف", count: n("diff") }] : []),
          ...(!can.blind && data.summary.uncounted ? [{ value: "uncounted" as Filter, label: "شمرده‌نشده", count: n("uncounted") }] : []),
          ...(count.round === 2 ? [{ value: "recount" as Filter, label: "شمارش دوم", count: n("recount") }] : []),
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا کد" className={`${inputCls} flex-1 min-w-[10rem]`} />
        {data.summary.zones.length > 1 && (
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="*">همه‌ی بخش‌ها</option>
            {data.summary.zones.map((z) => (
              <option key={z.zone} value={z.zone}>
                {z.zone || "بی‌بخش"} ({faNum(z.lines)})
              </option>
            ))}
          </select>
        )}
        {!can.blind && (
          <select value={sort} onChange={(e) => setSort(e.target.value as "recent" | "diff")} className={`${inputCls} w-auto`}>
            <option value="recent">تازه‌ترین شمارش</option>
            <option value="diff">بزرگ‌ترین اختلاف</option>
          </select>
        )}
        {can.manage && (
          <a href={`/api/admin/accounting/inventory/counts/${id}/export${filter === "diff" || filter === "uncounted" ? `?only=${filter}` : ""}`} className={btn.soft}>
            <Download className="h-4 w-4" aria-hidden />
            خروجی اکسل
          </a>
        )}
      </div>
      <ErrorText>{error}</ErrorText>

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {rows.slice(0, shown).map((r) => {
          const own = count.round === 2 ? r.recount : r.counted;
          return (
            <div key={r.productId} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">{r.title}</span>
                <span className="block text-[11px] text-gray-400">
                  {r.code}
                  {r.place && <span className="font-bold text-blue-600"> · 📍 {r.place}</span>}
                  {r.zone ? ` · ${r.zone}` : ""}
                  {r.book !== null && ` · دفتری ${faNum(r.book)}`}
                  {count.round === 2 && r.recount !== null && ` · شمارش اول ${faNum(r.counted)}`}
                  {r.diff !== null && r.diff !== 0 && (
                    <b className={`mr-2 ${r.diff < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {r.diff < 0 ? `کسری ${faNum(-r.diff)}` : `اضافی ${faNum(r.diff)}`}
                      {r.value !== null && ` · ${formatAmount(r.value.replace("-", ""))} ت`}
                    </b>
                  )}
                  {r.uncounted && <b className="mr-2 text-gray-500">{count.scope === "FULL" ? "شمرده نشده ← صفر می‌شود" : "شمرده نشده ← دست نمی‌خورد"}</b>}
                </span>
              </span>
              {editable && !r.uncounted ? (
                <>
                  <input
                    value={edit[r.productId] ?? (own === null ? "" : faNum(own))}
                    placeholder={own === null ? faNum(r.counted) : undefined}
                    onChange={(e) => setEdit((m) => ({ ...m, [r.productId]: e.target.value }))}
                    onBlur={() => save(r)}
                    onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                    inputMode="numeric"
                    aria-label="شمارش"
                    className="w-16 h-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-center text-base font-black"
                  />
                  <button onClick={() => remove(r)} className="text-gray-300 hover:text-red-600 px-1" aria-label="حذف از برگه">
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-base font-black tabular-nums">{faNum(r.final)}</span>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="px-4 py-8 text-center text-xs text-gray-400">ردیفی با این فیلتر نیست.</p>}
      </Card>
      {rows.length > shown && (
        <button onClick={() => setShown((s) => s + PAGE)} className={`${btn.soft} w-full`}>
          نمایش {faNum(Math.min(PAGE, rows.length - shown))} ردیف دیگر (از {faNum(rows.length)})
        </button>
      )}
    </div>
  );
}

// ── ورود از فایل ───────────────────────────────────────────────────────────

interface ImportResult {
  products: number;
  units: number;
  unknown: string[];
  ambiguous: string[];
  invalid: string[];
}

function ImportTab({ id, zones, onDone }: { id: string; zones: Summary["zones"]; onDone: () => void }) {
  const [text, setText] = useState("");
  const [zone, setZone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  async function readFile(f: File) {
    // CSV ذخیره‌شده از اکسل فارسی معمولاً UTF-8 با BOM است؛ وگرنه UTF-16 (متن یونیکد اکسل)
    const buf = new Uint8Array(await f.arrayBuffer());
    const utf16 = buf[0] === 0xff && buf[1] === 0xfe;
    setText(new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(buf));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<{ result: ImportResult }>(`/api/admin/accounting/inventory/counts/${id}`, { method: "POST", json: { action: "import", text, zone } });
      setResult(r.result);
      if (r.result.products) setText("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "وارد نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <p className="text-xs leading-6 text-gray-500">
        ستون اول <b>کد کالا</b> (کد تازه، بارکد یا کد قبلی)، ستون دوم <b>تعداد</b>. بی ستون تعداد، هر ردیف یک عدد است — مثل فایل بارکدخوانی که
        در حالت بی‌سیم ذخیره می‌کند. ستون‌ها را از اکسل کپی کنید و اینجا بچسبانید، یا فایل CSV/متن بدهید. تعدادها <b>به شمارش فعلی اضافه</b> می‌شوند.
      </p>
      <Field label="ستون‌ها">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} dir="ltr" placeholder={"11010203\t3\n11010204\t1\n6260000000012"} className={`${inputCls} font-mono text-xs`} />
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        <label className={`${btn.soft} cursor-pointer`}>
          <Upload className="h-4 w-4" aria-hidden />
          انتخاب فایل
          <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        </label>
        <label className="text-[11px] font-bold text-gray-500">
          بخش / قفسه (اختیاری)
          <input value={zone} onChange={(e) => setZone(e.target.value)} list="import-zones" className={`${inputCls} mt-1 w-40`} />
          <datalist id="import-zones">
            {zones.filter((z) => z.zone).map((z) => (
              <option key={z.zone} value={z.zone} />
            ))}
          </datalist>
        </label>
        <button onClick={submit} disabled={busy || !lines} className={btn.primary}>
          <ClipboardList className="h-4 w-4" aria-hidden />
          {busy ? "…" : `افزودن ${faNum(lines)} ردیف`}
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
      {result && (
        <div className="space-y-2 text-xs">
          <p className="font-bold text-emerald-600">
            ✓ {faNum(result.units)} عدد از {faNum(result.products)} کالا اضافه شد.
          </p>
          {result.ambiguous.length > 0 && (
            <p className="text-amber-700 dark:text-amber-300">
              <b>کد قبلی چندرنگ/سایز ({faNum(result.ambiguous.length)})</b> — معلوم نیست کدام رنگ و سایز است؛ با اسکن در «شمارش» انتخاب کنید: <span dir="ltr">{result.ambiguous.slice(0, 40).join("، ")}</span>
            </p>
          )}
          {result.unknown.length > 0 && (
            <p className="text-red-600">
              <b>کد ناشناخته ({faNum(result.unknown.length)})</b>: <span dir="ltr">{result.unknown.slice(0, 40).join("، ")}</span>
            </p>
          )}
          {result.invalid.length > 0 && (
            <p className="text-red-600">
              <b>تعداد نامعتبر ({faNum(result.invalid.length)})</b>: <span dir="ltr">{result.invalid.slice(0, 40).join("، ")}</span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── ثبت نهایی ──────────────────────────────────────────────────────────────

function PostSheet({ data, id, onClose, onDone }: { data: Data; id: string; onClose: () => void; onDone: () => void }) {
  const { summary, count, can } = data;
  const [applyTo, setApplyTo] = useState<"ADJUST" | "OPENING">("ADJUST");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/inventory/counts/${id}`, { method: "POST", json: { action: "post", applyTo } });
      onClose();
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
      title="ثبت نهایی انبارگردانی"
      help="accountingCounts"
      footer={
        <button onClick={post} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : "✓ ثبت نهایی"}
        </button>
      }
    >
      <div className="space-y-4 text-sm">
        <ul className="space-y-1.5 text-xs leading-6 text-gray-600 dark:text-gray-300">
          <li>
            {faNum(summary.lines)} کالا شمرده شده؛ {faNum(summary.diffLines)} کالا اختلاف دارد ({faNum(summary.shortageUnits)} کسری، {faNum(summary.surplusUnits)} اضافی).
          </li>
          {count.scope === "FULL" && summary.uncounted > 0 && (
            <li className="font-bold text-red-600">
              {faNum(summary.uncounted)} کالای شمرده‌نشده ({faNum(summary.uncountedUnits)} عدد) با شمارش صفر ثبت می‌شوند.
            </li>
          )}
          {can.costs && summary.shortageValue !== null && (
            <li>
              برآورد ارزش: کسری {formatAmount(summary.shortageValue)}، اضافی {formatAmount(summary.surplusValue)} تومان (عدد قطعی از کاردکس در سند می‌آید).
            </li>
          )}
          <li>بعد از ثبت برگه عوض نمی‌شود؛ ابطال همه را برمی‌گرداند.</li>
        </ul>
        {can.costs && (
          <Field label="اختلاف کجا بنشیند؟" hint={!can.opening && can.openingWhy ? `«موجودی اول دوره» ممکن نیست: ${can.openingWhy}` : undefined}>
            <Segmented
              value={applyTo}
              onChange={(v) => (v === "OPENING" && !can.opening ? null : setApplyTo(v))}
              options={[
                { value: "ADJUST", label: "کسری و اضافی انبار" },
                ...(can.opening ? [{ value: "OPENING" as const, label: "موجودی اول دوره" }] : []),
              ]}
            />
          </Field>
        )}
        <p className="text-xs leading-6 text-gray-500">
          {applyTo === "ADJUST"
            ? "کسری با میانگین بها از انبار کم و به «کسری و اضافات انبار» زده می‌شود؛ اضافی برعکس."
            : "برای روز شروع کار با پنل: اضافی به موجودی اول دوره اضافه می‌شود و کسری از آن کم (هر چه بیشتر از اول دوره باشد، کسری عادی). بهای کالای تازه از اول دوره‌ی قبلی یا میانگین فعلی می‌آید؛ بعد از ثبت، بهای خالی را در «اول دوره» کامل کنید."}
        </p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
