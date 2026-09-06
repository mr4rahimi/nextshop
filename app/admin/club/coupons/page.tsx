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
  note: string | null;
  _count: { redemptions: number };
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
  note: "",
};

export default function CouponsPage() {
  const list = useApi<{ coupons: Coupon[] }>("/api/admin/club/coupons");
  const [form, setForm] = useState({ ...BLANK });
  const [err, setErr] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const coupons = list.data?.coupons ?? [];

  async function save() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    const res = await apiSend("/api/admin/club/coupons", form.id ? "PUT" : "POST", {
      ...(form.id ? { id: form.id } : {}),
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
      note: form.note,
    });

    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setForm({ ...BLANK });
    setNotice("کد تخفیف ذخیره شد");
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
        hint="برای هدیه‌ی تولد، بازگرداندن مشتری خوابیده و مزایای سطوح عضویت"
      />

      {notice && <Notice text={notice} ok />}
      <ErrorBox err={err ?? list.err} onRetry={list.err ? list.reload : undefined} />

      <Card title={form.id ? `ویرایش کد ${form.code}` : "کد جدید"}>
        <div className="grid sm:grid-cols-2 gap-4">
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

          <Field
            label="تاریخ انقضا"
            type="date"
            dir="ltr"
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
        </div>

        <div className="flex justify-end gap-2">
          {form.id && (
            <Button variant="ghost" onClick={() => setForm({ ...BLANK })}>
              انصراف
            </Button>
          )}
          <Button onClick={save} disabled={busy || !form.code.trim()}>
            {busy ? "در حال ذخیره..." : "ذخیره"}
          </Button>
        </div>
      </Card>

      <Card title="کدهای موجود">
        {list.loading ? (
          <Skeleton rows={3} />
        ) : coupons.length === 0 ? (
          <Empty text="هنوز کد تخفیفی ساخته نشده است" />
        ) : (
          <Table head={["کد", "نوع", "مقدار", "استفاده", "انقضا", "وضعیت", ""]}>
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
                        note: c.note ?? "",
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
