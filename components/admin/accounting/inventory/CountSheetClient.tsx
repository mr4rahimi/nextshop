"use client";

/**
 * برگه‌ی انبارگردانی — برای موبایل و بارکدخوان طراحی شده.
 *
 * هر اسکن یک عدد به شمارش همان کالا اضافه می‌کند؛ عدد را دستی هم می‌شود
 * نوشت. هر تغییر فوراً ذخیره می‌شود (پیش‌نویس)، پس بستن صفحه چیزی را گم
 * نمی‌کند. «ثبت نهایی» اختلاف را حرکت انبار و سند می‌کند.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, toLatinDigits } from "@/lib/accounting/money";
import ProductPicker, { type ProductOption } from "../ProductPicker";
import { api, Badge, btn, Card, ErrorText, PageHeader, SectionTitle, Stat } from "../ui";

interface Line {
  id: string;
  productId: string;
  countedQty: number;
  systemQty: number | null;
  diff: number | null;
  bookQty: number | null;
  product: { id: string; title: string; sku: string | null; mainImage: string | null } | null;
}
interface Data {
  count: { id: string; number: number; date: string; status: "DRAFT" | "POSTED" | "VOID"; note: string | null; voucherId: string | null; voidReason: string | null; postedByName: string | null };
  warehouse: { id: string; name: string } | null;
  lines: Line[];
  uncounted: number;
  can: { manage: boolean };
}

export default function CountSheetClient({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const saving = useRef(Promise.resolve());

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/inventory/counts/${id}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  // ذخیره‌ها پشت سر هم — دو اسکن سریع نباید هم را بازنویسی کنند
  function save(productId: string, countedQty: number | null) {
    saving.current = saving.current
      .then(() => api(`/api/admin/accounting/inventory/counts/${id}`, { method: "PUT", json: { lines: [{ productId, countedQty }] } }).then(() => undefined))
      .catch((e) => setError(e instanceof Error ? e.message : "ذخیره نشد"));
    return saving.current;
  }

  async function scan(p: ProductOption) {
    if (!data) return;
    const cur = data.lines.find((l) => l.productId === p.id);
    const next = (cur?.countedQty ?? 0) + 1;
    setFlash(`${p.title}: ${faNum(next)}`);
    await save(p.id, next);
    load();
  }

  function setQty(line: Line, raw: string) {
    const v = toLatinDigits(raw).replace(/\D/g, "");
    setData((d) => (d ? { ...d, lines: d.lines.map((l) => (l.id === line.id ? { ...l, countedQty: v === "" ? 0 : Number(v) } : l)) } : d));
  }

  async function act(action: "fill" | "post" | "void") {
    let reason = "";
    if (action === "post" && !window.confirm("انبارگردانی ثبت نهایی شود؟ اختلاف‌ها حرکت انبار و سند می‌شوند و برگه دیگر ویرایش نمی‌شود.")) return;
    if (action === "void") {
      if (data?.count.status === "DRAFT") {
        if (!window.confirm("این پیش‌نویس حذف شود؟")) return;
      } else {
        reason = window.prompt("دلیل ابطال؟ موجودی به قبل از انبارگردانی برمی‌گردد.") ?? "";
        if (!reason) return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await saving.current;
      await api(`/api/admin/accounting/inventory/counts/${id}`, { method: "POST", json: { action, reason } });
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

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const draft = data.count.status === "DRAFT";
  const editable = draft && data.can.manage;
  const diffOf = (l: Line) => (draft ? (l.bookQty === null ? null : l.countedQty - l.bookQty) : l.diff);
  const withDiff = data.lines.filter((l) => (diffOf(l) ?? 0) !== 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`انبارگردانی ${faNum(data.count.number)} — ${data.warehouse?.name ?? ""}`}
        help="accountingCounts"
        desc={`تاریخ شمارش ${formatJalali(new Date(data.count.date))}${data.count.note ? ` · ${data.count.note}` : ""}`}
        back={{ href: "/admin/accounting/inventory/counts", label: "انبارگردانی‌ها" }}
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="شمرده‌شده" value={faNum(data.lines.length)} />
        <Stat label="دارای اختلاف" value={faNum(withDiff.length)} tone={withDiff.length ? "amber" : "gray"} />
        <Stat label="شمرده‌نشده" value={faNum(data.uncounted)} sub="کالای دارای موجودی در این انبار" tone={data.uncounted ? "red" : "gray"} />
      </div>

      {!draft && (
        <Card className="p-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={data.count.status === "POSTED" ? "green" : "red"}>{data.count.status === "POSTED" ? "ثبت شد" : "باطل"}</Badge>
          {data.count.postedByName && <span className="text-xs text-gray-500">ثبت: {data.count.postedByName}</span>}
          {data.count.voucherId && (
            <a href={`/admin/accounting/vouchers/${data.count.voucherId}`} className="text-xs font-bold text-blue-600">
              دیدن سند حسابداری ←
            </a>
          )}
          {data.count.voidReason && <span className="text-xs text-red-600">{data.count.voidReason}</span>}
        </Card>
      )}

      {editable && (
        <Card className="p-3 space-y-2 sticky top-2 z-20 shadow-md">
          <ProductPicker onPick={scan} warehouseId={data.warehouse?.id} autoFocus placeholder="اسکن بارکد یا جستجوی کالا — هر بار یک عدد" />
          {flash && <p className="text-xs font-bold text-emerald-600">✓ {flash}</p>}
        </Card>
      )}

      <section>
        <SectionTitle
          title="کالاهای شمرده‌شده"
          actions={
            editable &&
            data.uncounted > 0 && (
              <button onClick={() => act("fill")} disabled={busy} className={btn.small} title="کالاهای شمرده‌نشده با عدد دفتری اضافه می‌شوند؛ فقط اختلاف‌ها را عوض کنید">
                ➕ بقیه با عدد دفتری
              </button>
            )
          }
        />
        <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
          {data.lines.map((l) => {
            const diff = diffOf(l);
            return (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{l.product?.title ?? "کالای حذف‌شده"}</span>
                  <span className="block text-[11px] text-gray-400">
                    دفتری {l.bookQty === null ? "—" : faNum(l.bookQty)}
                    {diff !== null && diff !== 0 && (
                      <b className={`mr-2 ${diff < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {diff < 0 ? `کسری ${faNum(-diff)}` : `اضافی ${faNum(diff)}`}
                      </b>
                    )}
                  </span>
                </span>
                {editable ? (
                  <>
                    <button
                      onClick={async () => {
                        const n = Math.max(0, l.countedQty - 1);
                        setQty(l, String(n));
                        await save(l.productId, n);
                        load();
                      }}
                      className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/10 text-lg font-bold"
                      aria-label="یکی کمتر"
                    >
                      −
                    </button>
                    <input
                      value={faNum(l.countedQty)}
                      onChange={(e) => setQty(l, e.target.value)}
                      onBlur={async () => {
                        await save(l.productId, l.countedQty);
                        load();
                      }}
                      inputMode="numeric"
                      className="w-16 h-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-center text-base font-black"
                    />
                    <button
                      onClick={async () => {
                        const n = l.countedQty + 1;
                        setQty(l, String(n));
                        await save(l.productId, n);
                        load();
                      }}
                      className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/10 text-lg font-bold"
                      aria-label="یکی بیشتر"
                    >
                      +
                    </button>
                    <button
                      onClick={async () => {
                        await save(l.productId, null);
                        load();
                      }}
                      className="text-gray-300 hover:text-red-600 px-1"
                      aria-label="حذف از برگه"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span className="text-base font-black tabular-nums">{faNum(l.countedQty)}</span>
                )}
              </div>
            );
          })}
          {!data.lines.length && <p className="px-4 py-8 text-center text-xs text-gray-400">هنوز چیزی شمرده نشده. بارکد را اسکن کنید یا نام کالا را جستجو کنید.</p>}
        </Card>
      </section>

      <ErrorText>{error}</ErrorText>
      {data.can.manage && data.count.status !== "VOID" && (
        <div className="flex flex-wrap gap-2 sticky bottom-20 md:bottom-4">
          {draft && (
            <button onClick={() => act("post")} disabled={busy || !data.lines.length} className={`${btn.primary} flex-1 sm:flex-none shadow-lg`}>
              ✓ ثبت نهایی انبارگردانی
            </button>
          )}
          <button onClick={() => act("void")} disabled={busy} className={btn.danger}>
            {draft ? "حذف پیش‌نویس" : "ابطال"}
          </button>
        </div>
      )}
    </div>
  );
}
