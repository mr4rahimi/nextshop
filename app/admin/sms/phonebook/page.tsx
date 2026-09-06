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
  Table,
  Pager,
  PageHeader,
  fa,
  useApi,
  apiSend,
  type ApiError,
} from "@/components/admin/sms/ui";
import type {
  Phonebook,
  PhonebookAttribute,
  Contact,
  AttributeType,
  Paged,
} from "@/lib/club/sms/panel-types";

const ATTR_TYPES: { value: AttributeType; label: string }[] = [
  { value: "string", label: "متن" },
  { value: "number", label: "عدد" },
  { value: "date", label: "تاریخ" },
];

export default function PhonebookPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<"contacts" | "attributes">("contacts");

  const books = useApi<Paged<Phonebook>>("/api/admin/sms/phonebooks?limit=100");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="دفترچه تلفن"
        hint="دفترچه‌های خود پنل ایران‌پیامک. اعضای باشگاه مشتریان جدا هستند و در «باشگاه مشتریان ← اعضا» مدیریت می‌شوند."
      />

      <NewBookForm onCreated={books.reload} />

      <Card title="دفترچه‌ها">
        {books.loading ? (
          <Skeleton rows={3} />
        ) : books.err ? (
          <ErrorBox err={books.err} onRetry={books.reload} />
        ) : !books.data?.items.length ? (
          <Empty text="هنوز دفترچه‌ای ساخته نشده است" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {books.data.items.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelected(b.id === selected ? null : b.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border ${
                  selected === b.id
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-400"
                }`}
              >
                {b.title}
                {b.contactCount !== undefined && (
                  <span className="opacity-60"> ({fa(b.contactCount)})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button variant={tab === "contacts" ? "primary" : "ghost"} onClick={() => setTab("contacts")}>
          مخاطبان
        </Button>
        <Button
          variant={tab === "attributes" ? "primary" : "ghost"}
          onClick={() => setTab("attributes")}
        >
          ویژگی‌های سفارشی
        </Button>
      </div>

      {tab === "contacts" ? <Contacts bookId={selected} /> : <Attributes />}
    </div>
  );
}

function NewBookForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setErr(null);
    const res = await apiSend("/api/admin/sms/phonebooks", "POST", { title });
    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setTitle("");
    onCreated();
  }

  return (
    <Card title="دفترچه جدید">
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Field label="نام دفترچه" value={title} onChange={setTitle} placeholder="مثلاً مشتریان تهران" />
        </div>
        <Button onClick={create} disabled={busy || !title.trim()}>
          {busy ? "..." : "ساخت"}
        </Button>
      </div>
      <ErrorBox err={err} />
    </Card>
  );
}

function Contacts({ bookId }: { bookId: number | null }) {
  const [page, setPage] = useState(1);
  const [bulk, setBulk] = useState("");
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useApi<Paged<Contact>>(
    bookId ? `/api/admin/sms/contacts?phonebookId=${bookId}&page=${page}&limit=30` : null
  );

  if (!bookId) {
    return (
      <Card>
        <Empty text="برای دیدن یا افزودن مخاطب، اول یک دفترچه انتخاب کنید" />
      </Card>
    );
  }

  async function add() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    // هر خط: شماره یا «شماره، نام»
    const contacts = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [mobile, ...rest] = l.split(/[,،\t]/).map((s) => s.trim());
        return { mobile, ...(rest.join(" ") ? { name: rest.join(" ") } : {}) };
      });

    const res = await apiSend<{ added: number; rejected: string[] }>(
      "/api/admin/sms/contacts",
      "POST",
      { phonebookId: bookId, contacts }
    );

    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }

    const parts = [`${fa(res.data.added)} مخاطب ثبت شد`];
    if (res.data.rejected.length) {
      parts.push(`${fa(res.data.rejected.length)} شماره نامعتبر رد شد`);
    }
    setNotice({ text: parts.join(" — "), ok: true });
    setBulk("");
    list.reload();
  }

  async function remove(id: number) {
    const res = await apiSend(`/api/admin/sms/contacts/${id}`, "DELETE");
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    list.reload();
  }

  return (
    <>
      <Card title="افزودن مخاطب" hint="هر خط یک مخاطب — «شماره» یا «شماره، نام»">
        <TextArea
          label="فهرست"
          value={bulk}
          onChange={setBulk}
          rows={5}
          placeholder={"09123456789، علی رضایی\n09121112233"}
        />
        {notice && <Notice text={notice.text} ok={notice.ok} />}
        <ErrorBox err={err} />
        <div className="flex justify-end">
          <Button onClick={add} disabled={busy || !bulk.trim()}>
            {busy ? "در حال ثبت..." : "افزودن"}
          </Button>
        </div>
      </Card>

      <Card title="مخاطبان">
        {list.loading ? (
          <Skeleton rows={4} />
        ) : list.err ? (
          <ErrorBox err={list.err} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <Empty text="این دفترچه هنوز مخاطبی ندارد" />
        ) : (
          <>
            <Table head={["شماره", "نام", ""]}>
              {list.data.items.map((c) => (
                <tr key={c.id}>
                  <td
                    className="py-2.5 text-[11px] font-black text-gray-700 dark:text-gray-200 tabular-nums"
                    dir="ltr"
                  >
                    {c.mobile}
                  </td>
                  <td className="py-2.5 text-[11px] font-bold text-gray-500">{c.name || "—"}</td>
                  <td className="py-2.5 text-left">
                    <button
                      onClick={() => remove(c.id)}
                      className="text-[10px] font-black text-red-500 hover:underline"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
            <Pager
              page={list.data.page}
              lastPage={list.data.lastPage}
              total={list.data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}

function Attributes() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AttributeType>("string");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useApi<Paged<PhonebookAttribute>>("/api/admin/sms/attributes?limit=50");

  async function create() {
    setBusy(true);
    setErr(null);
    const res = await apiSend("/api/admin/sms/attributes", "POST", { title, type });
    setBusy(false);
    if (!res.ok) {
      setErr(res.err);
      return;
    }
    setTitle("");
    list.reload();
  }

  return (
    <Card
      title="ویژگی‌های سفارشی"
      hint="فیلد اضافه روی مخاطبان — مثل تاریخ تولد یا شهر. برای شخصی‌سازی متن پیامک به کار می‌آید."
    >
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <Field label="نام ویژگی" value={title} onChange={setTitle} placeholder="مثلاً شهر" />
        </div>
        <div className="w-32">
          <Select label="نوع" value={type} onChange={setType} options={ATTR_TYPES} />
        </div>
        <Button onClick={create} disabled={busy || !title.trim()}>
          {busy ? "..." : "افزودن"}
        </Button>
      </div>

      <ErrorBox err={err} />

      {list.loading ? (
        <Skeleton rows={2} />
      ) : list.err ? (
        <ErrorBox err={list.err} onRetry={list.reload} />
      ) : !list.data?.items.length ? (
        <Empty text="ویژگی سفارشی تعریف نشده است" />
      ) : (
        <Table head={["نام", "نوع"]}>
          {list.data.items.map((a) => (
            <tr key={a.id}>
              <td className="py-2.5 text-[11px] font-black text-gray-700 dark:text-gray-200">
                {a.title}
              </td>
              <td className="py-2.5 text-[11px] font-bold text-gray-500">
                {ATTR_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
