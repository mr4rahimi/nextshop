"use client";

import { useState } from "react";
import {
  Card,
  Button,
  Field,
  Select,
  ErrorBox,
  Notice,
  Empty,
  Skeleton,
  Table,
  useApi,
  PageHeader,
  fa,
  apiSend,
  type ApiError,
} from "@/components/admin/sms/ui";

interface Tier {
  id: string;
  title: string;
  slug: string;
  minSpent: string;
  color: string | null;
  pointRate: number;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
  _count: { profiles: number };
}

const BLANK = {
  id: "",
  title: "",
  slug: "",
  minSpent: "0",
  color: "#d4af37",
  pointRate: "1",
  benefits: "",
  isActive: true,
};

export default function TiersPage() {
  const list = useApi<{ tiers: Tier[] }>("/api/admin/club/tiers");
  const [err, setErr] = useState<ApiError | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const tiers = list.data?.tiers ?? null;
  const load = list.reload;

  async function save() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    const payload = {
      ...(form.id ? { id: form.id } : {}),
      title: form.title,
      slug: form.slug,
      minSpent: Number(form.minSpent.replace(/\D/g, "")) || 0,
      color: form.color,
      pointRate: Number(form.pointRate) || 1,
      benefits: form.benefits.split("\n").map((s) => s.trim()).filter(Boolean),
      isActive: form.isActive,
    };

    const res = await apiSend("/api/admin/club/tiers", form.id ? "PUT" : "POST", payload);
    setBusy(false);

    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setForm({ ...BLANK });
    setNotice({ text: "سطح ذخیره شد", ok: true });
    load();
  }

  async function remove(id: string) {
    const res = await apiSend(`/api/admin/club/tiers?id=${id}`, "DELETE");
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="سطوح عضویت"
        hint="سطح هر عضو خودکار از روی مجموع خریدش تعیین می‌شود. بدون تعریف سطح، هیچ‌کس سطح نمی‌گیرد."
      />

      {notice && <Notice text={notice.text} ok={notice.ok} />}
      <ErrorBox err={err ?? list.err} onRetry={list.err ? load : undefined} />

      <Recalc onDone={load} />

      <Card title={form.id ? "ویرایش سطح" : "سطح جدید"}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="عنوان"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="مثلاً طلایی"
          />
          <Field
            label="شناسه انگلیسی"
            dir="ltr"
            value={form.slug}
            onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
            placeholder="gold"
          />
          <Field
            label="حداقل مجموع خرید (تومان)"
            dir="ltr"
            value={form.minSpent ? fa(form.minSpent.replace(/\D/g, "") || 0) : ""}
            onChange={(v) => setForm((f) => ({ ...f, minSpent: v }))}
            hint="عضوی که مجموع خریدش از این بیشتر باشد این سطح را می‌گیرد"
          />
          <Field
            label="ضریب امتیاز"
            dir="ltr"
            value={form.pointRate}
            onChange={(v) => setForm((f) => ({ ...f, pointRate: v }))}
            hint="۱ یعنی عادی، ۱٫۵ یعنی ۵۰٪ امتیاز بیشتر"
          />
          <Field
            label="رنگ"
            dir="ltr"
            value={form.color}
            onChange={(v) => setForm((f) => ({ ...f, color: v }))}
          />
          <Select
            label="وضعیت"
            value={form.isActive ? "1" : "0"}
            onChange={(v) => setForm((f) => ({ ...f, isActive: v === "1" }))}
            options={[
              { value: "1", label: "فعال" },
              { value: "0", label: "غیرفعال" },
            ]}
          />
        </div>

        <label className="block">
          <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">
            مزایا — هر خط یک مورد
          </span>
          <textarea
            rows={3}
            value={form.benefits}
            onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
            placeholder={"ارسال رایگان\n۱۰٪ تخفیف دائمی"}
            className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary-500 leading-relaxed"
          />
        </label>

        <div className="flex justify-end gap-2">
          {form.id && (
            <Button variant="ghost" onClick={() => setForm({ ...BLANK })}>
              انصراف
            </Button>
          )}
          <Button onClick={save} disabled={busy || !form.title.trim() || !form.slug.trim()}>
            {busy ? "در حال ذخیره..." : "ذخیره"}
          </Button>
        </div>
      </Card>

      <Card title="سطوح تعریف‌شده">
        {list.loading ? (
          <Skeleton rows={3} />
        ) : !tiers?.length ? (
          <Empty text="هنوز سطحی تعریف نشده — تا زمانی که سطح نسازید، هیچ عضوی سطح نمی‌گیرد" />
        ) : (
          <Table head={["سطح", "حداقل خرید", "ضریب", "اعضا", "وضعیت", ""]}>
            {tiers.map((t) => (
              <tr key={t.id}>
                <td className="py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: t.color ?? "#999" }}
                    />
                    <span className="text-[11px] font-black text-gray-800 dark:text-gray-100">
                      {t.title}
                    </span>
                  </span>
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                  {fa(t.minSpent)} تومان
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                  ×{fa(t.pointRate)}
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                  {fa(t._count.profiles)}
                </td>
                <td className="py-2.5 text-[11px] font-bold">
                  {t.isActive ? (
                    <span className="text-emerald-600">فعال</span>
                  ) : (
                    <span className="text-gray-400">غیرفعال</span>
                  )}
                </td>
                <td className="py-2.5 text-left whitespace-nowrap">
                  <button
                    onClick={() =>
                      setForm({
                        id: t.id,
                        title: t.title,
                        slug: t.slug,
                        minSpent: t.minSpent,
                        color: t.color ?? "#d4af37",
                        pointRate: String(t.pointRate),
                        benefits: (t.benefits ?? []).join("\n"),
                        isActive: t.isActive,
                      })
                    }
                    className="text-[10px] font-black text-primary-600 hover:underline"
                  >
                    ویرایش
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="text-[10px] font-black text-red-500 hover:underline mr-3"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/**
 * بازمحاسبه‌ی گذشته
 *
 * سفارش‌های پیش از افزوده شدن قلاب باشگاه هرگز امتیاز نگرفتند. این دکمه
 * دسته‌دسته آن‌ها را پردازش می‌کند و تا تمام شدن ادامه می‌دهد.
 */
function Recalc({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);

    let cursor: string | null = null;

    type RecalcRes = {
      processed: number;
      pointsAwarded: number;
      tierChanges: number;
      firstSourceBackfilled: number;
      nextCursor: string | null;
      done: boolean;
    };
    let processed = 0;
    let points = 0;
    let tiers = 0;
    let backfilled = 0;

    // تا ۵۰ دور — سقف ایمن برای اینکه حلقه بی‌پایان نشود
    for (let round = 0; round < 50; round++) {
      const res: { ok: true; data: RecalcRes } | { ok: false; err: ApiError } =
        await apiSend<RecalcRes>("/api/admin/club/recalc", "POST", {
          limit: 100,
          cursor,
        });

      if (!res.ok) {
        setErr(res.err);
        break;
      }

      processed += res.data.processed;
      points += res.data.pointsAwarded;
      tiers += res.data.tierChanges;
      backfilled += res.data.firstSourceBackfilled;
      setLog(`${fa(processed)} سفارش پردازش شد...`);

      if (res.data.done) break;
      cursor = res.data.nextCursor;
    }

    setBusy(false);
    setLog(
      `${fa(processed)} سفارش پردازش شد · ${fa(points)} امتیاز داده شد · ` +
        `${fa(tiers)} تغییر سطح · ${fa(backfilled)} عضو منبعشان ثبت شد`
    );
    onDone();
  }

  return (
    <Card
      title="بازمحاسبه‌ی گذشته"
      hint="سفارش‌های ثبت‌شده پیش از فعال شدن باشگاه امتیاز نگرفته‌اند. یک بار اجرا کنید — اجرای مجدد بی‌خطر است و امتیاز تکراری نمی‌دهد."
      action={
        <Button onClick={run} disabled={busy}>
          {busy ? "در حال اجرا..." : "اجرا"}
        </Button>
      }
    >
      {log && <Notice text={log} ok />}
      <ErrorBox err={err} />
    </Card>
  );
}
