"use client";

import { useState } from "react";
import {
  Card,
  Button,
  Field,
  DateField,
  Select,
  ErrorBox,
  Notice,
  Empty,
  Skeleton,
  Table,
  Badge,
  PageHeader,
  fa,
  faDate,
  useApi,
  apiSend,
  type ApiError,
} from "@/components/admin/sms/ui";

interface Coupon {
  id: string;
  code: string;
  title: string | null;
  type: "PERCENT" | "FIXED" | "FREE_SHIP";
  value: string;
  maxDiscount: string;
  minOrderTotal: string;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  clubOnly: boolean;
  isActive: boolean;
  showInChat: boolean;
  onlineEnabled: boolean;
  posEnabled: boolean;
  batch: string | null;
  note: string | null;
  _count: { redemptions: number };
}
interface Batch {
  batch: string;
  count: number;
  used: number;
  active: number;
  createdAt: string;
  expiresAt: string | null;
  type: Coupon["type"];
  value: string;
  title: string | null;
  posEnabled: boolean;
  onlineEnabled: boolean;
}

const TYPES = [
  { value: "PERCENT", label: "درصدی" },
  { value: "FIXED", label: "مبلغ ثابت" },
  { value: "FREE_SHIP", label: "ارسال رایگان" },
] as const;

const BLANK = {
  id: "",
  code: "",
  title: "",
  type: "PERCENT" as Coupon["type"],
  value: "10",
  maxDiscount: "",
  minOrderTotal: "",
  expiresAt: "",
  usageLimit: "",
  perUserLimit: "1",
  clubOnly: false,
  isActive: true,
  showInChat: false,
  onlineEnabled: true,
  posEnabled: false,
  note: "",
  bulk: false,
  bulkCount: "100",
  bulkPrefix: "",
  bulkName: "",
};

/** خروجی CSV کدهای یک دسته برای چاپخانه یا برچسب‌زن — با BOM تا اکسل فارسی را درست باز کند */
async function downloadBatch(batch: string) {
  const res = await fetch(`/api/admin/club/coupons?batch=${encodeURIComponent(batch)}`);
  const d = (await res.json()) as { coupons?: Coupon[] };
  const rows = (d.coupons ?? []).map((c) => [c.code, c.title ?? "", c.type === "PERCENT" ? `${c.value}%` : c.value, c.expiresAt ? faDate(c.expiresAt) : "", c._count.redemptions, c.isActive ? "فعال" : "غیرفعال"]);
  const text = "\ufeff" + [["کد", "عنوان", "تخفیف", "انقضا", "استفاده", "وضعیت"], ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `coupons-${batch}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const where = (c: { onlineEnabled: boolean; posEnabled: boolean }) =>
  c.onlineEnabled && c.posEnabled ? "سایت و فروشگاه" : c.posEnabled ? "فقط فروشگاه" : "فقط سایت";

export default function CouponsPage() {
  const list = useApi<{ coupons: Coupon[]; batches: Batch[] }>("/api/admin/club/coupons");
  const [form, setForm] = useState({ ...BLANK });
  const [err, setErr] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const coupons = list.data?.coupons ?? [];

  async function save() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    const bulk = !form.id && form.bulk;
    const res = await apiSend<{ batch?: string; count?: number }>("/api/admin/club/coupons", form.id ? "PUT" : "POST", {
      ...(form.id ? { id: form.id } : {}),
      ...(bulk ? { bulk: { count: Number(form.bulkCount.replace(/\D/g, "")) || 0, prefix: form.bulkPrefix, batch: form.bulkName } } : {}),
      code: form.code,
      title: form.title,
      type: form.type,
      value: Number(form.value.replace(/\D/g, "")) || 0,
      maxDiscount: Number(form.maxDiscount.replace(/\D/g, "")) || 0,
      minOrderTotal: Number(form.minOrderTotal.replace(/\D/g, "")) || 0,
      expiresAt: form.expiresAt || null,
      usageLimit: Number(form.usageLimit.replace(/\D/g, "")) || 0,
      perUserLimit: Number(form.perUserLimit.replace(/\D/g, "")) || 0,
      clubOnly: form.clubOnly,
      isActive: form.isActive,
      showInChat: form.showInChat,
      onlineEnabled: form.onlineEnabled,
      posEnabled: form.posEnabled,
      note: form.note,
    });

    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setForm({ ...BLANK });
    if (bulk && res.data.batch) {
      setNotice(`${fa(res.data.count ?? 0)} کد در دسته‌ی «${res.data.batch}» ساخته شد؛ فایل کدها دانلود می‌شود`);
      downloadBatch(res.data.batch);
    } else setNotice("کد تخفیف ذخیره شد");
    list.reload();
  }

  async function disableBatch(batch: string) {
    if (!window.confirm(`همه‌ی کدهای فعال دسته‌ی «${batch}» غیرفعال شوند؟`)) return;
    const res = await apiSend<{ message?: string }>(`/api/admin/club/coupons?batch=${encodeURIComponent(batch)}`, "DELETE");
    if (!res.ok) return setErr(res.err);
    setNotice(res.data.message ?? "دسته غیرفعال شد");
    list.reload();
  }

  async function remove(id: string) {
    const res = await apiSend<{ deactivated?: boolean; message?: string }>(
      `/api/admin/club/coupons?id=${id}`,
      "DELETE"
    );
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    if (res.data.deactivated) setNotice(res.data.message ?? "کد غیرفعال شد");
    list.reload();
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, code: out }));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="کدهای تخفیف"
        hint="برای هدیه‌ی تولد، بازگرداندن مشتری خوابیده، مزایای سطوح عضویت و کارت تخفیف چاپی فروشگاه"
      />

      {notice && <Notice text={notice} ok />}
      <ErrorBox err={err ?? list.err} onRetry={list.err ? list.reload : undefined} />

      <Card title={form.id ? `ویرایش کد ${form.code}` : form.bulk ? "ساخت دسته‌ای (کارت تخفیف چاپی)" : "کد جدید"}>
        {!form.id && (
          <div className="flex gap-2">
            {[
              { v: false, l: "یک کد" },
              { v: true, l: "ساخت دسته‌ای (کارت چاپی)" },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => setForm((f) => ({ ...f, bulk: o.v, ...(o.v ? { usageLimit: f.usageLimit || "1", posEnabled: true } : {}) }))}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-black ${form.bulk === o.v ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500 dark:bg-white/5"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {form.bulk && !form.id ? (
            <>
              <Field label="نام دسته" value={form.bulkName} onChange={(v) => setForm((f) => ({ ...f, bulkName: v }))} placeholder="کارت تخفیف نوروز" />
              <Field label="تعداد کارت" hint="۱ تا ۲٬۰۰۰" dir="ltr" value={form.bulkCount} onChange={(v) => setForm((f) => ({ ...f, bulkCount: v }))} />
              <Field
                label="پیشوند کد (اختیاری)"
                hint="هر کد = پیشوند + ۶ نویسه‌ی تصادفی؛ مثلاً NOROOZ7K3QWP"
                dir="ltr"
                value={form.bulkPrefix}
                onChange={(v) => setForm((f) => ({ ...f, bulkPrefix: v.toUpperCase() }))}
                placeholder="NOROOZ"
              />
            </>
          ) : (
          <div>
            <Field
              label="کد"
              dir="ltr"
              value={form.code}
              onChange={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
              placeholder="WELCOME10"
            />
            <button
              onClick={randomCode}
              className="text-[10px] font-black text-primary-600 hover:underline mt-1.5"
            >
              ساخت کد تصادفی
            </button>
          </div>
          )}

          <Field
            label="عنوان (اختیاری)"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="هدیه تولد"
          />

          <Select
            label="نوع"
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />

          {form.type !== "FREE_SHIP" && (
            <Field
              label={form.type === "PERCENT" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}
              dir="ltr"
              value={form.value}
              onChange={(v) => setForm((f) => ({ ...f, value: v }))}
            />
          )}

          {form.type === "PERCENT" && (
            <Field
              label="سقف تخفیف (تومان)"
              hint="خالی یا ۰ یعنی بی‌سقف"
              dir="ltr"
              value={form.maxDiscount}
              onChange={(v) => setForm((f) => ({ ...f, maxDiscount: v }))}
            />
          )}

          <Field
            label="حداقل مبلغ سبد (تومان)"
            dir="ltr"
            value={form.minOrderTotal}
            onChange={(v) => setForm((f) => ({ ...f, minOrderTotal: v }))}
          />

          <DateField
            label="تاریخ انقضا"
            placeholder="بدون انقضا"
            value={form.expiresAt}
            onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))}
          />

          <Field
            label="سقف کل استفاده"
            hint="۰ یعنی نامحدود"
            dir="ltr"
            value={form.usageLimit}
            onChange={(v) => setForm((f) => ({ ...f, usageLimit: v }))}
          />

          <Field
            label="سقف استفاده هر کاربر"
            hint="۰ یعنی نامحدود"
            dir="ltr"
            value={form.perUserLimit}
            onChange={(v) => setForm((f) => ({ ...f, perUserLimit: v }))}
          />
        </div>

        <div className="flex gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.onlineEnabled}
              onChange={(e) => setForm((f) => ({ ...f, onlineEnabled: e.target.checked }))}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">در سایت</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" title="صندوقدار کد را در کادر اسکن یا پنجره‌ی تخفیف (F4) صندوق می‌زند">
            <input
              type="checkbox"
              checked={form.posEnabled}
              onChange={(e) => setForm((f) => ({ ...f, posEnabled: e.target.checked }))}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">در صندوق فروشگاه</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.clubOnly}
              onChange={(e) => setForm((f) => ({ ...f, clubOnly: e.target.checked }))}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
              فقط اعضای باشگاه
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">فعال</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" title="دستیار خرید سایت این کد را به مشتری‌ای که دنبال تخفیف است معرفی می‌کند">
            <input
              type="checkbox"
              checked={form.showInChat}
              onChange={(e) => setForm((f) => ({ ...f, showInChat: e.target.checked }))}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
              معرفی به مشتری در دستیار خرید
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          {form.id && (
            <Button variant="ghost" onClick={() => setForm({ ...BLANK })}>
              انصراف
            </Button>
          )}
          <Button onClick={save} disabled={busy || (form.bulk && !form.id ? !form.bulkName.trim() : !form.code.trim())}>
            {busy ? "در حال ذخیره..." : form.bulk && !form.id ? "ساخت کدها" : "ذخیره"}
          </Button>
        </div>
        {form.posEnabled && Number(form.perUserLimit.replace(/\D/g, "")) > 0 && (
          <p className="text-[10px] font-bold text-gray-400 leading-5">
            با «سقف استفاده هر کاربر»، صندوق کد را فقط برای مشتری انتخاب‌شده‌ی موبایل‌دار می‌پذیرد. برای کارت چاپی که هر کسی بیاورد، این سقف را ۰ و «سقف کل استفاده» را ۱ بگذارید.
          </p>
        )}
      </Card>

      {!!list.data?.batches?.length && (
        <Card title="دسته‌ها (کارت‌های تخفیف چاپی)">
          <Table head={["دسته", "تخفیف", "کجا", "استفاده", "انقضا", ""]}>
            {list.data.batches.map((b) => (
              <tr key={b.batch}>
                <td className="py-2.5">
                  <span className="block text-[11px] font-black">{b.batch}</span>
                  <span className="block text-[10px] font-bold text-gray-400">
                    {fa(b.count)} کد{b.active < b.count ? ` · ${fa(b.count - b.active)} غیرفعال` : ""}
                  </span>
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                  {b.type === "PERCENT" ? `${fa(b.value)}٪` : b.type === "FIXED" ? `${fa(b.value)} تومان` : "ارسال رایگان"}
                </td>
                <td className="py-2.5 text-[10px] font-bold text-gray-500">{where(b)}</td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                  {fa(b.used)} از {fa(b.count)}
                </td>
                <td className="py-2.5 text-[10px] font-bold text-gray-400 whitespace-nowrap">{b.expiresAt ? faDate(b.expiresAt) : "بدون انقضا"}</td>
                <td className="py-2.5 text-left whitespace-nowrap">
                  <button onClick={() => downloadBatch(b.batch)} className="text-[10px] font-black text-primary-600 hover:underline">
                    خروجی کدها
                  </button>
                  {b.active > 0 && (
                    <button onClick={() => disableBatch(b.batch)} className="text-[10px] font-black text-red-500 hover:underline mr-3">
                      غیرفعال کردن
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card title="کدهای موجود">
        {list.loading ? (
          <Skeleton rows={3} />
        ) : coupons.length === 0 ? (
          <Empty text="هنوز کد تخفیفی ساخته نشده است" />
        ) : (
          <Table head={["کد", "نوع", "مقدار", "کجا", "استفاده", "انقضا", "وضعیت", ""]}>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="py-2.5">
                  <code className="text-[11px] font-black text-primary-600" dir="ltr">
                    {c.code}
                  </code>
                  {c.title && (
                    <span className="block text-[10px] font-bold text-gray-400">{c.title}</span>
                  )}
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500">
                  {TYPES.find((t) => t.value === c.type)?.label}
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                  {c.type === "FREE_SHIP"
                    ? "—"
                    : c.type === "PERCENT"
                      ? `${fa(c.value)}٪`
                      : `${fa(c.value)} تومان`}
                </td>
                <td className="py-2.5 text-[10px] font-bold text-gray-500">
                  {where(c)}
                  {c.batch && <span className="block text-gray-400">دسته: {c.batch}</span>}
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                  {fa(c._count.redemptions)}
                  {c.usageLimit > 0 && ` از ${fa(c.usageLimit)}`}
                </td>
                <td className="py-2.5 text-[10px] font-bold text-gray-400 whitespace-nowrap">
                  {c.expiresAt ? faDate(c.expiresAt) : "بدون انقضا"}
                </td>
                <td className="py-2.5">
                  <Badge
                    text={c.isActive ? "فعال" : "غیرفعال"}
                    tone={c.isActive ? "ok" : "muted"}
                  />
                </td>
                <td className="py-2.5 text-left whitespace-nowrap">
                  <button
                    onClick={() =>
                      setForm({
                        id: c.id,
                        code: c.code,
                        title: c.title ?? "",
                        type: c.type,
                        value: c.value,
                        maxDiscount: c.maxDiscount === "0" ? "" : c.maxDiscount,
                        minOrderTotal: c.minOrderTotal === "0" ? "" : c.minOrderTotal,
                        expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
                        usageLimit: c.usageLimit ? String(c.usageLimit) : "",
                        perUserLimit: String(c.perUserLimit),
                        clubOnly: c.clubOnly,
                        isActive: c.isActive,
                        showInChat: c.showInChat,
                        onlineEnabled: c.onlineEnabled,
                        posEnabled: c.posEnabled,
                        note: c.note ?? "",
                        bulk: false,
                        bulkCount: "100",
                        bulkPrefix: "",
                        bulkName: "",
                      })
                    }
                    className="text-[10px] font-black text-primary-600 hover:underline"
                  >
                    ویرایش
                  </button>
                  <button
                    onClick={() => remove(c.id)}
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
