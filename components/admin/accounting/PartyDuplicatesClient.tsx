"use client";

/**
 * نامزدهای تکراری — هم‌موبایل، هم‌کد ملی، هم‌نام (docs/plans/webhesab-parity.md بخش ۱۷).
 * هر گروه: اولی (کد کوچک‌تر) و کنار بقیه «ادغام» که پنجره‌ی ادغام را با همان جفت باز می‌کند.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import PartyMerge from "./PartyMerge";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, PageHeader } from "./ui";

type Kind = "mobile" | "nationalId" | "name";
interface Group {
  kind: Kind;
  key: string;
  parties: { id: string; code: number; name: string; mobile: string | null; createdAt: string }[];
}
const KIND_LABEL: Record<Kind, string> = { mobile: "موبایل یکسان", nationalId: "کد ملی یکسان", name: "نام یکسان" };

export default function PartyDuplicatesClient() {
  const [kind, setKind] = useState<"" | Kind>("");
  const [data, setData] = useState<{ groups: Group[]; can: { merge: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pair, setPair] = useState<[string, string] | null>(null);

  const load = useCallback(() => {
    api<{ groups: Group[]; can: { merge: boolean } }>(`/api/admin/accounting/parties/duplicates`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const groups = data?.groups.filter((g) => !kind || g.kind === kind) ?? [];
  const count = (k: Kind) => data?.groups.filter((g) => g.kind === k).length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="اشخاص تکراری"
        help="accountingPartyMerge"
        back={{ href: "/admin/accounting/parties", label: "اشخاص" }}
        desc="کسانی که احتمالاً دو بار تعریف شده‌اند و حسابشان دو تکه است. «ادغام» همه‌ی گردش را به یکی منتقل می‌کند."
      />
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <p className="text-xs text-gray-400">در حال بارگذاری…</p>}
      {data && (
        <>
          <Chips<"" | Kind>
            value={kind}
            onChange={setKind}
            options={[
              { value: "", label: "همه", count: data.groups.length },
              { value: "mobile", label: KIND_LABEL.mobile, count: count("mobile") },
              { value: "nationalId", label: KIND_LABEL.nationalId, count: count("nationalId") },
              { value: "name", label: KIND_LABEL.name, count: count("name") },
            ]}
          />
          {!data.can.merge && (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              فهرست را می‌بینید؛ ادغام مجوز «نمای حسابدار» هم می‌خواهد.
            </p>
          )}
          {!groups.length ? (
            <Empty title="شخص تکراری پیدا نشد" desc="هیچ دو شخص فعالی موبایل، کد ملی یا نام یکسان ندارند." />
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <Card key={`${g.kind}|${g.key}`} className="overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500">
                    <Badge tone={g.kind === "name" ? "gray" : "amber"}>{KIND_LABEL[g.kind]}</Badge>
                    {g.kind !== "name" && <span dir="ltr">{faNum(g.key)}</span>}
                    <span className="mr-auto">{faNum(g.parties.length)} شخص</span>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-white/5">
                    {g.parties.map((p, i) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                        <Link href={`/admin/accounting/parties/${p.id}`} className="font-bold text-blue-700 dark:text-blue-300 hover:underline">
                          {p.name}
                        </Link>
                        <span className="text-[11px] text-gray-400">
                          کد {faNum(p.code)}
                          {p.mobile && g.kind !== "mobile" && <> · <span dir="ltr">{faNum(p.mobile)}</span></>} · تعریف {formatJalali(new Date(p.createdAt))}
                        </span>
                        {i > 0 && data.can.merge && (
                          <button onClick={() => setPair([g.parties[0].id, p.id])} className={`${btn.small} mr-auto`}>
                            🔀 ادغام با «{g.parties[0].name}»
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {pair && (
        <PartyMerge
          baseId={pair[0]}
          otherId={pair[1]}
          onClose={() => setPair(null)}
          onDone={() => {
            setPair(null);
            load();
          }}
        />
      )}
    </div>
  );
}
