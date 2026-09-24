"use client";

/** یک چک — مشخصات، تاریخچه‌ی گذارها با سند هر کدام، و گذارهای مجاز بعدی */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { amountToWords, faNum } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, Money, PageHeader, SectionTitle, Sheet } from "../ui";
import { CHEQUE_LABEL, chequeTone } from "./ChequesList";
import { KIND_LABELS } from "./MoneyForm";

type Dir = "RECEIVED" | "ISSUED";
interface Data {
  cheque: {
    id: string;
    direction: Dir;
    status: string;
    serialNo: string;
    sayadId: string | null;
    sayadRegistered: boolean;
    bankName: string;
    branch: string | null;
    ownerName: string | null;
    amount: string;
    issueDate: string | null;
    dueDate: string;
    treasuryId: string | null;
    holderPartyId: string | null;
    note: string | null;
    createdByName: string;
    party: { id: string; name: string; mobile: string | null };
    events: { id: string; from: string | null; to: string; date: string; voucherId: string | null; partyId: string | null; treasuryId: string | null; moneyDocId: string | null; note: string | null; byName: string }[];
  };
  names: Record<string, string>;
  banks: { id: string; name: string }[];
  vouchers: Record<string, number>;
  money: { id: string; kind: "RECEIPT" | "PAYMENT" | "TRANSFER"; number: number } | null;
  moves: { to: string; label: string; needsBank: boolean }[];
  canUndo: boolean;
  can: { manage: boolean };
}

export default function ChequeDetail({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [move, setMove] = useState<{ to: string; label: string; needsBank: boolean; date: string; treasuryId: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/cheques/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function post(json: object) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/cheques/${id}`, { method: "POST", json });
      setMove(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!d) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const c = d.cheque;
  const received = c.direction === "RECEIVED";
  const open = ["IN_HAND", "IN_COLLECTION", "ISSUED"].includes(c.status);
  const late = open && c.dueDate.slice(0, 10) < dayValue(todayKey());

  return (
    <div className="space-y-4">
      <PageHeader
        title={`چک ${received ? "دریافتی" : "صادره"} ${faNum(c.serialNo)}`}
        help="accountingCheque"
        back={{ href: `/admin/accounting/cheques?dir=${c.direction}`, label: "چک‌ها" }}
      />
      <ErrorText>{error}</ErrorText>

      <Card className="p-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={chequeTone(c.status)}>{CHEQUE_LABEL(c.direction, c.status)}</Badge>
            {late && <Badge tone="red">سررسید گذشته</Badge>}
            {c.sayadId && <Badge tone={c.sayadRegistered ? "green" : "amber"}>{c.sayadRegistered ? "در صیاد ثبت شده" : "در صیاد ثبت نشده"}</Badge>}
          </div>
          <p>
            {received ? "از" : "به"}{" "}
            <Link href={`/admin/accounting/parties/${c.party.id}`} className="font-black text-blue-600">
              {c.party.name}
            </Link>
            {c.holderPartyId && (
              <>
                {" "}· خرج شد به{" "}
                <Link href={`/admin/accounting/parties/${c.holderPartyId}`} className="font-bold text-blue-600">
                  {d.names[c.holderPartyId]}
                </Link>
              </>
            )}
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Info k="بانک" v={`${c.bankName}${c.branch ? ` — ${c.branch}` : ""}`} />
            <Info k="سررسید" v={formatJalali(new Date(c.dueDate))} />
            {c.sayadId && <Info k="صیادی" v={faNum(c.sayadId)} />}
            {c.ownerName && <Info k="صاحب حساب" v={c.ownerName} />}
            {c.treasuryId && <Info k={received ? "بانک وصول" : "از حساب"} v={d.names[c.treasuryId] ?? "—"} />}
            {d.money && (
              <Info
                k="ثبت در"
                v={
                  <Link href={`/admin/accounting/money/${d.money.id}`} className="text-blue-600">
                    {KIND_LABELS[d.money.kind]} {faNum(d.money.number)}
                  </Link>
                }
              />
            )}
          </dl>
          {c.note && <p className="text-xs text-gray-500">{c.note}</p>}
        </div>
        <div className="md:text-left md:border-r border-gray-100 dark:border-white/5 md:pr-5">
          <Money value={c.amount} className="text-2xl" />
          <p className="text-[11px] text-gray-400 max-w-[16rem]">{amountToWords(c.amount)} تومان</p>
        </div>
      </Card>

      {d.can.manage && (d.moves.length > 0 || d.canUndo || c.sayadId) && (
        <Card className="p-4 space-y-3">
          <SectionTitle title="کار بعدی" help="accountingCheque" />
          <div className="flex flex-wrap gap-2">
            {d.moves.map((m) => (
              <button
                key={m.to + m.label}
                onClick={() => setMove({ ...m, date: dayValue(todayKey()), treasuryId: c.treasuryId ?? d.banks[0]?.id ?? "", note: "" })}
                className={m.to === "BOUNCED" ? btn.danger : m.to === "CLEARED" ? btn.primary : btn.soft}
              >
                {m.label}
              </button>
            ))}
            {received && c.status === "IN_HAND" && (
              <Link href={`/admin/accounting/money/new?kind=PAYMENT`} className={btn.soft}>
                خرج به شخص دیگر (از فرم پرداخت)
              </Link>
            )}
            {c.sayadId && (
              <button onClick={() => post({ action: "sayad", registered: !c.sayadRegistered })} className={btn.small}>
                {c.sayadRegistered ? "برداشتن تیک ثبت صیاد" : "✓ در صیاد ثبت شد"}
              </button>
            )}
            {d.canUndo && (
              <button onClick={() => window.confirm("آخرین گذار این چک برگردانده شود؟ سندش باطل می‌شود.") && post({ action: "undo" })} disabled={busy} className={`${btn.small} mr-auto`}>
                ↶ برگرداندن آخرین گذار
              </button>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <SectionTitle title="تاریخچه" />
        <ol className="relative border-r-2 border-gray-100 dark:border-white/10 mr-2 space-y-4">
          {d.cheque.events.map((e) => (
            <li key={e.id} className="pr-4 relative">
              <span className="absolute -right-[7px] top-1.5 w-3 h-3 rounded-full bg-blue-500" />
              <p className="text-sm font-bold">
                {e.from ? `${CHEQUE_LABEL(c.direction, e.from)} ← ` : "ثبت · "}
                {CHEQUE_LABEL(c.direction, e.to)}
              </p>
              <p className="text-[11px] text-gray-400">
                {formatJalali(new Date(e.date))} · {e.byName}
                {e.treasuryId && ` · ${d.names[e.treasuryId] ?? ""}`}
                {e.partyId && ` · به ${d.names[e.partyId] ?? ""}`}
                {e.voucherId && d.vouchers[e.voucherId] && (
                  <>
                    {" · "}
                    <Link href={`/admin/accounting/vouchers/${e.voucherId}`} className="text-blue-600">
                      سند {faNum(d.vouchers[e.voucherId])}
                    </Link>
                  </>
                )}
              </p>
              {e.note && <p className="text-xs text-gray-500">{e.note}</p>}
            </li>
          ))}
        </ol>
      </Card>

      {move && (
        <Sheet
          open
          onClose={() => setMove(null)}
          title={move.label}
          help="accountingCheque"
          footer={
            <button onClick={() => post({ action: "move", to: move.to, date: move.date, treasuryId: move.treasuryId, note: move.note })} disabled={busy} className={`${btn.primary} w-full`}>
              {busy ? "در حال ثبت…" : `ثبت «${move.label}»`}
            </button>
          }
        >
          <div className="space-y-3">
            <Field label="تاریخ">
              <JalaliDatePicker value={move.date} onChange={(v) => setMove({ ...move, date: v })} clearable={false} />
            </Field>
            {move.needsBank && (
              <Field label="حساب بانکی">
                <select value={move.treasuryId} onChange={(e) => setMove({ ...move, treasuryId: e.target.value })} className={inputCls}>
                  {d.banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="توضیح (اختیاری)">
              <input value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-gray-400 inline">{k}: </dt>
      <dd className="inline font-bold text-gray-700 dark:text-gray-200">{v}</dd>
    </div>
  );
}
