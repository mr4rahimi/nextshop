"use client";

/** فهرست ورودی‌های سریع (سند الگو) — docs/plans/webhesab-parity.md بخش ۱۹ */

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { api, btn, Card, Empty, ErrorText, PageHeader } from "../ui";
import type { Template } from "./types";

type Item = Template & { used: number; lastUsed: string | null };

const BASE = "/admin/accounting/vouchers/templates";

export default function TemplatesClient() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Item[] }>("/api/admin/accounting/vouchers/templates")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, []);

  const add = (
    <Link href={`${BASE}/new`} className={btn.primary}>
      ➕ الگوی تازه
    </Link>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="ورودی سریع"
        help="accountingTemplates"
        desc="ثبت‌های تکراری را یک بار الگو کنید؛ بعد فقط مبلغ را می‌زنید و سند کامل ساخته می‌شود."
        back={{ href: "/admin/accounting/vouchers", label: "اسناد" }}
        actions={add}
      />
      <ErrorText>{error}</ErrorText>
      {items === null && !error && <p className="text-xs text-gray-400">در حال بارگذاری…</p>}
      {items?.length === 0 && <Empty title="هنوز الگویی نساخته‌اید" desc="مثلاً اجاره‌ی ماهانه با کسر مالیات، یا کارمزد ثابت بانک." action={add} />}

      <div className="grid gap-3 md:grid-cols-2">
        {items?.map((t) => (
          <Card key={t.id} className="p-4 space-y-3">
            <div>
              <div className="font-bold text-sm">{t.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
            </div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              {t.lines.map((l) => (
                <li key={l.id} className="flex gap-1.5">
                  <span className={l.side === "DEBIT" ? "text-emerald-600" : "text-rose-600"}>{l.side === "DEBIT" ? "بد" : "بس"}</span>
                  <span className="truncate">{l.account.name}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`${BASE}/${t.id}/run`} className={btn.primary}>
                ⚡ ثبت
              </Link>
              <Link href={`${BASE}/${t.id}`} className={btn.soft}>
                ویرایش
              </Link>
              {t.used > 0 ? (
                <Link href={`/admin/accounting/vouchers?template=${t.id}`} className="text-xs text-blue-600 hover:underline mr-auto">
                  {faNum(t.used)} سند{t.lastUsed ? ` · آخرین ${formatJalali(new Date(t.lastUsed))}` : ""}
                </Link>
              ) : (
                <span className="text-xs text-gray-400 mr-auto">هنوز استفاده نشده</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
