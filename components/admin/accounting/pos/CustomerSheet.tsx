"use client";

/**
 * مشتری در صندوق — docs/plans/inventory-items.md بخش ۱۳.۱.
 *
 * سه حالت در یک پنجره‌ی بزرگ:
 *   جستجو  ← فهرست کامل نتیجه‌ها (نه کشویی بریده‌شده) با موبایل، کد و مانده؛ ↑↓ و Enter
 *   تازه   ← نام، نام خانوادگی، موبایل (با هشدار موبایل تکراری)، کد ملی، شهر، نشانی، یادداشت
 *   پرونده ← مشخصات کامل، مانده‌ی حساب، کارت اشتراک و اعتبار، خلاصه و رسیدهای اخیر؛ ویرایش
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { IdCard, Pencil, Plus, Search, UserRound, X } from "lucide-react";
import type { PartyOption } from "../PartyPicker";
import { api, BalanceLabel } from "../ui";
import { B, TICKET_KIND, faNum, formatAmount, type PosMember } from "./shared";

interface Detail {
  party: {
    id: string;
    code: number;
    name: string;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
    phone: string | null;
    nationalId: string | null;
    city: string | null;
    address: string | null;
    postalCode: string | null;
    note: string | null;
    creditLimit: string | null;
    externalCode: string | null;
    isSiteUser: boolean;
    createdAt: string;
  };
  balance: string;
  member: PosMember | null;
  stats: { tickets: number; sales: string; returns: string; qty: number; lastAt: string | null; onlineOrders: number };
  recent: { id: string; number: number; kind: string; createdAt: string; saleTotal: string; returnTotal: string; terminal: { name: string } }[];
}

type Form = { name: string; firstName: string; lastName: string; mobile: string; phone: string; nationalId: string; city: string; address: string; postalCode: string; note: string };
const EMPTY: Form = { name: "", firstName: "", lastName: "", mobile: "", phone: "", nationalId: "", city: "", address: "", postalCode: "", note: "" };
const fa2en = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const dateFa = (iso: string) => new Date(iso).toLocaleDateString("fa-IR");

const field = "w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm font-bold outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-white/5";

export default function CustomerSheet({
  party,
  clubCards,
  onPick,
  onIssueCard,
  onMember,
  onClose,
}: {
  party: PartyOption | null;
  /** کارت اشتراک در صندوق روشن است */
  clubCards: boolean;
  onPick: (p: PartyOption | null) => void;
  /** باز کردن «صدور کارت» برای مشتری انتخاب‌شده */
  onIssueCard: () => void;
  /** کارت و اعتبار تازه‌ی مشتری (برای نشان کنار نام در صندوق) */
  onMember: (m: PosMember | null) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"search" | "new" | "view" | "edit">(party ? "view" : "search");
  const [current, setCurrent] = useState<PartyOption | null>(party);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const pick = (p: PartyOption) => {
    setCurrent(p);
    onPick(p);
    setMode("view");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-sheet-in relative flex h-[min(92vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/5">
          <h3 className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
            <UserRound className="h-5 w-5 text-blue-600" aria-hidden />
            {mode === "new" ? "مشتری تازه" : mode === "edit" ? "ویرایش مشتری" : mode === "view" ? "پرونده‌ی مشتری" : "انتخاب مشتری"}
          </h3>
          <div className="flex items-center gap-2">
            {mode === "view" && (
              <button onClick={() => setMode("search")} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-600 dark:bg-white/5 dark:text-gray-300">
                مشتری دیگر
              </button>
            )}
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5" aria-label="بستن">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "search" && <SearchPane onPick={pick} onNew={() => setMode("new")} />}
          {mode === "new" && <EditPane initial={null} onSaved={(p) => pick(p)} onCancel={() => setMode("search")} onPickExisting={pick} />}
          {(mode === "view" || mode === "edit") && current && (
            <DetailPane
              key={current.id}
              partyId={current.id}
              editing={mode === "edit"}
              clubCards={clubCards}
              onEdit={() => setMode("edit")}
              onEdited={(p) => {
                setCurrent(p);
                onPick(p);
                setMode("view");
              }}
              onCancelEdit={() => setMode("view")}
              onMember={onMember}
              onIssueCard={onIssueCard}
              onRemove={() => {
                onPick(null);
                onClose();
              }}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── جستجو ──────────────────────────────────────────────────────────────────

function SearchPane({ onPick, onNew }: { onPick: (p: PartyOption) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PartyOption[] | null>(null);
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const h = setTimeout(async () => {
      const p = new URLSearchParams({ take: "30", role: "customer" });
      if (q.trim()) p.set("q", fa2en(q.trim()));
      try {
        const d = await api<{ parties: PartyOption[] }>(`/api/admin/accounting/parties?${p}`);
        if (live) {
          setRows(d.parties);
          setSel(0);
        }
      } catch {
        if (live) setRows([]);
      }
    }, 220);
    return () => {
      live = false;
      clearTimeout(h);
    };
  }, [q]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-gray-100 p-4 dark:border-white/5">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((x) => Math.min((rows?.length ?? 1) - 1, x + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((x) => Math.max(0, x - 1));
              } else if (e.key === "Enter" && rows?.[sel]) {
                e.preventDefault();
                onPick(rows[sel]);
              }
            }}
            placeholder="نام، موبایل، کد ملی یا کد مشتری"
            className="w-full rounded-2xl border-2 border-gray-200 bg-white py-3.5 pl-4 pr-11 text-lg font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5"
          />
        </div>
        <button onClick={onNew} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-blue-300 py-2.5 text-sm font-black text-blue-600 hover:bg-blue-50 dark:border-blue-500/30 dark:hover:bg-blue-500/10">
          <Plus className="h-4 w-4" aria-hidden /> ثبت مشتری تازه
        </button>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-white/5">
        {rows === null && <p className="p-6 text-center text-sm text-gray-400">در حال جستجو…</p>}
        {rows?.length === 0 && <p className="p-6 text-center text-sm text-gray-400">کسی پیدا نشد. «ثبت مشتری تازه» را بزنید.</p>}
        {rows?.map((p, i) => (
          <button
            key={p.id}
            data-i={i}
            onClick={() => onPick(p)}
            onMouseEnter={() => setSel(i)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-right transition ${i === sel ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-gray-500 dark:bg-white/5">{p.name.trim().slice(0, 1)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-black text-gray-900 dark:text-white">{p.name}</span>
              <span className="block text-xs font-bold text-gray-500">
                {p.mobile ? <span dir="ltr">{faNum(p.mobile)}</span> : "بی موبایل"} · کد {faNum(p.code)}
              </span>
            </span>
            {p.balance !== undefined && <BalanceLabel balance={p.balance} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ثبت و ویرایش ───────────────────────────────────────────────────────────

function EditPane({
  initial,
  onSaved,
  onCancel,
  onPickExisting,
}: {
  initial: (Form & { id: string }) | null;
  onSaved: (p: PartyOption) => void;
  onCancel: () => void;
  onPickExisting?: (p: PartyOption) => void;
}) {
  const [f, setF] = useState<Form>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupFor, setDupFor] = useState<{ mobile: string; party: PartyOption | null } | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const mobile = fa2en(f.mobile).replace(/[\s-]/g, "");
  const dup = dupFor?.mobile === mobile ? dupFor.party : null;

  // موبایل تکراری — پیش از ثبت نشان داده می‌شود تا شخص تکراری ساخته نشود
  useEffect(() => {
    if (!/^09\d{9}$/.test(mobile)) return;
    let live = true;
    api<{ parties: PartyOption[] }>(`/api/admin/accounting/parties?take=3&q=${mobile}`)
      .then((d) => live && setDupFor({ mobile, party: d.parties.find((p) => p.mobile === mobile && p.id !== initial?.id) ?? null }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mobile, initial?.id]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { ...f, mobile: mobile || "", nationalId: fa2en(f.nationalId), postalCode: fa2en(f.postalCode), phone: fa2en(f.phone) };
      if (initial) {
        // نام یا نام خانوادگی عوض شد و «نام کامل» دست نخورد ← نام کامل از همان دو ساخته شود
        const nameKept = f.name === initial.name && (f.firstName !== initial.firstName || f.lastName !== initial.lastName);
        const r = await api<{ party: PartyOption }>(`/api/admin/accounting/pos/customer?partyId=${initial.id}`, { method: "PATCH", json: { ...body, name: nameKept ? undefined : body.name } });
        onSaved(r.party);
      } else {
        const r = await api<{ party: PartyOption }>("/api/admin/accounting/parties", {
          method: "POST",
          json: { ...body, name: undefined, mobile: body.mobile || null, isCustomer: true },
        });
        onSaved({ ...r.party, balance: "0" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  const canSave = initial ? !!(f.name.trim() || f.firstName.trim() || f.lastName.trim()) : !!(f.firstName.trim() || f.lastName.trim());

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave && !busy) save();
      }}
    >
      {initial && (
        <L label="نام کامل (همان که روی فاکتور می‌آید)">
          <input value={f.name} onChange={set("name")} className={field} />
        </L>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <L label="نام">
          <input autoFocus={!initial} value={f.firstName} onChange={set("firstName")} className={field} />
        </L>
        <L label="نام خانوادگی">
          <input value={f.lastName} onChange={set("lastName")} className={field} />
        </L>
        <L label="موبایل">
          <input value={f.mobile} onChange={set("mobile")} inputMode="tel" dir="ltr" placeholder="09…" className={`${field} text-left`} />
        </L>
        <L label="تلفن ثابت (اختیاری)">
          <input value={f.phone} onChange={set("phone")} inputMode="tel" dir="ltr" className={`${field} text-left`} />
        </L>
        <L label="کد ملی (اختیاری)">
          <input value={f.nationalId} onChange={set("nationalId")} inputMode="numeric" dir="ltr" className={`${field} text-left`} />
        </L>
        <L label="شهر (اختیاری)">
          <input value={f.city} onChange={set("city")} className={field} />
        </L>
      </div>
      <L label="نشانی (اختیاری)">
        <input value={f.address} onChange={set("address")} className={field} />
      </L>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <L label="کد پستی (اختیاری)">
          <input value={f.postalCode} onChange={set("postalCode")} inputMode="numeric" dir="ltr" className={`${field} text-left`} />
        </L>
        <L label="یادداشت (اختیاری)">
          <input value={f.note} onChange={set("note")} placeholder="مثلاً سایز همیشگی، تاریخ تولد…" className={field} />
        </L>
      </div>

      {dup && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <span>
            این موبایل برای «{dup.name}» (کد {faNum(dup.code)}) ثبت است.
          </span>
          {onPickExisting && (
            <button type="button" onClick={() => onPickExisting(dup)} className="shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white">
              انتخاب همین مشتری
            </button>
          )}
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={!canSave || busy} className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white disabled:opacity-40">
          {busy ? "در حال ثبت…" : initial ? "ذخیره" : "ثبت و انتخاب"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-2xl bg-gray-100 px-5 py-3 text-sm font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300">
          انصراف
        </button>
      </div>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

// ── پرونده ─────────────────────────────────────────────────────────────────

function DetailPane({
  partyId,
  editing,
  clubCards,
  onEdit,
  onEdited,
  onCancelEdit,
  onMember,
  onIssueCard,
  onRemove,
  onDone,
}: {
  partyId: string;
  editing: boolean;
  clubCards: boolean;
  onEdit: () => void;
  onEdited: (p: PartyOption) => void;
  onCancelEdit: () => void;
  onMember: (m: PosMember | null) => void;
  onIssueCard: () => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      api<Detail>(`/api/admin/accounting/pos/customer?partyId=${partyId}`)
        .then((r) => {
          setD(r);
          onMember(r.member);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "باز نشد")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partyId],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="p-6 text-sm font-bold text-red-600">{error}</p>;
  if (!d) return <p className="p-6 text-center text-sm text-gray-400">در حال باز کردن پرونده…</p>;
  const p = d.party;

  if (editing) {
    return (
      <EditPane
        initial={{
          id: p.id,
          name: p.name,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          mobile: p.mobile ?? "",
          phone: p.phone ?? "",
          nationalId: p.nationalId ?? "",
          city: p.city ?? "",
          address: p.address ?? "",
          postalCode: p.postalCode ?? "",
          note: p.note ?? "",
        }}
        onSaved={(x) => {
          onEdited({ ...x, balance: d.balance });
          load();
        }}
        onCancel={onCancelEdit}
      />
    );
  }

  const m = d.member;
  const net = B(d.stats.sales) - B(d.stats.returns);
  const bal = B(d.balance);
  return (
    <div className="space-y-4 p-5">
      {/* سربرگ */}
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-xl font-black text-blue-600">{p.name.trim().slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-black text-gray-900 dark:text-white">{p.name}</p>
          <p className="mt-0.5 text-sm font-bold text-gray-500">
            {p.mobile ? <span dir="ltr">{faNum(p.mobile)}</span> : "بی موبایل"} · کد {faNum(p.code)}
            {p.isSiteUser && <span className="mr-2 rounded-lg bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-black text-emerald-700">کاربر سایت</span>}
          </p>
        </div>
        <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-600 dark:bg-white/5 dark:text-gray-300">
          <Pencil className="h-3.5 w-3.5" aria-hidden /> ویرایش
        </button>
      </div>

      {/* کاشی‌ها */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Tile label="مانده‌ی حساب" value={bal === 0n ? "تسویه" : `${formatAmount(bal < 0n ? -bal : bal)}`} sub={bal > 0n ? "بدهکار (نسیه دارد)" : bal < 0n ? "بستانکار (طلب دارد)" : undefined} tone={bal > 0n ? "red" : bal < 0n ? "green" : "gray"} />
        <Tile label="خرید حضوری" value={formatAmount(net)} sub={`${faNum(d.stats.tickets)} رسید · ${faNum(d.stats.qty)} کالا`} />
        <Tile label="آخرین خرید" value={d.stats.lastAt ? dateFa(d.stats.lastAt) : "—"} sub={d.stats.onlineOrders ? `${faNum(d.stats.onlineOrders)} سفارش اینترنتی` : undefined} />
      </div>

      {/* کارت اشتراک */}
      {clubCards && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/60 bg-gradient-to-l from-amber-50 to-yellow-50 p-4 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-amber-500/5">
          <IdCard className="h-8 w-8 text-amber-600" aria-hidden />
          {m?.card ? (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-amber-900 dark:text-amber-100">
                کارت اشتراک {m.tier ? `· ${m.tier.title}` : ""} <span className="text-xs font-bold opacity-70" dir="ltr">…{m.card.number.slice(-4)}</span>
              </p>
              <p className="text-2xl font-black tabular-nums text-amber-700 dark:text-amber-300">
                {formatAmount(B(m.credit))} <span className="text-sm">تومان اعتبار</span>
              </p>
              {m.tier?.chargeBp ? <p className="text-[11px] font-bold text-amber-800/80 dark:text-amber-200/80">هر خرید {faNum(m.tier.chargeBp / 100)}٪ مبلغ را به کارت اضافه می‌کند</p> : null}
              {m.nextExpiry && <p className="text-[11px] font-bold text-amber-800/80 dark:text-amber-200/80">{formatAmount(B(m.nextExpiry.credit))} تومان تا {dateFa(m.nextExpiry.at)} منقضی می‌شود</p>}
            </div>
          ) : (
            <p className="min-w-0 flex-1 text-sm font-bold text-amber-900 dark:text-amber-100">کارت اشتراک ندارد</p>
          )}
          <button onClick={onIssueCard} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white">
            {m?.card ? "تعویض کارت" : "صدور کارت"}
          </button>
        </div>
      )}

      {/* مشخصات */}
      <div className="grid gap-x-6 gap-y-2 rounded-2xl bg-gray-50 p-4 text-sm sm:grid-cols-2 dark:bg-white/[0.03]">
        <Kv k="تلفن" v={p.phone} ltr />
        <Kv k="کد ملی" v={p.nationalId} ltr />
        <Kv k="شهر" v={p.city} />
        <Kv k="کد پستی" v={p.postalCode} ltr />
        <Kv k="نشانی" v={p.address} wide />
        <Kv k="یادداشت" v={p.note} wide />
        {p.creditLimit && <Kv k="سقف نسیه" v={formatAmount(B(p.creditLimit))} />}
        {p.externalCode && <Kv k="کد در نرم‌افزار قبلی" v={p.externalCode} ltr />}
        <Kv k="عضویت از" v={dateFa(p.createdAt)} />
      </div>

      {/* رسیدهای اخیر */}
      {d.recent.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-black text-gray-500">رسیدهای اخیر</p>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 dark:divide-white/5 dark:border-white/5">
            {d.recent.map((t) => {
              const n = B(t.saleTotal) - B(t.returnTotal);
              return (
                <a key={t.id} href={`/admin/accounting/pos/tickets/${t.id}/print`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                  <span className="w-20 shrink-0 font-bold text-gray-500">{dateFa(t.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {TICKET_KIND[t.kind] ?? t.kind} {faNum(t.number)} <span className="text-xs text-gray-400">· {t.terminal.name}</span>
                  </span>
                  <span className={`font-black tabular-nums ${n < 0n ? "text-rose-600" : ""}`}>{formatAmount(n)}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={onDone} className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white">
          ادامه‌ی فروش با این مشتری
        </button>
        <button onClick={onRemove} className="rounded-2xl bg-gray-100 px-4 py-3 text-sm font-bold text-red-600 dark:bg-white/5">
          برداشتن مشتری (حضوری)
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone = "gray" }: { label: string; value: string; sub?: string; tone?: "red" | "green" | "gray" }) {
  const c = tone === "red" ? "text-rose-600" : tone === "green" ? "text-emerald-600" : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-2xl border border-gray-100 p-3 dark:border-white/5">
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className={`mt-0.5 text-lg font-black tabular-nums ${c}`}>{value}</p>
      {sub && <p className="text-[11px] font-bold text-gray-400">{sub}</p>}
    </div>
  );
}

function Kv({ k, v, ltr, wide }: { k: string; v: string | null | undefined; ltr?: boolean; wide?: boolean }) {
  return (
    <p className={`flex gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="w-24 shrink-0 text-xs font-bold text-gray-400">{k}</span>
      <span className={`font-bold ${v ? "text-gray-800 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`} dir={ltr && v ? "ltr" : undefined}>
        {v ? (ltr ? faNum(v) : v) : "—"}
      </span>
    </p>
  );
}
