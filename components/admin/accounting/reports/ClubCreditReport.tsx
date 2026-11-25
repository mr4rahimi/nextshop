"use client";

/**
 * «اعتبار باشگاه مشتریان» — تعهد کارت و امتیاز در دفتر (webhesab-parity.md بخش ۳۴.۲).
 * پیش از راه‌اندازی: مانده‌ی امروز و پیش‌نمایش سند افتتاحیه. بعد: دفتر امتیاز در برابر حساب.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { api, btn, Card, ErrorText, PageHeader, SectionTitle } from "../ui";
import { Amt } from "./kit";

interface Status {
  mode: string;
  active: boolean;
  since: string | null;
  account: { id: string; code: string; name: string } | null;
  ledger: string;
  pending: string;
  members: number;
  parts: { label: string; amount: string }[];
  book: string;
  unposted: { rows: number; amount: string };
  diff: string | null;
  settings: { onProfit: boolean; delayHours: number; rate: number };
  can: { settings: boolean };
}
interface Preview {
  total: string;
  parts: { label: string; amount: string }[];
  deficit: string;
  members: number;
}

export default function ClubCreditReport() {
  const [s, setS] = useState<Status | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Status>("/api/admin/accounting/club-credit")
      .then(setS)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function act(action: "preview" | "activate" | "post") {
    if (action === "activate" && !confirm("مانده‌ی امروز اعتبار باشگاه یک‌جا به دفتر برود و از این به بعد هر شارژ و خرج سند بخورد؟")) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await api<{ result: Preview & { rows?: number; voucherId?: string | null; preview?: boolean } }>("/api/admin/accounting/club-credit", { method: "POST", json: { action } });
      if (action === "preview") setPreview(r.result);
      else {
        setPreview(null);
        setNote(action === "activate" ? "تعهد اعتبار باشگاه راه‌اندازی شد." : r.result.rows ? `${faNum(r.result.rows)} گردش به دفتر رفت.` : "گردشی برای ثبت نمانده بود.");
        load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="اعتبار باشگاه مشتریان"
        help="accountingClubCredit"
        back={{ href: "/admin/accounting/reports", label: "گزارش‌ها" }}
        desc="کش‌بک کارت باشگاه و امتیاز سایت پولی است که به مشتری بدهکارید تا خرجش کند. اینجا مانده‌ی آن را با دفتر حسابداری می‌سنجید."
      />
      <ErrorText>{error}</ErrorText>
      {note && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10">{note}</p>}
      {!s ? (
        !error && <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">اعتبار مشتریان (دفتر باشگاه)</p>
              <p className="mt-1 text-lg"><Amt v={s.ledger} strong /></p>
              <p className="text-[11px] text-gray-500">{faNum(s.members)} عضو</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">در انتظار (هنوز خرج‌شدنی نیست)</p>
              <p className="mt-1 text-lg"><Amt v={s.pending} strong /></p>
              <p className="text-[11px] text-gray-500">{s.settings.delayHours ? `کش‌بک ${faNum(s.settings.delayHours)} ساعت بعد آزاد می‌شود` : "کش‌بک از خرید بعدی آزاد است"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">حساب «{s.account?.name ?? "اعتبار باشگاه مشتریان"}»</p>
              <p className="mt-1 text-lg">{s.active ? <Amt v={s.book} strong /> : <span className="font-black text-gray-400">راه‌اندازی نشده</span>}</p>
              {s.account && (
                <Link href={`/admin/accounting/accounts/${s.account.id}`} className="text-[11px] font-bold text-blue-600">
                  دفتر معین {faNum(Number(s.account.code))}
                </Link>
              )}
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">مبنای کش‌بک</p>
              <p className="mt-1 text-sm font-black">{s.settings.onProfit ? "سود ناخالص" : "مبلغ خرید"}</p>
              <Link href="/admin/club/cards" className="text-[11px] font-bold text-blue-600">
                تنظیمات کارت باشگاه
              </Link>
            </Card>
          </div>

          {!s.active ? (
            <Card className="space-y-3 p-4">
              <SectionTitle title="راه‌اندازی تعهد در دفتر" />
              <p className="text-sm leading-7 text-gray-600 dark:text-gray-300">
                تا امروز شارژ کارت سند نداشت و فقط موقع خرج «تخفیف فروش» می‌شد؛ پس این بدهی در ترازنامه دیده نمی‌شد. با راه‌اندازی، مانده‌ی امروز یک‌جا ثبت می‌شود و از آن به بعد:
              </p>
              <ul className="list-disc space-y-1 pr-5 text-xs leading-6 text-gray-600 dark:text-gray-300">
                <li>هر کش‌بک خرید همان روز «تخفیفات فروش» و «اعتبار باشگاه مشتریان» می‌شود.</li>
                <li>خرج اعتبار در صندوق دیگر تخفیف نیست؛ فقط از بدهی کم می‌کند.</li>
                <li>سوخت اعتبار و کسر شارژ مرجوعی، تخفیف را برمی‌گرداند.</li>
                <li>هدیه و شارژ دستی «هدیه و جبران به مشتری» می‌شود.</li>
              </ul>
              {s.mode !== "INTERNAL" ? (
                <p className="text-xs font-bold text-amber-600">فقط با حسابداری داخلی.</p>
              ) : s.can.settings ? (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => act("preview")} disabled={busy} className={btn.soft}>
                    پیش‌نمایش سند افتتاحیه
                  </button>
                  {preview && (
                    <button onClick={() => act("activate")} disabled={busy} className={btn.primary}>
                      {busy ? "…" : "راه‌اندازی و ثبت سند"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">راه‌اندازی مجوز «تنظیمات حسابداری» می‌خواهد.</p>
              )}
              {preview && (
                <div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/5">
                  <p className="mb-2 font-black">
                    مانده‌ی {faNum(preview.members)} عضو: <Amt v={preview.total} strong /> تومان
                  </p>
                  {preview.parts.map((p) => (
                    <div key={p.label} className="flex justify-between text-xs">
                      <span>{p.label}</span>
                      <Amt v={p.amount} />
                    </div>
                  ))}
                  {BigInt(preview.deficit) > 0n && (
                    <div className="flex justify-between text-xs text-rose-600">
                      <span>کسری مشتریانی که بیش از مانده خرج کرده‌اند</span>
                      <span>−<Amt v={preview.deficit} /></span>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] leading-5 text-gray-500">
                    سهم «منتقل‌شده از نرم‌افزار قبلی» بدهکار «تراز افتتاحیه» می‌شود (بدهی پیش از این سیستم)، کش‌بک خرید «تخفیفات فروش» و هدیه‌ها «هدیه و جبران به مشتری».
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <Card className="space-y-3 p-4">
              <SectionTitle title="تطبیق" />
              <p className="text-xs text-gray-500">از {formatJalali(new Date(s.since!))} فعال است.</p>
              <div className="space-y-1 text-sm">
                {s.parts.map((p) => (
                  <div key={p.label} className="flex justify-between text-xs">
                    <span>{p.label}</span>
                    <Amt v={p.amount} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  گردش به دفتر نرفته: {faNum(s.unposted.rows)} ردیف (<Amt v={s.unposted.amount} />)
                </span>
                {s.unposted.rows > 0 && s.can.settings && (
                  <button onClick={() => act("post")} disabled={busy} className={btn.small}>
                    همین حالا ثبت کن
                  </button>
                )}
              </div>
              {s.diff !== null && (
                <p className={`text-xs font-bold ${BigInt(s.diff) === 0n ? "text-emerald-600" : "text-amber-600"}`}>
                  {BigInt(s.diff) === 0n ? "دفتر باشگاه و حساب یکی‌اند." : <>اختلاف <Amt v={s.diff} /> — معمولاً گرد شدن امتیاز به تومان یا سند دستی روی این حساب.</>}
                </p>
              )}
              <p className="text-[11px] leading-5 text-gray-400">گردش‌های سایت، دستی و سوخت هر ساعت خودکار به دفتر می‌روند؛ صندوق همان لحظه.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
