"use client";

/** فهرست انبارگردانی‌ها و شروع انبارگردانی تازه */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Empty, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet } from "../ui";
import { Plus } from "lucide-react";

interface C {
  id: string;
  number: number;
  date: string;
  warehouseId: string;
  status: "DRAFT" | "POSTED" | "VOID";
  note: string | null;
  scope: "PARTIAL" | "FULL";
  groupId: string | null;
  round: number;
  applyTo: "ADJUST" | "OPENING";
  createdByName: string;
  _count: { lines: number };
}
interface W {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

interface G {
  id: string;
  name: string;
  parentId: string | null;
}

/** گروه‌ها به ترتیب درخت با تورفتگی */
function groupOptions(groups: G[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const g of groups.filter((x) => x.parentId === parent)) {
      out.push({ id: g.id, label: `${"— ".repeat(depth)}${g.name}` });
      walk(g.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

const STATUS = { DRAFT: { l: "در حال شمارش", t: "amber" }, POSTED: { l: "ثبت شد", t: "green" }, VOID: { l: "باطل", t: "red" } } as const;

export default function CountsClient() {
  const router = useRouter();
  const [data, setData] = useState<{ items: C[]; groups: G[]; can: { manage: boolean } } | null>(null);
  const [whs, setWhs] = useState<W[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [wh, setWh] = useState("");
  const [date, setDate] = useState(dayValue(todayKey()));
  const [note, setNote] = useState("");
  const [scope, setScope] = useState<"PARTIAL" | "FULL">("PARTIAL");
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api<{ items: C[]; groups: G[]; can: { manage: boolean } }>("/api/admin/accounting/inventory/counts"),
      api<{ items: W[] }>("/api/admin/accounting/inventory/warehouses").catch(() => ({ items: [] as W[] })),
    ])
      .then(([c, w]) => {
        setData(c);
        setWhs(w.items.filter((x) => x.isActive));
        setWh((cur) => cur || w.items.find((x) => x.isDefault)?.id || w.items[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ id: string }>("/api/admin/accounting/inventory/counts", { method: "POST", json: { warehouseId: wh, date, note, scope, groupId: groupId || null } });
      router.push(`/admin/accounting/inventory/counts/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخته نشد");
      setBusy(false);
    }
  }

  const name = (id: string) => whs.find((w) => w.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <PageHeader
        title="کالا و انبار"
        help="accountingCounts"
        actions={
          data?.can.manage && (
            <button onClick={() => setOpen(true)} className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden />
              انبارگردانی تازه
            </button>
          )
        }
      />
      <InventoryTabs />
      <ErrorText>{error}</ErrorText>
      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((c) => (
          <Link key={c.id} href={`/admin/accounting/inventory/counts/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
            <span>
              <span className="block text-sm font-bold">
                انبارگردانی {faNum(c.number)} — {name(c.warehouseId)}
              </span>
              <span className="block text-[11px] text-gray-400 mt-0.5">
                {formatJalali(new Date(c.date))} · {faNum(c._count.lines)} کالا · {c.scope === "FULL" ? "کل انبار" : "فقط شمرده‌ها"}
                {c.groupId && ` · ${data.groups.find((g) => g.id === c.groupId)?.name ?? "گروه"}`} · {c.createdByName}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              {c.status === "DRAFT" && c.round === 2 && <Badge tone="amber">شمارش دوم</Badge>}
              {c.status === "POSTED" && c.applyTo === "OPENING" && <Badge tone="blue">اول دوره</Badge>}
              <Badge tone={STATUS[c.status].t}>{STATUS[c.status].l}</Badge>
            </span>
          </Link>
        ))}
        {data && !data.items.length && (
          <Empty title="هنوز انبارگردانی نشده" desc="انبارگردانی یعنی شمردن کالاهای واقعی و ثبت اختلاف با موجودی دفتری. کسری و اضافی خودکار در حساب‌ها می‌نشیند." />
        )}
      </Card>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="انبارگردانی تازه"
        help="accountingCounts"
        footer={
          <button onClick={create} disabled={busy || !wh} className={`${btn.primary} w-full`}>
            {busy ? "…" : "شروع شمارش"}
          </button>
        }
      >
        <div className="space-y-4">
          <Field label="انبار">
            <select value={wh} onChange={(e) => setWh(e.target.value)} className={inputCls}>
              {whs.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="دامنه"
            hint={
              scope === "FULL"
                ? "هر کالای این انبار (یا گروه) که شمرده نشود، در ثبت نهایی صفر می‌شود. برای شمارش کامل انبار."
                : "فقط کالاهایی که می‌شمارید اصلاح می‌شوند؛ بقیه دست نمی‌خورند. برای شمارش بخشی یا سرزده."
            }
          >
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: "PARTIAL", label: "فقط کالاهای شمرده‌شده" },
                { value: "FULL", label: "کل انبار" },
              ]}
            />
          </Field>
          {!!data?.groups.length && (
            <Field label="گروه کالا (اختیاری)" hint="فقط کالاهای این گروه و زیرگروه‌هایش در دامنه‌اند">
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
                <option value="">همه‌ی گروه‌ها</option>
                {groupOptions(data.groups).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="تاریخ شمارش" hint="مبنای اختلاف هر کالا موجودی دفتری لحظه‌ی اولین شمارش آن است؛ فروش بعد از شمردن اختلاف نمی‌سازد">
            <JalaliDatePicker value={date} onChange={setDate} />
          </Field>
          <Field label="توضیح (اختیاری)">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="مثلاً: انبارگردانی پایان شهریور" />
          </Field>
          <ErrorText>{error}</ErrorText>
        </div>
      </Sheet>
    </div>
  );
}
