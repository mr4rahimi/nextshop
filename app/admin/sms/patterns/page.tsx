"use client";

import { useState } from "react";
import {
  Card,
  Button,
  Field,
  TextArea,
  Select,
  ErrorBox,
  Notice,
  Empty,
  Skeleton,
  Pager,
  Badge,
  PageHeader,
  fa,
  faDate,
  useApi,
  apiSend,
  type ApiError,
} from "@/components/admin/sms/ui";
import { statusLabel, statusTone } from "@/components/admin/sms/status";
import type { Pattern, PatternVar, PatternVarType, Paged } from "@/lib/club/sms/panel-types";

const CATEGORIES = [
  { value: "1", label: "کد ورود (OTP)" },
  { value: "2", label: "باشگاه مشتریان" },
  { value: "3", label: "سفارش" },
  { value: "255", label: "سایر" },
];

const VAR_TYPES: { value: PatternVarType; label: string }[] = [
  { value: "str", label: "متن" },
  { value: "int", label: "عدد" },
  { value: "date", label: "تاریخ" },
];

export default function PatternsPage() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Pattern | "new" | null>(null);

  const list = useApi<Paged<Pattern>>(`/api/admin/sms/patterns?page=${page}&limit=20`);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="پترن‌های پیامک"
        hint="پترن الگوی تأییدشده است — تنها راه ارسال فوری روی خط خدماتی"
        action={<Button onClick={() => setEditing("new")}>پترن جدید</Button>}
      />

      {editing && (
        <PatternForm
          pattern={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}

      <Card>
        {list.loading ? (
          <Skeleton rows={4} />
        ) : list.err ? (
          <ErrorBox err={list.err} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <Empty text="هنوز پترنی ثبت نشده است" />
        ) : (
          <>
            <div className="space-y-3">
              {list.data.items.map((p) => (
                <div
                  key={p.code}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-[11px] font-black text-primary-600" dir="ltr">
                          {p.code}
                        </code>
                        <Badge text={statusLabel(p.status)} tone={statusTone(p.status)} />
                        {p.vars.length > 0 && (
                          <span className="text-[10px] font-bold text-gray-400">
                            {fa(p.vars.length)} متغیر
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">
                        {p.text}
                      </p>
                      {p.adminMessage && (
                        <p className="text-[10px] font-bold text-red-500 mt-2 leading-relaxed">
                          پیام اپراتور: {p.adminMessage}
                        </p>
                      )}
                      <p className="text-[10px] font-bold text-gray-400 mt-2">
                        بررسی: {faDate(p.reviewedAt)}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => setEditing(p)}>
                      ویرایش
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Pager
              page={list.data.page}
              lastPage={list.data.lastPage}
              total={list.data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}

function PatternForm({
  pattern,
  onClose,
  onSaved,
}: {
  pattern: Pattern | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(pattern?.text ?? "");
  const [description, setDescription] = useState(pattern?.description ?? "");
  const [website, setWebsite] = useState(pattern?.website ?? "");
  const [category, setCategory] = useState("255");
  const [vars, setVars] = useState<PatternVar[]>(pattern?.vars ?? []);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // متغیرهای داخل متن با `%name%` نوشته می‌شوند
  const inText = [...text.matchAll(/%([A-Za-z_][A-Za-z0-9_]*)%/g)].map((m) => m[1]);
  const missing = inText.filter((v) => !vars.some((x) => x.var === v));
  const extra = vars.filter((v) => !inText.includes(v.var)).map((v) => v.var);

  async function save() {
    setBusy(true);
    setErr(null);

    const body = { text, description, website, shared: false, category: Number(category), vars };
    const res = pattern
      ? await apiSend(`/api/admin/sms/patterns/${encodeURIComponent(pattern.code)}`, "PUT", body)
      : await apiSend("/api/admin/sms/patterns", "POST", body);

    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    onSaved();
  }

  return (
    <Card
      title={pattern ? `ویرایش پترن ${pattern.code}` : "پترن جدید"}
      hint="پترن پس از ثبت باید توسط اپراتور تأیید شود؛ تا آن زمان قابل استفاده نیست"
      action={
        <Button variant="ghost" onClick={onClose}>
          بستن
        </Button>
      }
    >
      <TextArea
        label="متن پترن"
        hint="متغیرها را با %نام% بنویسید — مثلاً: %name% عزیز، سفارش %order% ارسال شد"
        value={text}
        onChange={setText}
        rows={5}
      />

      {missing.length > 0 && (
        <Notice
          ok={false}
          text={`این متغیرها در متن هستند ولی تعریف نشده‌اند: ${missing.join("، ")} — با دکمه‌ی زیر اضافه کنید`}
        />
      )}
      {extra.length > 0 && (
        <Notice
          ok={false}
          text={`این متغیرها تعریف شده‌اند ولی در متن نیستند: ${extra.join("، ")}`}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">متغیرها</span>
          {missing.length > 0 && (
            <Button
              variant="ghost"
              onClick={() =>
                setVars((v) => [
                  ...v,
                  ...missing.map((name) => ({ var: name, length: 30, type: "str" as PatternVarType })),
                ])
              }
            >
              افزودن خودکار از متن
            </Button>
          )}
        </div>

        {vars.length === 0 ? (
          <p className="text-[10px] font-bold text-gray-400">متغیری تعریف نشده است</p>
        ) : (
          vars.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
              <Field
                label="نام"
                dir="ltr"
                value={v.var}
                onChange={(val) =>
                  setVars((p) => p.map((x, j) => (j === i ? { ...x, var: val } : x)))
                }
              />
              <Field
                label="طول"
                type="number"
                dir="ltr"
                value={String(v.length)}
                onChange={(val) =>
                  setVars((p) => p.map((x, j) => (j === i ? { ...x, length: Number(val) || 1 } : x)))
                }
              />
              <Select
                label="نوع"
                value={v.type}
                onChange={(val) => setVars((p) => p.map((x, j) => (j === i ? { ...x, type: val } : x)))}
                options={VAR_TYPES}
              />
              <Button variant="danger" onClick={() => setVars((p) => p.filter((_, j) => j !== i))}>
                حذف
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="توضیح" value={description} onChange={setDescription} />
        <Field label="وب‌سایت" dir="ltr" value={website} onChange={setWebsite} />
      </div>

      {!pattern && (
        <Select label="دسته" value={category} onChange={setCategory} options={CATEGORIES} />
      )}

      <ErrorBox err={err} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        <Button onClick={save} disabled={busy || !text.trim()}>
          {busy ? "در حال ذخیره..." : "ذخیره"}
        </Button>
      </div>
    </Card>
  );
}
