"use client";

/**
 * کارت اشتراک — docs/plans/webhesab-parity.md بخش ۲۳.
 * زبانه‌ها: کارت‌ها (با اعتبار هر عضو) · گردش · نزدیک انقضا · ورود از نرم‌افزار قبلی.
 * هر سطر و هر عدد کلیک‌پذیر است: عضو ← پنجره‌ی گردش، رسید/فاکتور/سفارش ← صفحه‌ی خودش.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Card, Button, Field, DateField, Select, ErrorBox, Notice, Empty, Skeleton, Table, Badge, useApi, PageHeader, fa, faDate, apiSend, type ApiError,
} from "@/components/admin/sms/ui";
import HelpButton from "@/components/admin/worklist/HelpButton";

type Tab = "cards" | "moves" | "expiring" | "import";
interface TierLite { id: string; title: string; cardChargeBp: number | null; posDiscountBp: number; manualOnly: boolean }
interface Row {
  cardId: string; number: string; isActive: boolean; issuedAt: string; profileId: string; name: string; mobile: string;
  tier: { id: string; title: string; color: string | null } | null; credit: string; negative: boolean;
  nextExpiry: { at: string; credit: string } | null; expiringSoon: string;
}
interface ListData {
  settings: { posEnabled: boolean; enforceExpiry: boolean; rate: number; expiryDays: number };
  totals: { cards: number; credit: string; expiringSoon: string; negative: number };
  rows: Row[]; truncated: boolean; tiers: TierLite[]; redeemOnline: boolean; expiryDays: number;
}

const toman = (v: string | number) => `${fa(v)} تومان`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default function ClubCards() {
  const [tab, setTab] = useState<Tab>("cards");
  const [member, setMember] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qx, setQx] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("credit");
  const list = useApi<ListData>(`/api/admin/club/cards?q=${encodeURIComponent(qx)}&tier=${tier}&status=${status}&sort=${sort}`);
  const [err, setErr] = useState<ApiError | null>(null);
  const [issue, setIssue] = useState(false);

  useEffect(() => {
    const h = window.setTimeout(() => setQx(q), 350);
    return () => window.clearTimeout(h);
  }, [q]);

  async function setting(data: Record<string, unknown>) {
    const r = await apiSend("/api/admin/club/cards", "PATCH", data);
    if (!r.ok) setErr(r.err);
    list.reload();
  }

  const d = list.data;
  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="کارت اشتراک"
        hint="کارت مشتریان ویژه: از هر خرید درصدی شارژ می‌شود و در خرید بعدی (فروشگاه و سایت) خرج می‌شود. اعتبار هر عضو در کیف پول حساب کاربری‌اش هم دیده می‌شود."
        action={
          <div className="flex items-center gap-2">
            <HelpButton topic="clubCards" />
            <Button onClick={() => setIssue(true)}>صدور کارت</Button>
          </div>
        }
      />
      <ErrorBox err={err ?? list.err} onRetry={list.err ? list.reload : undefined} />

      {d && (
        <Card title="تنظیمات">
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              on={d.settings.posEnabled}
              onChange={(v) => setting({ clubCardPosEnabled: v })}
              label="کارت اشتراک در صندوق"
              hint="کشیدن کارت در صندوق مشتری را انتخاب می‌کند، شارژ هر خرید و «پرداخت از کارت» فعال می‌شود."
            />
            <Toggle
              on={d.settings.enforceExpiry}
              onChange={(v) => setting({ pointExpiryEnforced: v })}
              label="سوخت شارژ تاریخ‌گذشته"
              hint={`هر شارژ ${d.expiryDays ? `${fa(d.expiryDays)} روز` : "بی‌انقضا"} اعتبار دارد؛ خاموش = هیچ اعتباری نمی‌سوزد.`}
            />
          </div>
          <p className="text-[11px] font-bold leading-6 text-gray-500">
            درصد شارژ و تخفیف هر سطح در <Link href="/admin/club/tiers" className="text-primary-600 hover:underline">سطوح عضویت</Link> تنظیم می‌شود
            {d.tiers.some((t) => t.cardChargeBp != null) ? ` (${d.tiers.filter((t) => t.cardChargeBp != null).map((t) => `${t.title}: ${fa(t.cardChargeBp! / 100)}٪`).join("، ")})` : " — هنوز هیچ سطحی درصد شارژ ندارد"}.
            {" "}خرج اعتبار در خرید اینترنتی: <b>{d.redeemOnline ? "روشن" : "خاموش"}</b> (
            <Link href="/admin/club/settings" className="text-primary-600 hover:underline">تنظیمات باشگاه ← استفاده از امتیاز</Link>).
            مدت اعتبار هر شارژ:{" "}
            <ExpiryDays key={d.expiryDays} value={d.expiryDays} onSave={(v) => setting({ pointExpiryDays: v })} />
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {([["cards", "کارت‌ها"], ["moves", "گردش اعتبار"], ["expiring", "نزدیک انقضا"], ["import", "ورود از نرم‌افزار قبلی"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-xs font-black ${tab === k ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "cards" && (
        <>
          {d && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="کارت" value={fa(d.totals.cards)} onClick={() => setStatus("active")} />
              <Stat label="جمع اعتبار (تعهد)" value={toman(d.totals.credit)} onClick={() => setSort("credit")} />
              <Stat label="منقضی تا ۳۰ روز" value={toman(d.totals.expiringSoon)} onClick={() => setTab("expiring")} />
              <Stat label="مانده‌ی منفی" value={fa(d.totals.negative)} onClick={() => setSort("credit")} />
            </div>
          )}
          <Card>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="جستجو" value={q} onChange={setQ} placeholder="نام، موبایل یا شماره‌ی کارت" />
              <Select label="سطح" value={tier} onChange={setTier} options={[{ value: "", label: "همه" }, ...(d?.tiers ?? []).map((t) => ({ value: t.id, label: t.title }))]} />
              <Select label="وضعیت" value={status} onChange={setStatus} options={[{ value: "active", label: "فعال" }, { value: "inactive", label: "غیرفعال" }, { value: "all", label: "همه" }]} />
              <Select label="ترتیب" value={sort} onChange={setSort} options={[{ value: "credit", label: "بیشترین اعتبار" }, { value: "expiry", label: "زودترین انقضا" }, { value: "name", label: "نام" }, { value: "recent", label: "تازه‌ترین صدور" }]} />
            </div>
            {list.loading ? (
              <Skeleton rows={6} />
            ) : !d?.rows.length ? (
              <Empty text="کارتی پیدا نشد. «صدور کارت» یا «ورود از نرم‌افزار قبلی» را بزنید." />
            ) : (
              <Table head={["مشتری", "موبایل", "کارت", "سطح", "اعتبار", "انقضای بعدی", ""]}>
                {d.rows.map((r) => (
                  <tr key={r.cardId} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setMember(r.profileId)}>
                    <td className="py-2.5 text-[11px] font-black text-gray-800 dark:text-gray-100">{r.name}</td>
                    <td className="py-2.5 text-[11px] font-bold tabular-nums text-gray-500" dir="ltr">{r.mobile}</td>
                    <td className="py-2.5 text-[11px] font-bold tabular-nums text-gray-500" dir="ltr">{r.number}</td>
                    <td className="py-2.5 text-[11px] font-bold">
                      {r.tier ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.tier.color ?? "#999" }} />
                          {r.tier.title}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`py-2.5 text-[11px] font-black tabular-nums ${r.negative ? "text-red-600" : "text-gray-800 dark:text-gray-100"}`}>{toman(r.credit)}</td>
                    <td className="py-2.5 text-[11px] font-bold text-gray-500">{r.nextExpiry ? `${toman(r.nextExpiry.credit)} · ${faDate(r.nextExpiry.at)}` : "—"}</td>
                    <td className="py-2.5 text-left">{!r.isActive && <Badge text="غیرفعال" tone="muted" />}</td>
                  </tr>
                ))}
              </Table>
            )}
            {d?.truncated && <p className="text-[10px] font-bold text-gray-400">فقط ۵۰۰ سطر اول نشان داده شد؛ جستجو کنید.</p>}
          </Card>
        </>
      )}

      {tab === "moves" && <Movements onMember={setMember} />}
      {tab === "expiring" && <Expiring onMember={setMember} enforced={!!d?.settings.enforceExpiry} />}
      {tab === "import" && <Import tiers={d?.tiers ?? []} onDone={() => { list.reload(); setTab("cards"); }} />}

      {member && <MemberSheet profileId={member} onClose={() => setMember(null)} onChanged={list.reload} />}
      {issue && <IssueSheet tiers={d?.tiers ?? []} onClose={() => setIssue(false)} onDone={(pid) => { setIssue(false); list.reload(); setMember(pid); }} />}
    </div>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button onClick={() => onChange(!on)} className={`flex items-start gap-3 rounded-2xl border p-3 text-right ${on ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-white/10"}`}>
      <span className={`mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${on ? "bg-emerald-500" : "bg-gray-300 dark:bg-white/20"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${on ? "-translate-x-4" : ""}`} />
      </span>
      <span>
        <span className="block text-xs font-black text-gray-800 dark:text-gray-100">{label}</span>
        <span className="mt-1 block text-[11px] font-bold leading-5 text-gray-500">{hint}</span>
      </span>
    </button>
  );
}

function ExpiryDays({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <span className="inline-flex items-center gap-1">
      <input value={v} onChange={(e) => setV(e.target.value)} dir="ltr" className="w-16 rounded-lg border border-gray-200 px-2 py-0.5 text-center text-[11px] dark:border-white/10 dark:bg-white/5" />
      روز
      {v !== String(value) && (
        <button onClick={() => onSave(Number(v.replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x)))) || 0)} className="font-black text-primary-600">
          ذخیره
        </button>
      )}
    </span>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-gray-200 bg-white p-4 text-right hover:border-primary-400 dark:border-white/10 dark:bg-white/5">
      <span className="block text-[11px] font-bold text-gray-500">{label}</span>
      <span className="mt-1 block text-lg font-black tabular-nums text-gray-900 dark:text-white">{value}</span>
    </button>
  );
}

// ── گردش ──
interface Moves {
  sums: Record<string, { label: string; count: number; amount: string }>;
  rows: { id: string; kind: string; label: string; amount: string; createdAt: string; profileId: string; name: string; mobile: string; refType: string | null; refId: string | null }[];
  truncated: boolean;
}
function Movements({ onMember }: { onMember: (id: string) => void }) {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [kind, setKind] = useState("");
  const m = useApi<Moves>(`/api/admin/club/cards/report?view=movements&from=${from}&to=${to}&kind=${kind}`);
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <DateField label="از" value={from} onChange={setFrom} />
        <DateField label="تا" value={to} onChange={setTo} />
      </div>
      <ErrorBox err={m.err} />
      {m.data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(m.data.sums)
            .filter(([, s]) => s.count)
            .map(([k, s]) => (
              <button key={k} onClick={() => setKind(kind === k ? "" : k)} className={`rounded-2xl border p-3 text-right ${kind === k ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10" : "border-gray-200 dark:border-white/10"}`}>
                <span className="block text-[11px] font-bold text-gray-500">{s.label} ({fa(s.count)})</span>
                <span className="block text-sm font-black tabular-nums">{toman(s.amount)}</span>
              </button>
            ))}
        </div>
      )}
      {m.loading ? (
        <Skeleton rows={6} />
      ) : !m.data?.rows.length ? (
        <Empty text="در این بازه گردشی نیست" />
      ) : (
        <Table head={["تاریخ", "مشتری", "شرح", "مبلغ", ""]}>
          {m.data.rows.map((r) => (
            <tr key={r.id}>
              <td className="py-2 text-[11px] font-bold text-gray-500">{faDate(r.createdAt)}</td>
              <td className="py-2 text-[11px] font-black">
                <button onClick={() => onMember(r.profileId)} className="text-primary-600 hover:underline">{r.name}</button>
              </td>
              <td className="py-2 text-[11px] font-bold">{r.label}</td>
              <td className={`py-2 text-[11px] font-black tabular-nums ${Number(r.amount) < 0 ? "text-red-600" : "text-emerald-600"}`}>{fa(r.amount)}</td>
              <td className="py-2 text-left"><RefLink refType={r.refType} refId={r.refId} /></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

function RefLink({ refType, refId }: { refType: string | null; refId: string | null }) {
  if (!refId) return null;
  if (refType?.startsWith("pos")) return <Link href={`/admin/accounting/pos/tickets/${refId}/print`} target="_blank" className="text-[10px] font-black text-primary-600 hover:underline">رسید</Link>;
  if (refType === "order" || refType === "order_refund") return <Link href={`/admin/orders/${refId}`} className="text-[10px] font-black text-primary-600 hover:underline">سفارش</Link>;
  return null;
}

// ── نزدیک انقضا ──
function Expiring({ onMember, enforced }: { onMember: (id: string) => void; enforced: boolean }) {
  const [days, setDays] = useState("30");
  const e = useApi<{ rows: { profileId: string; name: string; mobile: string; credit: string; first: string | null }[]; total: string }>(`/api/admin/club/cards/report?view=expiring&days=${Number(days) || 30}`);
  return (
    <Card hint={enforced ? "این اعتبارها تا تاریخ گفته‌شده خرج نشوند می‌سوزند — برای یادآوری به مشتری از کمپین پیامکی استفاده کنید." : "سوخت خاموش است؛ این فهرست فقط تاریخ اعتبار هر شارژ را نشان می‌دهد."}>
      <div className="flex flex-wrap items-end gap-3">
        <Select label="تا" value={days} onChange={setDays} options={[["7", "۷ روز"], ["30", "۳۰ روز"], ["90", "۹۰ روز"], ["365", "یک سال"]].map(([v, l]) => ({ value: v, label: l }))} />
        {e.data && <p className="text-sm font-black">جمع: {toman(e.data.total)}</p>}
      </div>
      {e.loading ? (
        <Skeleton rows={5} />
      ) : !e.data?.rows.length ? (
        <Empty text="اعتباری در این بازه منقضی نمی‌شود" />
      ) : (
        <Table head={["مشتری", "موبایل", "مبلغ", "اولین انقضا"]}>
          {e.data.rows.map((r) => (
            <tr key={r.profileId} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => onMember(r.profileId)}>
              <td className="py-2 text-[11px] font-black text-primary-600">{r.name}</td>
              <td className="py-2 text-[11px] font-bold tabular-nums" dir="ltr">{r.mobile}</td>
              <td className="py-2 text-[11px] font-black tabular-nums">{toman(r.credit)}</td>
              <td className="py-2 text-[11px] font-bold">{r.first ? faDate(r.first) : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

// ── ورود ──
interface Preview {
  rows: { line: number; number: string; mobile: string; name: string; tierTitle: string | null; amount: string; expiresAt: string | null }[];
  errors: { line: number; text: string }[];
  warnings: { line: number; text: string }[];
  summary: { lines: number; members: number; cards: number; credit: string };
}
function Import({ tiers, onDone }: { tiers: TierLite[]; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [unit, setUnit] = useState<"toman" | "rial">("toman");
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(commit: boolean) {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    if (file) fd.append("file", file);
    else fd.append("text", text);
    fd.append("unit", unit);
    if (commit) fd.append("commit", "1");
    try {
      const res = await fetch("/api/admin/club/cards/import", { method: "POST", body: fd });
      const b = await res.json();
      if (!res.ok) setErr({ error: b.error ?? "خطا" });
      else if (commit) {
        setDone(`${fa(b.result.members)} دارنده‌ی کارت وارد شد (${fa(b.result.newUsers)} مشتری تازه) — ${toman(b.summary.credit)} مانده`);
        setPv(null);
        onDone();
      } else setPv(b.preview);
    } catch {
      setErr({ error: "ارتباط با سرور برقرار نشد" });
    }
    setBusy(false);
  }

  return (
    <Card
      title="ورود کارت و مانده از نرم‌افزار قبلی"
      hint="سطر اول عنوان ستون‌ها: «شماره کارت»، «موبایل»، «نام»، «گروه» (نام سطح)، «مانده»، «انقضا» (شمسی). هر عضو چند سطر می‌تواند داشته باشد (هر شارژ با تاریخ انقضای خودش). اجرای دوباره، مانده‌های ورودی قبلی همان عضو را جایگزین می‌کند — پس روز قطع نرم‌افزار قبلی، فایل تازه را دوباره وارد کنید."
    >
      {done && <Notice text={done} ok />}
      <ErrorBox err={err} />
      {!tiers.length && <Notice text="هنوز سطحی تعریف نشده؛ اگر فایل ستون «گروه» دارد اول در «سطوح عضویت» سطح بسازید (مثلاً vip با شارژ ۱۰٪ و «دستی»)." ok={false} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">فایل اکسل (xlsx) یا CSV</span>
          <input type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPv(null); }} className="mt-1.5 block w-full text-xs" />
        </label>
        <Select label="واحد مبلغ فایل" value={unit} onChange={(v) => { setUnit(v as "toman" | "rial"); setPv(null); }} options={[{ value: "toman", label: "تومان" }, { value: "rial", label: "ریال (تقسیم بر ۱۰)" }]} />
      </div>
      {!file && (
        <textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setPv(null); }} placeholder="یا جدول را از اکسل کپی کنید و اینجا بچسبانید" className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800" dir="ltr" />
      )}
      <div className="flex gap-2">
        <Button onClick={() => send(false)} disabled={busy || (!file && !text.trim())}>{busy && !pv ? "در حال بررسی…" : "بررسی"}</Button>
        {pv && !pv.errors.length && <Button onClick={() => send(true)} disabled={busy}>{busy ? "در حال ثبت…" : `ثبت ${fa(pv.summary.members)} عضو`}</Button>}
      </div>
      {pv && (
        <div className="space-y-3">
          <p className="text-xs font-black">
            {fa(pv.summary.lines)} سطر · {fa(pv.summary.members)} عضو · {fa(pv.summary.cards)} کارت · {toman(pv.summary.credit)} مانده
          </p>
          {pv.errors.length > 0 && (
            <div className="rounded-xl bg-red-50 p-3 text-[11px] font-bold leading-6 text-red-700 dark:bg-red-500/10">
              {pv.errors.slice(0, 30).map((e, i) => <p key={i}>سطر {fa(e.line)}: {e.text}</p>)}
              {pv.errors.length > 30 && <p>و {fa(pv.errors.length - 30)} خطای دیگر</p>}
            </div>
          )}
          {pv.warnings.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-[11px] font-bold leading-6 text-amber-700 dark:bg-amber-500/10">
              {pv.warnings.slice(0, 20).map((e, i) => <p key={i}>سطر {fa(e.line)}: {e.text}</p>)}
            </div>
          )}
          <Table head={["سطر", "کارت", "موبایل", "نام", "سطح", "مانده", "انقضا"]}>
            {pv.rows.map((r) => (
              <tr key={r.line}>
                <td className="py-1.5 text-[11px]">{fa(r.line)}</td>
                <td className="py-1.5 text-[11px] tabular-nums" dir="ltr">{r.number}</td>
                <td className="py-1.5 text-[11px] tabular-nums" dir="ltr">{r.mobile}</td>
                <td className="py-1.5 text-[11px]">{r.name}</td>
                <td className="py-1.5 text-[11px]">{r.tierTitle ?? "—"}</td>
                <td className="py-1.5 text-[11px] tabular-nums">{fa(r.amount)}</td>
                <td className="py-1.5 text-[11px]">{r.expiresAt ? faDate(r.expiresAt) : "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Card>
  );
}

// ── صدور کارت ──
function IssueSheet({ tiers, onClose, onDone }: { tiers: TierLite[]; onClose: () => void; onDone: (profileId: string) => void }) {
  const [f, setF] = useState({ mobile: "", name: "", number: "", tierId: tiers.find((t) => t.manualOnly)?.id ?? "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await apiSend<{ profileId: string }>("/api/admin/club/cards", "POST", f);
    setBusy(false);
    if (!r.ok) return setErr(r.err);
    onDone(r.data.profileId);
  }
  return (
    <Sheet title="صدور کارت اشتراک" onClose={onClose}>
      <ErrorBox err={err} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="موبایل مشتری" dir="ltr" value={f.mobile} onChange={(v) => setF({ ...f, mobile: v })} placeholder="09…" />
        <Field label="نام" value={f.name} onChange={(v) => setF({ ...f, name: v })} hint="اگر مشتری از قبل هست نامش عوض نمی‌شود" />
        <Field label="شماره‌ی کارت" dir="ltr" value={f.number} onChange={(v) => setF({ ...f, number: v })} hint="کارت را روی کارت‌خوان بکشید؛ خالی = شماره موبایل" />
        <Select label="سطح" value={f.tierId} onChange={(v) => setF({ ...f, tierId: v })} options={[{ value: "", label: "بدون تغییر" }, ...tiers.map((t) => ({ value: t.id, label: t.title }))]} />
      </div>
      <p className="text-[11px] font-bold leading-6 text-gray-500">اگر مشتری کارت فعال دیگری دارد، آن کارت غیرفعال و این کارت جایگزینش می‌شود (کارت گم‌شده). اعتبار عوض نمی‌شود.</p>
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy || !f.mobile.trim()}>{busy ? "در حال ثبت…" : "صدور کارت"}</Button>
      </div>
    </Sheet>
  );
}

// ── پنجره‌ی عضو ──
interface Member {
  profileId: string; name: string; mobile: string; partyId: string | null; userId: string;
  tier: { title: string; color: string | null; cardChargeBp: number | null; posDiscountBp: number } | null;
  cards: { id: string; number: string; isActive: boolean; issuedAt: string; note: string | null }[];
  credit: string; enforceExpiry: boolean; expiredUnposted: string;
  lots: { id: string; credit: string; of: string; expiresAt: string | null; createdAt: string }[];
  ledger: { id: string; label: string; note: string | null; amount: string; balance: string; createdAt: string; expiresAt: string | null; ticket: { id: string; number: number; invoiceId: string | null } | null; orderId: string | null }[];
}
function MemberSheet({ profileId, onClose, onChanged }: { profileId: string; onClose: () => void; onChanged: () => void }) {
  const m = useApi<Member>(`/api/admin/club/cards/member?profileId=${profileId}`);
  const [adj, setAdj] = useState({ amount: "", note: "", days: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function adjust(sign: 1 | -1) {
    setBusy(true);
    setErr(null);
    const amt = adj.amount.replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x))).replace(/\D/g, "");
    const r = await apiSend("/api/admin/club/cards/member", "POST", { profileId, amount: sign < 0 ? `-${amt}` : amt, note: adj.note, expiryDays: adj.days || null });
    setBusy(false);
    if (!r.ok) return setErr(r.err);
    setAdj({ amount: "", note: "", days: "" });
    m.reload();
    onChanged();
  }
  async function toggle(cardId: string, isActive: boolean) {
    const r = await apiSend(`/api/admin/club/cards/${cardId}`, "PATCH", { isActive });
    if (!r.ok) return setErr(r.err);
    m.reload();
    onChanged();
  }

  const d = m.data;
  return (
    <Sheet title={d ? d.name : "…"} onClose={onClose} wide>
      <ErrorBox err={err ?? m.err} />
      {!d ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-300">
            <span dir="ltr">{d.mobile}</span>
            {d.tier && <span>سطح {d.tier.title}{d.tier.cardChargeBp != null ? ` · شارژ ${fa(d.tier.cardChargeBp / 100)}٪` : ""}{d.tier.posDiscountBp ? ` · تخفیف ${fa(d.tier.posDiscountBp / 100)}٪` : ""}</span>}
            {d.partyId && <Link href={`/admin/accounting/parties/${d.partyId}`} className="text-primary-600 hover:underline">صورت‌حساب مشتری</Link>}
            <Link href={`/admin/users/${d.userId}`} className="text-primary-600 hover:underline">حساب کاربری</Link>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">اعتبار قابل خرج</p>
            <p className={`text-2xl font-black tabular-nums ${Number(d.credit) < 0 ? "text-red-600" : ""}`}>{toman(d.credit)}</p>
            {Number(d.expiredUnposted) > 0 && <p className="text-[11px] font-bold text-gray-500">{toman(d.expiredUnposted)} تاریخ‌گذشته (در اجرای بعدی می‌سوزد)</p>}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-black">کارت‌ها</p>
            {d.cards.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-bold dark:border-white/10">
                <span dir="ltr" className="tabular-nums">{c.number}</span>
                <span className="text-gray-500">{faDate(c.issuedAt)}{c.note ? ` · ${c.note}` : ""}</span>
                <button onClick={() => toggle(c.id, !c.isActive)} className={c.isActive ? "text-red-600" : "text-emerald-600"}>{c.isActive ? "غیرفعال کردن" : "فعال کردن"}</button>
              </div>
            ))}
          </div>

          {d.lots.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-black">شارژهای باز (از زودانقضاترین خرج می‌شوند)</p>
              <div className="flex flex-wrap gap-2">
                {d.lots.map((l) => (
                  <span key={l.id} className="rounded-xl bg-gray-100 px-3 py-1.5 text-[11px] font-bold tabular-nums dark:bg-white/5">
                    {toman(l.credit)}{l.credit !== l.of ? ` از ${fa(l.of)}` : ""} · {l.expiresAt ? `تا ${faDate(l.expiresAt)}` : "بی‌انقضا"}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 rounded-2xl border border-gray-200 p-3 sm:grid-cols-4 dark:border-white/10">
            <Field label="مبلغ (تومان)" dir="ltr" value={adj.amount} onChange={(v) => setAdj({ ...adj, amount: v })} />
            <Field label="دلیل" value={adj.note} onChange={(v) => setAdj({ ...adj, note: v })} />
            <Field label="اعتبار (روز، شارژ)" dir="ltr" value={adj.days} onChange={(v) => setAdj({ ...adj, days: v })} hint="خالی = پیش‌فرض" />
            <div className="flex items-end gap-2">
              <Button onClick={() => adjust(1)} disabled={busy || !adj.amount || !adj.note}>شارژ</Button>
              <Button variant="danger" onClick={() => adjust(-1)} disabled={busy || !adj.amount || !adj.note}>کسر</Button>
            </div>
          </div>

          <Table head={["تاریخ", "شرح", "مبلغ", "مانده", "اعتبار تا", ""]}>
            {d.ledger.map((r) => (
              <tr key={r.id}>
                <td className="py-1.5 text-[11px] font-bold text-gray-500">{faDate(r.createdAt)}</td>
                <td className="py-1.5 text-[11px] font-bold" title={r.note ?? undefined}>{r.label}</td>
                <td className={`py-1.5 text-[11px] font-black tabular-nums ${Number(r.amount) < 0 ? "text-red-600" : "text-emerald-600"}`}>{fa(r.amount)}</td>
                <td className="py-1.5 text-[11px] font-bold tabular-nums">{fa(r.balance)}</td>
                <td className="py-1.5 text-[11px] text-gray-500">{r.expiresAt ? faDate(r.expiresAt) : ""}</td>
                <td className="py-1.5 text-left text-[10px] font-black">
                  {r.ticket && <Link href={`/admin/accounting/pos/tickets/${r.ticket.id}/print`} target="_blank" className="text-primary-600 hover:underline">رسید {fa(r.ticket.number)}</Link>}
                  {r.ticket?.invoiceId && <Link href={`/admin/accounting/invoices/${r.ticket.invoiceId}`} className="mr-2 text-primary-600 hover:underline">فاکتور</Link>}
                  {r.orderId && <Link href={`/admin/orders/${r.orderId}`} className="text-primary-600 hover:underline">سفارش</Link>}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Sheet>
  );
}

function Sheet({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:p-8" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-4xl" : "max-w-xl"} space-y-4 rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#111620]`} dir="rtl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black dark:bg-white/10">بستن</button>
        </div>
        {children}
      </div>
    </div>
  );
}
