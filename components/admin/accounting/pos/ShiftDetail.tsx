"use client";

/** یک شیفت صندوق: خلاصه، رسیدها، و برای شیفت باز «بستن صندوق» (مدیر از دفتر هم می‌بندد) */

import { useCallback, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { api, btn, Card, ErrorText, PageHeader } from "../ui";
import { CloseShift, ShiftReport } from "./ShiftPanels";
import { B, TICKET_KIND, faNum, formatAmount, timeFa, type ShiftSummary } from "./shared";

interface Ticket {
  id: string;
  number: number;
  kind: string;
  createdAt: string;
  sellerName: string | null;
  partyName: string;
  saleTotal: string;
  returnTotal: string;
  cash: string;
  card: string;
}

export default function ShiftDetail({ id }: { id: string }) {
  const [s, setS] = useState<(ShiftSummary & { treasuryNames: Record<string, string> }) | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<NonNullable<typeof s>>(`/api/admin/accounting/pos/shifts/${id}`).then(setS).catch((e) => setError(e.message));
    api<{ tickets: Ticket[] }>(`/api/admin/accounting/pos/tickets?shiftId=${id}`).then((d) => setTickets(d.tickets)).catch(() => {});
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (!s) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">…</p>;
  const sh = s.shift;
  return (
    <div className="space-y-4">
      <PageHeader
        title={`${sh.terminal.name} — شیفت ${faNum(sh.number)}`}
        help="accountingPosClose"
        back={{ href: "/admin/accounting/pos?tab=shifts", label: "شیفت‌ها" }}
        desc={`باز: ${formatJalali(new Date(sh.openedAt))} ${timeFa(sh.openedAt)} (${sh.openedByName})${sh.closedAt ? ` · بسته: ${timeFa(sh.closedAt)} (${sh.closedByName})` : " · هنوز باز"}`}
        actions={
          sh.status === "CLOSED" ? (
            <a href={`/admin/accounting/pos/shifts/${id}/print`} target="_blank" rel="noreferrer" className={btn.soft}>
              <Printer className="h-4 w-4" aria-hidden /> چاپ گزارش
            </a>
          ) : undefined
        }
      />
      <Card className="p-4">{sh.status === "OPEN" ? <CloseShift shiftId={id} onClosed={() => { window.open(`/admin/accounting/pos/shifts/${id}/print?auto=1`, "_blank"); load(); }} /> : <ShiftReport s={s} names={s.treasuryNames} />}</Card>
      <Card className="overflow-hidden">
        <p className="px-4 pt-3 text-sm font-black">رسیدها ({faNum(tickets.length)})</p>
        <div className="divide-y divide-[var(--adm-border)]">
          {tickets.map((t) => {
            const n = B(t.saleTotal) - B(t.returnTotal);
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-12 font-black tabular-nums">{faNum(t.number)}</span>
                <span className="min-w-0 flex-1 text-xs">
                  <b>{TICKET_KIND[t.kind]}</b>
                  <span className="text-gray-400">
                    {" "}
                    · {timeFa(t.createdAt)} · {t.sellerName ?? "—"} · {t.partyName}
                  </span>
                </span>
                <span className="hidden text-[11px] text-gray-400 sm:inline">
                  نقد {formatAmount(t.cash)} · کارت {formatAmount(t.card)}
                </span>
                <span className={`w-28 text-left font-black tabular-nums ${n < 0n ? "text-rose-600" : ""}`}>{formatAmount(n)}</span>
                <a href={`/admin/accounting/pos/tickets/${t.id}/print`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-900 dark:hover:text-white" aria-label="چاپ">
                  <Printer className="h-4 w-4" aria-hidden />
                </a>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
