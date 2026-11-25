"use client";

/** ابزار مشترک صفحه‌های دارایی ثابت، پیش‌پرداخت و ودیعه (بخش ۳۴.۵) */

import Link from "next/link";
import { useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import type { TreasuryRecord } from "../TreasuryForm";
import { api, inputCls } from "../ui";

export const ASSETS_API = "/api/admin/accounting/assets";

export async function act<T = { ok: true }>(action: string, body: Record<string, unknown> = {}) {
  return api<T>(ASSETS_API, { method: "POST", json: { action, ...body } });
}

export function useTreasuries() {
  const [items, setItems] = useState<TreasuryRecord[]>([]);
  useEffect(() => {
    api<{ items: TreasuryRecord[] }>("/api/admin/accounting/treasury")
      .then((d) => setItems(d.items.filter((t) => t.isActive)))
      .catch(() => {});
  }, []);
  return items;
}

export function TreasurySelect({ value, onChange, items, placeholder = "— انتخاب صندوق یا بانک —" }: { value: string; onChange: (v: string) => void; items: TreasuryRecord[]; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder}</option>
      {items.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export interface AccountOpt {
  id: string;
  code: string;
  name: string;
}

export function AccountSelect({ value, onChange, items, placeholder = "— انتخاب حساب —" }: { value: string; onChange: (v: string) => void; items: AccountOpt[]; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder}</option>
      {items.map((a) => (
        <option key={a.id} value={a.id}>
          {faNum(a.code)} — {a.name}
        </option>
      ))}
    </select>
  );
}

/** لینک سند — هر عدد گزارش کلیک‌پذیر است */
export function VoucherLink({ id, number }: { id: string | null | undefined; number: number | null | undefined }) {
  if (!id || !number) return null;
  return (
    <Link href={`/admin/accounting/vouchers/${id}`} className="text-blue-600 hover:underline tabular-nums" onClick={(e) => e.stopPropagation()}>
      سند {faNum(number)}
    </Link>
  );
}

/** «۲٫۵» یا «2.5» → عدد؛ نامعتبر = NaN */
export function parseNum(s: string): number {
  const lat = s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٫،,]/g, ".").trim();
  return lat === "" ? NaN : Number(lat);
}
