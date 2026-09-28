"use client";

/**
 * تقویم سررسیدها (فاز ۱۰) — چک‌ها، قسط‌ها و فاکتورهای مدت‌دار روی ماه شمسی.
 * هفته از شنبه. هر روز: جمع ورودی (+) و خروجی (−) تسویه‌نشده؛ لمس روز ← فهرست
 * همان روز. رنگ تنها نشانه نیست — پیکان ورود/خروج کنار هر مبلغ است.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { formatJalali, toJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { faShort } from "@/components/admin/reports/charts";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Money, PageHeader, Stat } from "./ui";

interface Item {
  kind: "cheque" | "installment" | "invoice";
  dir: "in" | "out";
  id: string;
  date: string;
  amount: string;
  title: string;
  sub: string;
  href: string;
  done: boolean;
  bad?: boolean;
}
interface Data {
  month: { year: number; month: number; start: string; end: string };
  today: string;
  items: Item[];
  totals: { in: string; out: string; overdue: number; cash: string | null };
}

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const WEEK = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const KIND: Record<Item["kind"], string> = { cheque: "چک", installment: "قسط", invoice: "فاکتور" };
const DAY = 86_400_000;

export default function CalendarClient() {
  const now = toJalali(new Date());
  const [ym, setYm] = useState<[number, number]>([now.year, now.month]);
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const load = useCallback(() => {
    setD(null);
    api<Data>(`/api/admin/accounting/calendar?month=${ym[0]}-${ym[1]}`).then(setD).catch((e) => setError(e.message));
  }, [ym]);
  useEffect(load, [load]);

  const move = (n: number) =>
    setYm(([y, m]) => {
      const t = y * 12 + (m - 1) + n;
      setPicked(null);
      return [Math.floor(t / 12), (t % 12) + 1];
    });

  const items = useMemo(() => (d?.items ?? []).filter((i) => filter === "all" || i.dir === filter), [d, filter]);
  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      const k = i.date.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return m;
  }, [items]);

  const cells = useMemo(() => {
    if (!d) return [];
    const start = new Date(d.month.start).getTime();
    const end = new Date(d.month.end).getTime();
    const lead = (new Date(start).getUTCDay() + 1) % 7; // شنبه = ۰
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let t = start; t <= end; t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
    while (out.length % 7) out.push(null);
    return out;
  }, [d]);

  const todayKey = d?.today.slice(0, 10);
  const list = picked ? byDay.get(picked) ?? [] : items.filter((i) => !i.done);

  return (
    <div className="space-y-4">
      <PageHeader
        title="تقویم سررسیدها"
        help="accountingCalendar"
        desc="چک‌ها، اقساط و فاکتورهای مدت‌دار — هر روز چه پولی باید بیاید و چه پولی باید برود."
        actions={
          <Link href="/admin/accounting/installments" className={btn.soft}>
            فهرست اقساط
          </Link>
        }
      />

      {d && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="باید بیاید (این ماه)" value={<Money value={d.totals.in} tone="green" />} />
          <Stat label="باید برود (این ماه)" value={<Money value={d.totals.out} tone="red" />} />
          <Stat
            label="خالص ماه"
            value={<Money value={String(BigInt(d.totals.in) - BigInt(d.totals.out))} tone={BigInt(d.totals.in) >= BigInt(d.totals.out) ? "green" : "red"} />}
          />
          {d.totals.cash !== null ? (
            <Stat label="موجودی امروز نقد و بانک" value={<Money value={d.totals.cash} />} sub={d.totals.overdue ? `${faNum(d.totals.overdue)} مورد سررسید گذشته` : undefined} />
          ) : (
            <Stat label="سررسید گذشته" value={faNum(d.totals.overdue)} tone={d.totals.overdue ? "red" : "gray"} />
          )}
        </div>
      )}

      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={() => move(-1)} className={btn.small} aria-label="ماه قبل">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <div className="text-center">
            <p className="text-base font-black">
              {MONTHS[ym[1] - 1]} {faNum(ym[0])}
            </p>
            {(ym[0] !== now.year || ym[1] !== now.month) && (
              <button onClick={() => setYm([now.year, now.month])} className="text-[11px] font-bold text-blue-600">
                برو به این ماه
              </button>
            )}
          </div>
          <button onClick={() => move(1)} className={btn.small} aria-label="ماه بعد">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mb-3">
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "همه" },
              { value: "in", label: "ورودی‌ها" },
              { value: "out", label: "خروجی‌ها" },
            ]}
          />
        </div>
        <ErrorText>{error}</ErrorText>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400 mb-1">
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className={`grid grid-cols-7 gap-1 ${!d ? "opacity-50" : ""}`}>
          {(d ? cells : Array.from({ length: 35 }, () => null)).map((k, i) => {
            if (!k) return <div key={i} className="aspect-square sm:aspect-[4/3]" />;
            const its = (byDay.get(k) ?? []).filter((x) => !x.done);
            const inn = its.filter((x) => x.dir === "in").reduce((s, x) => s + BigInt(x.amount), 0n);
            const out = its.filter((x) => x.dir === "out").reduce((s, x) => s + BigInt(x.amount), 0n);
            const doneCount = (byDay.get(k) ?? []).filter((x) => x.done).length;
            const past = todayKey && k < todayKey;
            const isToday = k === todayKey;
            const sel = picked === k;
            const friday = i % 7 === 6;
            return (
              <button
                key={k}
                onClick={() => setPicked(sel ? null : k)}
                className={`aspect-square sm:aspect-[4/3] rounded-xl p-1 sm:p-1.5 flex flex-col text-right transition border ${
                  sel ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : isToday ? "border-blue-400" : "border-transparent hover:bg-gray-50 dark:hover:bg-white/5"
                } ${its.length ? "bg-gray-50 dark:bg-white/[0.03]" : ""}`}
              >
                <span className={`text-xs sm:text-sm font-black ${friday ? "text-red-500" : past ? "text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
                  {faNum(Number(toJalali(new Date(k)).day))}
                  {past && its.length > 0 && <AlertTriangle className="inline h-3 w-3 text-amber-500 mr-0.5" aria-label="سررسید گذشته" />}
                </span>
                <span className="mt-auto space-y-0.5 w-full">
                  {inn > 0n && (
                    <span className="flex items-center gap-0.5 text-[9px] sm:text-[11px] font-bold text-emerald-600 tabular-nums truncate">
                      <ArrowDownToLine className="h-2.5 w-2.5 shrink-0" aria-label="ورود" />
                      {faShort(Number(inn))}
                    </span>
                  )}
                  {out > 0n && (
                    <span className="flex items-center gap-0.5 text-[9px] sm:text-[11px] font-bold text-red-600 tabular-nums truncate">
                      <ArrowUpFromLine className="h-2.5 w-2.5 shrink-0" aria-label="خروج" />
                      {faShort(Number(out))}
                    </span>
                  )}
                  {!inn && !out && doneCount > 0 && <Check className="h-3 w-3 text-gray-300" aria-label="تسویه‌شده" />}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-black">{picked ? formatJalali(new Date(picked)) : "همه‌ی موارد تسویه‌نشده‌ی ماه"}</p>
          {picked && (
            <button onClick={() => setPicked(null)} className={btn.small}>
              همه‌ی ماه
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/5 border-t border-gray-100 dark:border-white/5">
          {list.map((i) => (
            <Link key={`${i.kind}:${i.id}`} href={i.href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${i.dir === "in" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                {i.dir === "in" ? <ArrowDownToLine className="h-4 w-4" aria-label="ورود" /> : <ArrowUpFromLine className="h-4 w-4" aria-label="خروج" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-bold truncate ${i.done ? "text-gray-400 line-through" : ""}`}>{i.title}</span>
                <span className="block text-[11px] text-gray-400 truncate">
                  {!picked && `${formatJalali(new Date(i.date))} · `}
                  {i.sub}
                </span>
              </span>
              <span className="text-left shrink-0 space-y-1">
                <Money value={i.amount} className="text-sm" tone={i.done ? "gray" : i.dir === "in" ? "green" : "red"} />
                <span className="flex gap-1 justify-end">
                  <Badge>{KIND[i.kind]}</Badge>
                  {i.bad && <Badge tone="red">برگشتی</Badge>}
                  {i.done && <Badge tone="green">تسویه</Badge>}
                </span>
              </span>
            </Link>
          ))}
          {d && !list.length && <Empty title={picked ? "این روز سررسیدی ندارد" : "این ماه سررسید تسویه‌نشده‌ای نیست"} />}
        </div>
      </Card>
      {d && <p className="text-[11px] text-gray-400">مبلغ‌ها تومان‌اند؛ «ه» یعنی هزار و «م» یعنی میلیون.</p>}
    </div>
  );
}
