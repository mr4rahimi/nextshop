"use client";

import { useRef, useState } from "react";
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
  Table,
  Badge,
  PageHeader,
  fa,
  faDate,
  useApi,
  apiSend,
  type ApiError,
} from "@/components/admin/sms/ui";
import { statusLabel, statusTone } from "@/components/admin/sms/status";
import type {
  Line,
  NumberBank,
  LbsRequest,
  VoiceFile,
  Province,
  Paged,
} from "@/lib/club/sms/panel-types";

type Tab = "bank" | "voice" | "lbs";

/**
 * امکانات ویژه‌ی پنل
 *
 * ⚠️ این سه قابلیت روی همه‌ی حساب‌ها فعال نیستند. پنل برای حسابی که دسترسی
 *    ندارد ۴۰۳ می‌دهد و ما آن را با پیام «روی حساب شما فعال نیست» نشان می‌دهیم
 *    نه با خطای فنی. عمداً در تب‌های جداگانه‌اند تا باز کردن این صفحه سه
 *    درخواست هم‌زمان نزند.
 */
export default function AdvancedPage() {
  const [tab, setTab] = useState<Tab>("bank");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="امکانات ویژه"
        hint="بانک شماره، پیام صوتی و ارسال موقعیت‌محور — بسته به پکیج حساب پنل"
      />

      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === "bank" ? "primary" : "ghost"} onClick={() => setTab("bank")}>
          بانک شماره
        </Button>
        <Button variant={tab === "voice" ? "primary" : "ghost"} onClick={() => setTab("voice")}>
          پیام صوتی
        </Button>
        <Button variant={tab === "lbs" ? "primary" : "ghost"} onClick={() => setTab("lbs")}>
          ارسال موقعیت‌محور
        </Button>
      </div>

      {tab === "bank" && <NumberBankTab />}
      {tab === "voice" && <VoiceTab />}
      {tab === "lbs" && <LbsTab />}
    </div>
  );
}

function useLines() {
  return useApi<{ lines: Line[] }>("/api/admin/sms/lines");
}

// ── بانک شماره ──────────────────────────────────────────────────────

function NumberBankTab() {
  const banks = useApi<Paged<NumberBank>>("/api/admin/sms/number-bank?limit=50");
  const lines = useLines();

  const [bankId, setBankId] = useState("");
  const [line, setLine] = useState("");
  const [text, setText] = useState("");
  const [limit, setLimit] = useState("100");
  const [err, setErr] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    const res = await apiSend<{ requestId?: number }>("/api/admin/sms/number-bank", "POST", {
      lineNumber: line,
      text,
      targets: [{ bankId: Number(bankId), offset: 0, limit: Number(limit) || 100 }],
    });

    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setNotice(`ارسال ثبت شد${res.data.requestId ? ` — شناسه ${res.data.requestId}` : ""}`);
  }

  return (
    <Card
      title="ارسال به بانک شماره"
      hint="گیرندگان از بانک‌های آماده‌ی پنل انتخاب می‌شوند — بدون داشتن فهرست شماره"
    >
      {banks.err ? (
        <ErrorBox err={banks.err} onRetry={banks.reload} />
      ) : banks.loading ? (
        <Skeleton rows={2} />
      ) : !banks.data?.items.length ? (
        <Empty text="بانک شماره‌ای روی این حساب فعال نیست" />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="بانک شماره"
              value={bankId}
              onChange={setBankId}
              options={[
                { value: "", label: "— انتخاب کنید —" },
                ...banks.data.items.map((b) => ({
                  value: String(b.id),
                  label: `${b.title} (${fa(b.count)})`,
                })),
              ]}
            />
            <Select
              label="خط ارسال"
              value={line}
              onChange={setLine}
              options={[
                { value: "", label: "— انتخاب کنید —" },
                ...(lines.data?.lines.map((l) => ({ value: l.number, label: l.number })) ?? []),
              ]}
            />
          </div>

          <Field label="تعداد گیرنده" type="number" dir="ltr" value={limit} onChange={setLimit} />
          <TextArea label="متن پیامک" value={text} onChange={setText} rows={4} />

          {notice && <Notice text={notice} ok />}
          <ErrorBox err={err} />

          <div className="flex justify-end">
            <Button onClick={send} disabled={busy || !bankId || !line || !text.trim()}>
              {busy ? "در حال ارسال..." : "ارسال"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// ── پیام صوتی ───────────────────────────────────────────────────────

function VoiceTab() {
  const lines = useLines();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploaded, setUploaded] = useState<VoiceFile | null>(null);
  const [recipients, setRecipients] = useState("");
  const [line, setLine] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setBusy(true);
    setErr(null);
    setNotice(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/admin/sms/voice", { method: "PUT", body: form });
      const d = await res.json();
      if (!res.ok) {
        setErr({ error: d.error ?? "آپلود ناموفق", code: d.code });
      } else {
        setUploaded(d.file);
        setNotice("فایل صوتی آپلود شد");
      }
    } catch {
      setErr({ error: "ارتباط با سرور برقرار نشد" });
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!uploaded) return;
    setBusy(true);
    setErr(null);
    setNotice(null);

    const res = await apiSend<{ requestId: number | null }>("/api/admin/sms/voice", "POST", {
      fileId: uploaded.id,
      recipients,
      ...(line ? { lineNumber: line } : {}),
    });

    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setNotice(`ارسال ثبت شد${res.data.requestId ? ` — شناسه ${res.data.requestId}` : ""}`);
  }

  return (
    <Card title="پیام صوتی" hint="فایل روی سرور فروشگاه ذخیره نمی‌شود و مستقیم به پنل می‌رود">
      <label className="block">
        <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">
          فایل صوتی (mp3، wav یا ogg — حداکثر ۵ مگابایت)
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
          className="w-full mt-1.5 text-[11px] font-bold text-gray-500 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:text-xs file:font-black file:text-gray-700 dark:file:text-gray-200"
        />
      </label>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={upload} disabled={busy}>
          {busy ? "..." : "آپلود"}
        </Button>
      </div>

      {uploaded && (
        <>
          <p className="text-[11px] font-bold text-emerald-600">
            فایل آماده: {uploaded.title ?? `#${uploaded.id}`}
          </p>

          <Select
            label="خط ارسال (اختیاری)"
            value={line}
            onChange={setLine}
            options={[
              { value: "", label: "پیش‌فرض حساب" },
              ...(lines.data?.lines.map((l) => ({ value: l.number, label: l.number })) ?? []),
            ]}
          />

          <TextArea
            label="گیرندگان"
            hint="هر شماره در یک خط"
            value={recipients}
            onChange={setRecipients}
            rows={4}
          />

          <div className="flex justify-end">
            <Button onClick={send} disabled={busy || !recipients.trim()}>
              {busy ? "در حال ارسال..." : "ارسال پیام صوتی"}
            </Button>
          </div>
        </>
      )}

      {notice && <Notice text={notice} ok />}
      <ErrorBox err={err} />
    </Card>
  );
}

// ── ارسال موقعیت‌محور ───────────────────────────────────────────────

const DISPATCH = [
  { value: "حضور", label: "حضور در محدوده" },
  { value: "ورود", label: "هنگام ورود" },
  { value: "خروج", label: "هنگام خروج" },
];

const GENDERS = [
  { value: "همه", label: "همه" },
  { value: "آقا", label: "آقایان" },
  { value: "خانم", label: "خانم‌ها" },
];

const DEVICES = [
  { value: "همه", label: "همه" },
  { value: "Android", label: "اندروید" },
  { value: "IOS", label: "iOS" },
];

function LbsTab() {
  const list = useApi<Paged<LbsRequest>>("/api/admin/sms/lbs?limit=20");
  const provinces = useApi<{ provinces: Province[] }>("/api/admin/sms/geo");

  const [text, setText] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("1000");
  const [count, setCount] = useState("1000");
  const [dispatch, setDispatch] = useState("حضور");
  const [gender, setGender] = useState("همه");
  const [device, setDevice] = useState("همه");
  const [err, setErr] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    const now = Math.floor(Date.now() / 1000);

    const res = await apiSend<{ id: number | null }>("/api/admin/sms/lbs", "POST", {
      text,
      startTime: now,
      // پیش‌فرض یک روزه — پنل بازه‌ی زمانی می‌خواهد
      endTime: now + 86_400,
      receiverCount: Number(count),
      latitude: Number(lat),
      longitude: Number(lng),
      radius: Number(radius),
      address,
      dispatchMoment: dispatch,
      receiverGender: gender,
      device,
    });

    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setNotice(`درخواست ثبت شد${res.data.id ? ` — شناسه ${res.data.id}` : ""}`);
    list.reload();
  }

  async function cancel(id: number) {
    const res = await apiSend(`/api/admin/sms/lbs/${id}`, "PATCH");
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    list.reload();
  }

  return (
    <>
      <Card
        title="درخواست جدید"
        hint="ارسال به افرادی که در یک محدوده‌ی جغرافیایی حضور دارند. مختصات را از نقشه بردارید."
      >
        <TextArea label="متن پیامک" value={text} onChange={setText} rows={3} />

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="عرض جغرافیایی (Latitude)" dir="ltr" value={lat} onChange={setLat} placeholder="35.6892" />
          <Field label="طول جغرافیایی (Longitude)" dir="ltr" value={lng} onChange={setLng} placeholder="51.3890" />
          <Field label="شعاع (متر)" type="number" dir="ltr" value={radius} onChange={setRadius} />
          <Field label="تعداد گیرنده" type="number" dir="ltr" value={count} onChange={setCount} />
        </div>

        <Field label="نشانی (اختیاری)" value={address} onChange={setAddress} />

        <div className="grid sm:grid-cols-3 gap-4">
          <Select label="زمان ارسال" value={dispatch} onChange={setDispatch} options={DISPATCH} />
          <Select label="جنسیت" value={gender} onChange={setGender} options={GENDERS} />
          <Select label="دستگاه" value={device} onChange={setDevice} options={DEVICES} />
        </div>

        {provinces.data?.provinces?.length ? (
          <p className="text-[10px] font-bold text-gray-400">
            {fa(provinces.data.provinces.length)} استان روی این حساب در دسترس است
          </p>
        ) : null}

        {notice && <Notice text={notice} ok />}
        <ErrorBox err={err} />

        <div className="flex justify-end">
          <Button onClick={create} disabled={busy || !text.trim() || !lat || !lng}>
            {busy ? "در حال ثبت..." : "ثبت درخواست"}
          </Button>
        </div>
      </Card>

      <Card title="درخواست‌های ثبت‌شده">
        {list.loading ? (
          <Skeleton rows={2} />
        ) : list.err ? (
          <ErrorBox err={list.err} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <Empty text="درخواستی ثبت نشده است" />
        ) : (
          <Table head={["شناسه", "وضعیت", "نشانی", "گیرنده", "زمان", ""]}>
            {list.data.items.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5 text-[11px] font-black text-gray-700 dark:text-gray-200 tabular-nums">
                  {r.id}
                </td>
                <td className="py-2.5">
                  <Badge text={statusLabel(r.status)} tone={statusTone(r.status)} />
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500">{r.address ?? "—"}</td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                  {fa(r.receiverCount)}
                </td>
                <td className="py-2.5 text-[10px] font-bold text-gray-400 whitespace-nowrap">
                  {faDate(r.createdAt)}
                </td>
                <td className="py-2.5 text-left">
                  <button
                    onClick={() => cancel(r.id)}
                    className="text-[10px] font-black text-red-500 hover:underline"
                  >
                    لغو
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
