"use client";

/**
 * ساخت و ویرایش ورودی سریع. هر ردیف: حساب، طرف، قاعده‌ی مبلغ و تفصیلی پیش‌فرض.
 * ستون «نمونه» حاصل را با مبلغ نمونه نشان می‌دهد تا تراز بودن پیش از ذخیره دیده شود.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { formatAmount } from "@/lib/accounting/money";
import { calcTemplate, formatPercent, parsePercent, templateShapeError, usesBase, type CalcLine, type TemplateAmountKind, type TemplateSide } from "@/lib/accounting/ledger/template-calc";
import AccountPicker, { type AccountOption } from "../AccountPicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import type { TreasuryRecord } from "../TreasuryForm";
import { api, btn, Card, ErrorText, Field, inputCls, PageHeader } from "../ui";
import { KIND_LABELS, type Template } from "./types";

interface Row {
  key: string;
  account: AccountOption | null;
  side: TemplateSide;
  kind: TemplateAmountKind;
  percent: string;
  fixed: string;
  party: PartyOption | null;
  treasuryId: string;
  description: string;
}

let k = 0;
const blank = (side: TemplateSide, kind: TemplateAmountKind): Row => ({ key: `n${++k}`, account: null, side, kind, percent: "", fixed: "", party: null, treasuryId: "", description: "" });
const smallInput = inputCls.replace("py-2.5", "py-2");
const LIST = "/admin/accounting/vouchers/templates";
const SAMPLE = 10_000_000n;

export default function TemplateEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseLabel, setBaseLabel] = useState("مبلغ");
  const [baseAmount, setBaseAmount] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [blank("DEBIT", "BASE"), blank("CREDIT", "REMAINDER")]);
  const [treasuries, setTreasuries] = useState<TreasuryRecord[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: TreasuryRecord[] }>("/api/admin/accounting/treasury").then((d) => setTreasuries(d.items)).catch(() => {});
    if (!id) return;
    api<{ template: Template }>(`/api/admin/accounting/vouchers/templates/${id}`)
      .then(({ template: t }) => {
        setName(t.name);
        setDescription(t.description);
        setBaseLabel(t.baseLabel);
        setBaseAmount(t.baseAmount === "0" ? "" : t.baseAmount);
        setRows(
          t.lines.map((l) => ({
            key: l.id,
            account: l.account,
            side: l.side,
            kind: l.kind,
            percent: formatPercent(l.percentBps),
            fixed: l.fixedAmount ?? "",
            party: l.party,
            treasuryId: l.treasury?.id ?? "",
            description: l.description ?? "",
          })),
        );
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const patch = (key: string, p: Partial<Row>) => setRows((x) => x.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const calcLines: CalcLine[] = useMemo(
    () => rows.map((r) => ({ key: r.key, side: r.side, kind: r.kind, percentBps: parsePercent(r.percent), fixedAmount: BigInt(r.fixed || "0") })),
    [rows],
  );
  const sampleBase = BigInt(baseAmount || "0") || SAMPLE;
  const sample = useMemo(() => calcTemplate(calcLines, sampleBase), [calcLines, sampleBase]);
  const shape = useMemo(() => templateShapeError(calcLines), [calcLines]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(id ? `/api/admin/accounting/vouchers/templates/${id}` : "/api/admin/accounting/vouchers/templates", {
        method: id ? "PUT" : "POST",
        json: {
          name,
          description,
          baseLabel,
          baseAmount: baseAmount || "0",
          lines: rows.map((r) => ({
            accountId: r.account?.id,
            side: r.side,
            kind: r.kind,
            percent: r.percent,
            fixedAmount: r.fixed || "0",
            partyId: r.account?.detailKind === "PARTY" ? r.party?.id : null,
            treasuryId: r.account?.detailKind === "TREASURY" ? r.treasuryId || null : null,
            description: r.description || null,
          })),
        },
      });
      router.push(LIST);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !window.confirm("این الگو حذف شود؟ سندهایی که با آن ثبت شده‌اند می‌مانند.")) return;
    setBusy(true);
    try {
      await api(`/api/admin/accounting/vouchers/templates/${id}`, { method: "DELETE" });
      router.push(LIST);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف نشد");
      setBusy(false);
    }
  }

  if (!loaded) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={id ? "ویرایش ورودی سریع" : "ورودی سریع تازه"}
        help="accountingTemplates"
        back={{ href: LIST, label: "ورودی سریع" }}
        actions={
          id && (
            <button onClick={remove} disabled={busy} className={btn.danger}>
              حذف
            </button>
          )
        }
      />

      <Card className="p-4 grid gap-3 sm:grid-cols-2">
        <Field label="نام الگو">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="مثلاً: اجاره‌ی مغازه" />
        </Field>
        <Field label="شرح سند" hint="هنگام ثبت می‌توانید عوضش کنید">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="مثلاً: پرداخت اجاره‌ی ماهانه" />
        </Field>
        {usesBase(rows) && (
          <>
            <Field label="عنوان مبلغ پایه">
              <input value={baseLabel} onChange={(e) => setBaseLabel(e.target.value)} className={inputCls} placeholder="مثلاً: مبلغ اجاره" />
            </Field>
            <Field label="مبلغ پیش‌فرض (اختیاری)">
              <AmountInput value={baseAmount} onChange={setBaseAmount} />
            </Field>
          </>
        )}
      </Card>

      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <Card key={r.key} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400">ردیف {i + 1}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-gray-500">نمونه: {r.kind === "ASK" ? "هنگام ثبت" : formatAmount(sample.amounts[r.key] ?? 0n)}</span>
                {rows.length > 2 && (
                  <button onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="text-xs text-gray-400 hover:text-red-600">
                    ✕ حذف
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-[1.4fr_110px_160px_1fr]">
              <AccountPicker value={r.account} onChange={(a) => patch(r.key, { account: a, party: null, treasuryId: "" })} compact />
              <select value={r.side} onChange={(e) => patch(r.key, { side: e.target.value as TemplateSide })} className={smallInput} aria-label="طرف ردیف">
                <option value="DEBIT">بدهکار</option>
                <option value="CREDIT">بستانکار</option>
              </select>
              <select value={r.kind} onChange={(e) => patch(r.key, { kind: e.target.value as TemplateAmountKind })} className={smallInput} aria-label="نوع مبلغ">
                {(Object.keys(KIND_LABELS) as TemplateAmountKind[]).map((v) => (
                  <option key={v} value={v}>
                    {KIND_LABELS[v]}
                  </option>
                ))}
              </select>
              {r.kind === "PERCENT" ? (
                <input value={r.percent} onChange={(e) => patch(r.key, { percent: e.target.value })} inputMode="decimal" className={smallInput} placeholder="درصد، مثلاً ۹" />
              ) : r.kind === "FIXED" ? (
                <AmountInput compact value={r.fixed} onChange={(v) => patch(r.key, { fixed: v })} />
              ) : (
                <input value={r.description} onChange={(e) => patch(r.key, { description: e.target.value })} className={smallInput} placeholder="شرح ردیف (اختیاری)" />
              )}
            </div>
            {r.account?.detailKind === "PARTY" && (
              <PartyPicker value={r.party} onChange={(p) => patch(r.key, { party: p })} placeholder="شخص پیش‌فرض (خالی = هنگام ثبت)" compact />
            )}
            {r.account?.detailKind === "TREASURY" && (
              <select value={r.treasuryId} onChange={(e) => patch(r.key, { treasuryId: e.target.value })} className={smallInput} aria-label="صندوق یا بانک">
                <option value="">هنگام ثبت انتخاب شود</option>
                {treasuries.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </Card>
        ))}
        <button onClick={() => setRows((x) => [...x, blank("CREDIT", "PERCENT")])} className={btn.soft}>
          <Plus className="h-4 w-4" aria-hidden />
          ردیف
        </button>
      </div>

      <div className="sticky bottom-20 md:bottom-4 z-30 rounded-2xl shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-xs text-gray-500">
            نمونه با {formatAmount(sampleBase)}: بدهکار <b className="tabular-nums">{formatAmount(sample.debit)}</b> · بستانکار <b className="tabular-nums">{formatAmount(sample.credit)}</b>
          </div>
          {shape && <div className="text-xs font-bold text-red-600">{shape}</div>}
          <button onClick={save} disabled={busy || !!shape} className={`${btn.primary} mr-auto`}>
            {busy ? "در حال ذخیره…" : "ذخیره‌ی الگو"}
          </button>
        </div>
        {error && (
          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </div>
    </div>
  );
}
