"use client";

/**
 * کدگذاری کالا و تنظیم برچسب — docs/plans/inventory-items.md بخش ۱۲.
 * الگوی کد خودکار (فقط کدهای بعدی عوض می‌شوند)، کد گروه‌ها و چیدمان برچسب.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { DEFAULT_LABEL, type LabelConfig } from "@/lib/accounting/inventory/label-config";
import InventoryTabs from "./InventoryTabs";
import { LabelPages, LabelSettingsForm, SAMPLE_LABELS, testPrintUrl } from "./LabelSheet";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, PageHeader, SectionTitle } from "../ui";

interface Data {
  pattern: string;
  example: string | null;
  presets: { pattern: string; label: string; desc: string; example: string }[];
  groups: { total: number; noCode: number };
  labelConfig: LabelConfig;
  can: { manage: boolean };
}


export default function CodingClient() {
  const [data, setData] = useState<Data | null>(null);
  const [pattern, setPattern] = useState("");
  const [cfg, setCfg] = useState<LabelConfig>(DEFAULT_LABEL);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Data>("/api/admin/accounting/items/coding")
      .then((d) => {
        setData(d);
        setPattern(d.pattern);
        setCfg(d.labelConfig);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function save(json: Record<string, unknown>, msg: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await api<{ coded: number }>("/api/admin/accounting/items/coding", { method: "PATCH", json });
      setNote(json.autoGroupCodes ? `${faNum(r.coded)} گروه کد گرفت` : msg);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  const manage = !!data?.can.manage;
  const usesG = pattern.toUpperCase().includes("{G}");

  return (
    <div className="space-y-4">
      <PageHeader title="کالا و انبار" help="accountingItemCoding" />
      <InventoryTabs />
      <ErrorText>{error}</ErrorText>
      {note && <p className="text-xs font-bold text-emerald-600">{note}</p>}
      {data && (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          <Card className="p-4 space-y-4">
            <SectionTitle title="الگوی کد خودکار کالا" help="accountingItemCoding" />
            <p className="text-xs text-gray-500 leading-6">
              کالای تازه‌ای که کدش خالی بماند (ورود سریع، ماتریس رنگ و سایز، فاکتور خرید، برچسب‌گذاری دوباره) با این الگو کد می‌گیرد. کدهای موجود عوض نمی‌شوند.
            </p>
            <div className="space-y-2">
              {data.presets.map((p) => (
                <button
                  key={p.pattern}
                  type="button"
                  disabled={!manage}
                  onClick={() => setPattern(p.pattern)}
                  className={`w-full text-right rounded-xl border px-3 py-2.5 transition ${
                    pattern === p.pattern ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-gray-200 dark:border-white/10"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <b className="text-sm">{p.label}</b>
                    <span dir="ltr" className="font-mono text-xs text-gray-500">
                      {p.example}
                    </span>
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
            <Field label="الگو" hint="{N} شماره‌ی پشت‌سرهم · {G} کد گروه · {M4} شماره‌ی مدل ۴رقمی · {V2} شماره‌ی تنوع ۲رقمی (آخر الگو)">
              <input value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={!manage} className={`${inputCls} font-mono`} dir="ltr" />
            </Field>
            {manage && (
              <button onClick={() => save({ pattern }, "الگوی کد ذخیره شد")} disabled={busy || pattern === data.pattern} className={`${btn.primary} w-full`}>
                ذخیره‌ی الگو
              </button>
            )}
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-xs space-y-2">
              <p className="flex items-center justify-between">
                <span>کد گروه‌ها</span>
                {data.groups.noCode ? <Badge tone="amber">{faNum(data.groups.noCode)} گروه بی‌کد</Badge> : <Badge tone="green">همه کد دارند</Badge>}
              </p>
              {usesG && (
                <p className="text-gray-500 leading-5">
                  الگوی فعلی کد گروه را در کد کالا می‌آورد. کالای گروهِ بی‌کد «۰۰» می‌گیرد. کد هر گروه را در{" "}
                  <Link href="/admin/accounting/inventory/groups" className="text-blue-600 font-bold">
                    گروه‌ها
                  </Link>{" "}
                  بنویسید یا خودکار بدهید.
                </p>
              )}
              {manage && data.groups.noCode > 0 && (
                <button onClick={() => save({ autoGroupCodes: true }, "")} disabled={busy} className={btn.small}>
                  کد خودکار برای گروه‌های بی‌کد
                </button>
              )}
            </div>
          </Card>
          <Card className="p-4 space-y-4">
            <SectionTitle title="چاپ برچسب بارکد" help="accountingItemCoding" />
            <LabelSettingsForm value={cfg} onChange={setCfg} />
            <div className="flex gap-2">
              {manage && (
                <button onClick={() => save({ labelConfig: cfg }, "تنظیم برچسب ذخیره شد")} disabled={busy} className={`${btn.primary} flex-1`}>
                  ذخیره‌ی تنظیم برچسب
                </button>
              )}
              <button onClick={() => window.open(testPrintUrl(cfg), "_blank")} className={btn.soft}>
                چاپ آزمایشی
              </button>
            </div>
            <p className="text-[11px] text-gray-500 leading-5">چاپ آزمایشی با همین اعداد (حتی ذخیره‌نشده) دو ردیف نمونه چاپ می‌کند. اگر درست افتاد، ذخیره کنید.</p>
            <div className="rounded-xl bg-gray-100 dark:bg-white/5 overflow-x-auto [color-scheme:light]">
              <LabelPages labels={SAMPLE_LABELS} c={cfg} preview />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
