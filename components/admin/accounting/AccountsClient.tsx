"use client";

/**
 * سرفصل حساب‌ها — درخت گروه ← کل ← معین با مانده (docs/plans/accounting.md بخش ۷).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { loadLeafAccounts } from "./AccountPicker";
import { api, Badge, BalanceLabel, btn, Card, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet } from "./ui";
import { Plus } from "lucide-react";

interface Acc {
  id: string;
  code: string;
  name: string;
  level: "GROUP" | "LEDGER" | "SUBLEDGER";
  parentId: string | null;
  class: string;
  detailKind: "NONE" | "PARTY" | "TREASURY";
  systemKey: string | null;
  isActive: boolean;
  balance: string;
}

const DETAIL_LABEL = { NONE: "", PARTY: "تفصیلی: شخص", TREASURY: "تفصیلی: صندوق و بانک" };

export default function AccountsClient() {
  const [data, setData] = useState<{ accounts: Acc[]; can: { manage: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ mode: "new"; parent: Acc } | { mode: "edit"; acc: Acc } | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    api<{ accounts: Acc[]; can: { manage: boolean } }>("/api/admin/accounting/accounts")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // مانده‌ی کل و گروه = جمع معین‌های زیرش (کد با کد پدر شروع می‌شود)
  const rolled = useMemo(() => {
    const m = new Map<string, bigint>();
    if (!data) return m;
    const leaves = data.accounts.filter((a) => a.level === "SUBLEDGER");
    for (const a of data.accounts) {
      if (a.level === "SUBLEDGER") m.set(a.id, BigInt(a.balance));
      else m.set(a.id, leaves.filter((l) => l.code.startsWith(a.code)).reduce((s, l) => s + BigInt(l.balance), 0n));
    }
    return m;
  }, [data]);

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const children = (pid: string | null) => data.accounts.filter((a) => a.parentId === pid);
  const term = q.trim();
  const matches = term ? data.accounts.filter((a) => a.name.includes(term) || a.code.startsWith(term)) : null;

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // تابع رندر، نه کامپوننت تو در تو — کامپوننت درونی با هر رندر از نو mount می‌شد
  function renderRow(a: Acc, depth: number): React.ReactNode {
    const kids = children(a.id);
    const isOpen = open.has(a.id) || !!term;
    return (
      <div key={a.id}>
        <div className={`flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 ${!a.isActive ? "opacity-50" : ""}`} style={{ paddingRight: 12 + depth * 20 }}>
          {a.level !== "SUBLEDGER" ? (
            <button onClick={() => toggle(a.id)} className="w-6 h-6 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 text-xs">
              {isOpen ? "▾" : "◂"}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <span className="text-[11px] text-gray-400 tabular-nums w-10 sm:w-12 shrink-0">{faNum(a.code)}</span>
          <Link href={`/admin/accounting/accounts/${a.id}`} className="flex-1 min-w-0 group">
            <span
              className={`block text-sm leading-6 ${a.level === "GROUP" ? "font-black" : a.level === "LEDGER" ? "font-bold" : ""} text-gray-900 dark:text-white group-hover:text-blue-600`}
            >
              {a.name}
            </span>
            {/* موبایل: مانده زیر نام تا نام کامل دیده شود */}
            <span className="sm:hidden block text-[11px]">
              <BalanceLabel balance={(rolled.get(a.id) ?? 0n).toString()} kind="account" />
            </span>
          </Link>
          <span className="hidden sm:flex gap-1">
            {a.systemKey && <Badge>سیستمی</Badge>}
            {a.detailKind !== "NONE" && <Badge tone="blue">{DETAIL_LABEL[a.detailKind]}</Badge>}
          </span>
          <span className="hidden sm:block w-32 text-left text-xs">
            <BalanceLabel balance={(rolled.get(a.id) ?? 0n).toString()} kind="account" />
          </span>
          {data!.can.manage && (
            <span className="flex gap-1">
              {a.level !== "SUBLEDGER" && (
                <button onClick={() => setForm({ mode: "new", parent: a })} className="text-xs text-blue-600 px-1" title="حساب زیرمجموعه">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              )}
              <button onClick={() => setForm({ mode: "edit", acc: a })} className="text-xs text-gray-400 px-1" title="ویرایش">
                ✏️
              </button>
            </span>
          )}
        </div>
        {isOpen && !term && kids.map((c) => renderRow(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="سرفصل حساب‌ها" help="accountingAccounts" desc="گروه ← کل ← معین. سندها فقط روی معین می‌نشینند." />
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="کد یا نام حساب" className={`${inputCls} flex-1 min-w-[180px]`} />
        <button onClick={() => setOpen(new Set(data.accounts.filter((a) => a.level !== "SUBLEDGER").map((a) => a.id)))} className={btn.small}>
          باز کردن همه
        </button>
        <button onClick={() => setOpen(new Set())} className={btn.small}>
          بستن همه
        </button>
      </div>
      <Card className="overflow-hidden [&_div>div]:border-b [&_div>div]:border-gray-50 dark:[&_div>div]:border-white/5">
        {matches ? matches.map((a) => renderRow(a, 0)) : children(null).map((a) => renderRow(a, 0))}
      </Card>

      {form && (
        <AccountForm
          form={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            loadLeafAccounts(true).catch(() => {});
            load();
          }}
        />
      )}
    </div>
  );
}

function AccountForm({
  form,
  onClose,
  onSaved,
}: {
  form: { mode: "new"; parent: Acc } | { mode: "edit"; acc: Acc };
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = form.mode === "edit" ? form.acc : null;
  const parent = form.mode === "new" ? form.parent : null;
  const [name, setName] = useState(edit?.name ?? "");
  const [code, setCode] = useState("");
  const [detail, setDetail] = useState<Acc["detailKind"]>(edit?.detailKind ?? "NONE");
  const [active, setActive] = useState(edit?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaf = parent ? parent.level === "LEDGER" : edit?.level === "SUBLEDGER";

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (edit) await api(`/api/admin/accounting/accounts/${edit.id}`, { method: "PATCH", json: { name, detailKind: leaf ? detail : undefined, isActive: active } });
      else await api("/api/admin/accounting/accounts", { method: "POST", json: { parentId: parent!.id, name, code: code || undefined, detailKind: detail } });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={edit ? `ویرایش ${edit.name}` : `حساب تازه زیر «${parent!.name}»`}
      help="accountingAccounts"
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "…" : "ذخیره"}
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="نام حساب">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
        </Field>
        {!edit && (
          <Field label="کد (اختیاری)" hint={`خالی بماند خودکار ساخته می‌شود؛ باید با ${faNum(parent!.code)} شروع شود`}>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" />
          </Field>
        )}
        {leaf && !edit?.systemKey && (
          <Field label="تفصیلی" hint="حسابی که برای هر شخص یا هر بانک جدا نگه داشته می‌شود">
            <Segmented
              value={detail}
              onChange={setDetail}
              options={[
                { value: "NONE", label: "ندارد" },
                { value: "PARTY", label: "شخص" },
                { value: "TREASURY", label: "صندوق و بانک" },
              ]}
            />
          </Field>
        )}
        {edit && !edit.systemKey && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} />
            غیرفعال — در سندهای تازه قابل انتخاب نباشد
          </label>
        )}
        {edit?.systemKey && <p className="text-[11px] text-gray-400">حساب سیستمی: فقط نامش عوض می‌شود.</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
