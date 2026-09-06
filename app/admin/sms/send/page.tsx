"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Field,
  TextArea,
  Select,
  ErrorBox,
  Notice,
  PageHeader,
  fa,
  useApi,
  apiSend,
  type ApiError,
} from "@/components/admin/sms/ui";
import type { Line, Pattern, Phonebook, Paged, CostEstimate } from "@/lib/club/sms/panel-types";

type Mode = "simple" | "keywords" | "pattern" | "phonebook" | "sample";

const MODES: { value: Mode; label: string }[] = [
  { value: "simple", label: "متن یکسان برای همه" },
  { value: "keywords", label: "متن شخصی‌سازی‌شده" },
  { value: "pattern", label: "ارسال با پترن" },
  { value: "phonebook", label: "ارسال به دفترچه تلفن" },
  { value: "sample", label: "ارسال آزمایشی به خودم" },
];

export default function SendPage() {
  const lines = useApi<{ lines: Line[] }>("/api/admin/sms/lines");

  const [mode, setMode] = useState<Mode>("simple");
  const [line, setLine] = useState("");
  const [text, setText] = useState("");
  const [recipients, setRecipients] = useState("");
  const [patternCode, setPatternCode] = useState("");
  const [patternVars, setPatternVars] = useState<Record<string, string>>({});
  const [patternMobile, setPatternMobile] = useState("");
  const [bookId, setBookId] = useState("");
  const [bookLimit, setBookLimit] = useState("1000");

  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // اولین خط را پیش‌فرض انتخاب کن تا ادمین یک کلیک کمتر بزند
  useEffect(() => {
    if (!line && lines.data?.lines.length) setLine(lines.data.lines[0].number);
  }, [lines.data, line]);

  const needsPattern = mode === "pattern";
  const needsPhonebook = mode === "phonebook";
  const needsRecipients = mode === "simple" || mode === "keywords";

  const patterns = useApi<Paged<Pattern>>(
    needsPattern ? "/api/admin/sms/patterns?limit=100&status=active" : null
  );
  const books = useApi<Paged<Phonebook>>(
    needsPhonebook ? "/api/admin/sms/phonebooks?limit=100" : null
  );

  const selectedPattern = patterns.data?.items.find((p) => p.code === patternCode) ?? null;

  const parsedRecipients = useMemo(() => parseNumbers(recipients), [recipients]);

  const selectedLine = lines.data?.lines.find((l) => l.number === line) ?? null;

  // متن آزاد روی خط خدماتی تا تأیید دستی اپراتور ارسال نمی‌شود
  const serviceLineWarning =
    (mode === "simple" || mode === "keywords" || mode === "phonebook") &&
    selectedLine?.service === true;

  async function estimate() {
    if (!line || !text.trim()) return;
    const count = needsRecipients ? parsedRecipients.valid.length : 1;
    if (count === 0) return;

    const res = await apiSend<CostEstimate>("/api/admin/sms/cost", "POST", {
      lineNumber: line,
      text,
      receiverCount: count,
    });
    setCost(res.ok ? res.data : null);
  }

  // تخمین هزینه با تأخیر — هر کلید فشردن یک درخواست نفرستد
  useEffect(() => {
    if (!needsRecipients || !text.trim() || parsedRecipients.valid.length === 0) {
      setCost(null);
      return;
    }
    const t = setTimeout(estimate, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, recipients, line, mode]);

  async function send() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    const body: Record<string, unknown> = { mode, lineNumber: line };

    if (needsPattern) {
      body.patternCode = patternCode;
      body.mobile = patternMobile;
      body.vars = patternVars;
    } else if (needsPhonebook) {
      body.text = text;
      body.phonebooks = [{ id: Number(bookId), offset: 0, limit: Number(bookLimit) || 1000 }];
    } else if (mode === "sample") {
      body.text = text;
    } else {
      body.text = text;
      body.recipients = parsedRecipients.valid;
    }

    const res = await apiSend<{
      requestId: number | null;
      rejected?: string[];
      needsApproval?: boolean;
    }>("/api/admin/sms/send", "POST", body);

    setBusy(false);

    if (!res.ok) {
      setErr(res.err);
      return;
    }

    const parts = ["پیامک ثبت شد"];
    if (res.data.requestId) parts.push(`شناسه ارسال: ${res.data.requestId}`);
    if (res.data.rejected?.length) {
      parts.push(`${fa(res.data.rejected.length)} شماره نامعتبر نادیده گرفته شد`);
    }
    if (res.data.needsApproval) {
      parts.push("این ارسال روی خط خدماتی است و تا تأیید اپراتور ارسال نمی‌شود");
    }

    setNotice({ text: parts.join(" — "), ok: true });
    if (mode !== "pattern") setRecipients("");
  }

  const canSend =
    !busy &&
    Boolean(line) &&
    (needsPattern
      ? Boolean(patternCode && patternMobile.trim())
      : needsPhonebook
        ? Boolean(bookId && text.trim())
        : mode === "sample"
          ? Boolean(text.trim())
          : Boolean(text.trim() && parsedRecipients.valid.length > 0));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="ارسال پیامک" hint="ارسال دستی از پنل فروشگاه" />

      {notice && <Notice text={notice.text} ok={notice.ok} />}
      <ErrorBox err={err} />

      <Card>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="نوع ارسال"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setCost(null);
              setNotice(null);
            }}
            options={MODES}
          />
          <Select
            label="خط ارسال"
            hint={selectedLine ? `تعرفه ${fa(selectedLine.smsCost)} تومان برای هر صفحه` : undefined}
            value={line}
            onChange={setLine}
            options={
              lines.data?.lines.map((l) => ({ value: l.number, label: l.number })) ?? [
                { value: "", label: "در حال بارگذاری..." },
              ]
            }
          />
        </div>

        {serviceLineWarning && (
          <Notice
            ok={false}
            text="این خط خدماتی است. متن آزاد روی خط خدماتی تا تأیید دستی اپراتور ارسال نمی‌شود — برای ارسال فوری از پترن استفاده کنید."
          />
        )}
      </Card>

      {/* ── پترن ───────────────────────────────────────────────── */}
      {needsPattern && (
        <Card title="پترن" hint="فقط پترن‌های تأییدشده روی خط خدماتی فوری ارسال می‌شوند">
          {patterns.err ? (
            <ErrorBox err={patterns.err} onRetry={patterns.reload} />
          ) : (
            <>
              <Select
                label="انتخاب پترن"
                value={patternCode}
                onChange={(c) => {
                  setPatternCode(c);
                  setPatternVars({});
                }}
                options={[
                  { value: "", label: patterns.loading ? "در حال بارگذاری..." : "— انتخاب کنید —" },
                  ...(patterns.data?.items.map((p) => ({
                    value: p.code,
                    label: `${p.code} — ${p.text.slice(0, 40)}…`,
                  })) ?? []),
                ]}
              />

              {selectedPattern && (
                <>
                  <pre className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-[11px] font-bold text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {selectedPattern.text}
                  </pre>

                  <Field
                    label="شماره گیرنده"
                    dir="ltr"
                    value={patternMobile}
                    onChange={setPatternMobile}
                    placeholder="09123456789"
                  />

                  {selectedPattern.vars.map((v) => (
                    <Field
                      key={v.var}
                      label={`مقدار ${v.var}`}
                      hint={`نوع ${v.type} · حداکثر ${fa(v.length)} کاراکتر`}
                      value={patternVars[v.var] ?? ""}
                      onChange={(val) => setPatternVars((p) => ({ ...p, [v.var]: val }))}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </Card>
      )}

      {/* ── متن و گیرنده ───────────────────────────────────────── */}
      {!needsPattern && (
        <Card>
          <TextArea
            label="متن پیامک"
            hint={
              mode === "keywords"
                ? "برای شخصی‌سازی از {name} استفاده کنید — مقدار هر گیرنده از فهرست خوانده می‌شود"
                : `${fa(text.length)} کاراکتر`
            }
            value={text}
            onChange={setText}
            rows={5}
            placeholder="متن پیامک..."
          />

          {needsRecipients && (
            <>
              <TextArea
                label="گیرندگان"
                hint="هر شماره در یک خط، یا جدا شده با کاما"
                value={recipients}
                onChange={setRecipients}
                rows={5}
                placeholder={"09123456789\n09121112233"}
              />

              <div className="flex flex-wrap gap-4 text-[11px] font-bold">
                <span className="text-emerald-600">
                  {fa(parsedRecipients.valid.length)} شماره معتبر
                </span>
                {parsedRecipients.invalid.length > 0 && (
                  <span className="text-red-500">
                    {fa(parsedRecipients.invalid.length)} شماره نامعتبر (نادیده گرفته می‌شود)
                  </span>
                )}
                {parsedRecipients.duplicates > 0 && (
                  <span className="text-amber-600">
                    {fa(parsedRecipients.duplicates)} تکراری حذف شد
                  </span>
                )}
              </div>
            </>
          )}

          {needsPhonebook && (
            <>
              {books.err ? (
                <ErrorBox err={books.err} onRetry={books.reload} />
              ) : (
                <Select
                  label="دفترچه تلفن"
                  value={bookId}
                  onChange={setBookId}
                  options={[
                    { value: "", label: books.loading ? "در حال بارگذاری..." : "— انتخاب کنید —" },
                    ...(books.data?.items.map((b) => ({
                      value: String(b.id),
                      label: b.contactCount ? `${b.title} (${fa(b.contactCount)})` : b.title,
                    })) ?? []),
                  ]}
                />
              )}
              <Field
                label="حداکثر گیرنده"
                hint="برای محدود کردن ارسال به بخشی از دفترچه"
                type="number"
                dir="ltr"
                value={bookLimit}
                onChange={setBookLimit}
              />
            </>
          )}

          {mode === "sample" && (
            <p className="text-[11px] font-bold text-gray-400 leading-relaxed">
              پیام فقط به شماره‌ی مالک حساب پنل ارسال می‌شود — برای آزمایش متن پیش از ارسال انبوه.
            </p>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            {cost ? (
              <p className="text-xs font-bold text-gray-500">
                هزینه‌ی تخمینی:{" "}
                <span className="text-gray-900 dark:text-white font-black tabular-nums">
                  {fa(cost.total)} تومان
                </span>
                {cost.receiverCount !== undefined && (
                  <span className="text-gray-400"> · {fa(cost.receiverCount)} گیرنده</span>
                )}
              </p>
            ) : (
              <p className="text-[11px] font-bold text-gray-400">
                هزینه پس از نوشتن متن و گیرندگان تخمین زده می‌شود
              </p>
            )}
          </div>
          <Button onClick={send} disabled={!canSend}>
            {busy ? "در حال ارسال..." : "ارسال"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * جدا کردن شماره‌های معتبر از نامعتبر پیش از ارسال
 *
 * همان قواعد سمت سرور، فقط برای اینکه ادمین *قبل* از خرج شدن اعتبار بداند چند
 * شماره واقعاً ارسال می‌شود. سرور دوباره اعتبارسنجی می‌کند.
 */
function parseNumbers(raw: string): { valid: string[]; invalid: string[]; duplicates: number } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const piece of raw.split(/[\s,;،\n]+/)) {
    const t = piece.trim();
    if (!t) continue;

    const d = t
      .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
      .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
      .replace(/\D/g, "");

    let mobile: string | null = null;
    if (/^98\d{10}$/.test(d)) mobile = `0${d.slice(2)}`;
    else if (/^0?9\d{9}$/.test(d)) mobile = d.length === 10 ? `0${d}` : d;

    if (!mobile) {
      invalid.push(t);
      continue;
    }
    if (seen.has(mobile)) {
      duplicates++;
      continue;
    }
    seen.add(mobile);
    valid.push(mobile);
  }

  return { valid, invalid, duplicates };
}
