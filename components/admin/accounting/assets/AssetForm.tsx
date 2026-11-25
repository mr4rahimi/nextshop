"use client";

/**
 * ثبت دارایی ثابت: از کجا خریده شد ← مشخصات ← روش استهلاک با پیش‌فرض گروه (ماده‌ی ۱۴۹) ← پیش‌نمایش سالانه.
 * همین فرم با `edit` روش و عمر دارایی‌ای را که هنوز استهلاکش سند نخورده عوض می‌کند.
 */

import { useEffect, useMemo, useState } from "react";
import { dayValue, parseDay, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { ASSET_CATEGORIES, CATEGORY_DEFAULTS, CATEGORY_LABELS, depSchedule, yearlySchedule, type AssetCategory, type DepMethod } from "@/lib/accounting/assets/calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import { api, btn, ErrorText, Field, inputCls, Segmented, Sheet } from "../ui";
import { act, AccountSelect, ASSETS_API, parseNum, TreasurySelect, useTreasuries, type AccountOpt } from "./shared";

type Funding = "INVOICE" | "TREASURY" | "CREDIT" | "EXISTING";

interface Candidate {
  id: string;
  title: string;
  cost: string;
  accountId: string;
  invoice: { id: string; number: number; date: string; partyName: string };
}

export interface AssetEdit {
  id: string;
  name: string;
  category: AssetCategory;
  cost: string;
  salvage: string;
  method: DepMethod;
  lifeMonths: number | null;
  rateBp: number | null;
  openingAccum: string;
  inServiceOn: string;
  acquiredOn: string;
  funding: Funding;
  note: string | null;
  depreciated: string;
}

export default function AssetForm({ open, onClose, onSaved, accounts, edit }: { open: boolean; onClose: () => void; onSaved: (id: string) => void; accounts: AccountOpt[]; edit?: AssetEdit | null }) {
  const treasuries = useTreasuries();
  const today = dayValue(todayKey());
  const [funding, setFunding] = useState<Funding>("INVOICE");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [lineId, setLineId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategory>("FURNITURE");
  const [accountId, setAccountId] = useState("");
  const [cost, setCost] = useState("");
  const [acquiredOn, setAcquiredOn] = useState(today);
  const [inServiceOn, setInServiceOn] = useState("");
  const [method, setMethod] = useState<DepMethod>("STRAIGHT");
  const [years, setYears] = useState("10");
  const [rate, setRate] = useState("25");
  const [salvage, setSalvage] = useState("");
  const [openingAccum, setOpeningAccum] = useState("");
  const [treasuryId, setTreasuryId] = useState("");
  const [party, setParty] = useState<PartyOption | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (edit) {
      setName(edit.name);
      setCategory(edit.category);
      setCost(edit.cost);
      setSalvage(edit.salvage === "0" ? "" : edit.salvage);
      setMethod(edit.method);
      setYears(edit.lifeMonths ? String(+(edit.lifeMonths / 12).toFixed(2)) : "10");
      setRate(edit.rateBp ? String(edit.rateBp / 100) : "25");
      setOpeningAccum(edit.openingAccum === "0" ? "" : edit.openingAccum);
      setInServiceOn(edit.inServiceOn.slice(0, 10));
      setAcquiredOn(edit.acquiredOn.slice(0, 10));
      setFunding(edit.funding);
      setNote(edit.note ?? "");
      return;
    }
    api<{ items: Candidate[] }>(`${ASSETS_API}?candidates=1`)
      .then((d) => {
        setCandidates(d.items);
        if (!d.items.length) setFunding("TREASURY");
      })
      .catch(() => setCandidates([]));
  }, [open, edit]);

  function pickCategory(c: AssetCategory) {
    setCategory(c);
    const d = CATEGORY_DEFAULTS[c];
    setMethod(d.method);
    if (d.lifeMonths) setYears(String(d.lifeMonths / 12));
    if (d.rateBp) setRate(String(d.rateBp / 100));
    if (funding !== "INVOICE" && !edit) {
      const code = d.accountCode;
      const hit = accounts.find((a) => a.code === code);
      if (hit) setAccountId(hit.id);
    }
  }

  const line = candidates?.find((c) => c.id === lineId) ?? null;
  useEffect(() => {
    if (!line) return;
    setName((n) => n || line.title);
    setCost(line.cost);
    setAccountId(line.accountId);
    setAcquiredOn(line.invoice.date.slice(0, 10));
  }, [line]);

  const lifeMonths = Math.round(parseNum(years) * 12);
  const rateBp = Math.round(parseNum(rate) * 100);
  const start = parseDay(inServiceOn || acquiredOn);
  const preview = useMemo(() => {
    const c = BigInt(cost || "0");
    if (!start || c <= 0n) return null;
    const ok = method === "STRAIGHT" ? lifeMonths >= 1 && lifeMonths <= 600 : rateBp >= 100 && rateBp <= 10000;
    if (!ok) return null;
    const rows = depSchedule({ cost: c, salvage: BigInt(salvage || "0"), method, lifeMonths, rateBp, openingAccum: funding === "EXISTING" ? BigInt(openingAccum || "0") : 0n }, start, 600);
    return { first: rows[0]?.amount ?? 0n, years: yearlySchedule(rows), months: rows.length };
  }, [cost, salvage, method, lifeMonths, rateBp, openingAccum, funding, start?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const dep = { method, lifeMonths: method === "STRAIGHT" ? lifeMonths : null, rateBp: method === "DECLINING" ? rateBp : null, salvage: salvage || "0", inServiceOn: inServiceOn || null, openingAccum: openingAccum || "0" };
      if (edit) {
        const canMethod = edit.depreciated === "0";
        await act("asset.update", { id: edit.id, name, category, note, ...(canMethod ? dep : {}) });
        onSaved(edit.id);
      } else {
        const d = await act<{ asset: { id: string } }>("asset.create", {
          name,
          category,
          funding,
          invoiceLineId: funding === "INVOICE" ? lineId : null,
          accountId,
          cost: cost || "0",
          acquiredOn,
          treasuryId: funding === "TREASURY" ? treasuryId : null,
          partyId: funding === "CREDIT" ? party?.id : null,
          note,
          ...dep,
        });
        onSaved(d.asset.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  const locked = !!edit && edit.depreciated !== "0";
  const hint = CATEGORY_DEFAULTS[category].hint;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={edit ? "ویرایش دارایی" : "دارایی ثابت تازه"}
      help="accountingAssets"
      footer={
        <div className="flex items-center gap-3">
          {preview && !locked && (
            <span className="text-xs text-gray-500">
              استهلاک ماه اول <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(preview.first)}</b> · {faNum(preview.months)} ماه
            </span>
          )}
          <button onClick={save} disabled={busy} className={`${btn.primary} mr-auto`}>
            {busy ? "در حال ثبت…" : edit ? "ذخیره" : "ثبت دارایی"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {!edit && (
          <Field label="این دارایی چطور خریده شد؟">
            <Segmented<Funding>
              value={funding}
              onChange={setFunding}
              options={[
                { value: "INVOICE", label: "فاکتور خرید" },
                { value: "TREASURY", label: "نقد / بانک" },
                { value: "CREDIT", label: "نسیه" },
                { value: "EXISTING", label: "از قبل داریم" },
              ]}
            />
          </Field>
        )}
        {!edit && funding === "INVOICE" && (
          <Field label="ردیف فاکتور خرید" hint="در فاکتور خرید، ردیف خدمت روی حساب دارایی ثابت (مثلاً اثاثه و تجهیزات) بزنید؛ سند همان فاکتور است و این‌جا فقط دفتر دارایی پر می‌شود.">
            <select value={lineId} onChange={(e) => setLineId(e.target.value)} className={inputCls}>
              <option value="">{candidates === null ? "در حال خواندن…" : candidates.length ? "— انتخاب ردیف —" : "ردیفی روی حساب دارایی ثابت نیست"}</option>
              {candidates?.map((c) => (
                <option key={c.id} value={c.id}>
                  خرید {faNum(c.invoice.number)} · {formatJalali(new Date(c.invoice.date))} · {c.invoice.partyName} — {c.title} ({formatAmount(c.cost)})
                </option>
              ))}
            </select>
          </Field>
        )}
        {!edit && funding === "EXISTING" && (
          <p className="text-xs text-gray-500 leading-6">
            سندی نمی‌خورد. بها و استهلاک انباشته‌ی تا امروز باید در «مانده‌های اول دوره» یا سند دستی روی همان حساب‌ها باشد؛ برنامه استهلاک را از ماه بعد ادامه می‌دهد.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام دارایی">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="مثلاً: ویترین شیشه‌ای ورودی" />
          </Field>
          <Field label="گروه" hint={hint}>
            <select value={category} onChange={(e) => pickCategory(e.target.value as AssetCategory)} className={inputCls}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          {!edit && funding !== "INVOICE" && (
            <>
              <Field label="حساب دارایی">
                <AccountSelect value={accountId} onChange={setAccountId} items={accounts} />
              </Field>
              <Field label="بهای خرید (تومان)">
                <AmountInput value={cost} onChange={setCost} />
              </Field>
              <Field label="تاریخ خرید">
                <JalaliDatePicker value={acquiredOn} onChange={setAcquiredOn} />
              </Field>
            </>
          )}
          {!edit && funding === "TREASURY" && (
            <Field label="پرداخت از">
              <TreasurySelect value={treasuryId} onChange={setTreasuryId} items={treasuries} />
            </Field>
          )}
          {!edit && funding === "CREDIT" && (
            <Field label="فروشنده (بدهی ما به او)">
              <PartyPicker value={party} onChange={setParty} role="supplier" canCreate />
            </Field>
          )}
          {edit && (
            <Field label="بها">
              <p className="py-2 text-sm font-bold tabular-nums">{formatAmount(edit.cost)}</p>
            </Field>
          )}
        </div>

        {locked ? (
          <p className="text-xs text-gray-500">برای این دارایی استهلاک سند خورده؛ روش و عمر دیگر عوض نمی‌شود.</p>
        ) : (
          <div className="rounded-2xl border border-gray-100 dark:border-white/5 p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="روش استهلاک">
                <Segmented<DepMethod>
                  value={method}
                  onChange={setMethod}
                  options={[
                    { value: "STRAIGHT", label: "خط مستقیم" },
                    { value: "DECLINING", label: "نزولی" },
                  ]}
                />
              </Field>
              {method === "STRAIGHT" ? (
                <Field label="عمر مفید (سال)">
                  <input value={years} onChange={(e) => setYears(e.target.value)} inputMode="decimal" className={inputCls} />
                </Field>
              ) : (
                <Field label="نرخ سالانه ٪">
                  <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={inputCls} />
                </Field>
              )}
              <Field label="شروع به کار" hint="استهلاک از اول همین ماه">
                <JalaliDatePicker value={inServiceOn || acquiredOn} onChange={setInServiceOn} />
              </Field>
              <Field label="ارزش اسقاط (اختیاری)" hint="آنچه آخر عمر می‌ارزد">
                <AmountInput value={salvage} onChange={setSalvage} compact />
              </Field>
              {(edit ? edit.funding === "EXISTING" : funding === "EXISTING") && (
                <Field label="استهلاک انباشته‌ی قبلی" hint="آنچه تا امروز در دفاتر ثبت شده">
                  <AmountInput value={openingAccum} onChange={setOpeningAccum} compact />
                </Field>
              )}
            </div>
            {preview && preview.years.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100 dark:border-white/5">
                      <th className="px-2 py-1.5 text-right">سال</th>
                      <th className="px-2 py-1.5 text-right">استهلاک سال</th>
                      <th className="px-2 py-1.5 text-left">ارزش دفتری پایان سال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.years.slice(0, 12).map((y) => (
                      <tr key={y.year} className="border-b border-gray-50 dark:border-white/5">
                        <td className="px-2 py-1 tabular-nums">{faNum(y.year)}</td>
                        <td className="px-2 py-1 tabular-nums">{formatAmount(y.amount)}</td>
                        <td className="px-2 py-1 text-left tabular-nums">{formatAmount(y.book)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.years.length > 12 && <p className="pt-1 text-[11px] text-gray-400">… و {faNum(preview.years.length - 12)} سال دیگر</p>}
              </div>
            )}
          </div>
        )}

        <Field label="یادداشت (اختیاری)" hint="شماره‌ی سریال، پلاک، محل">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
