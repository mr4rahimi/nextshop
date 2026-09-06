"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * مدیریت ربات بله
 *
 * ⚠️ توکن هرگز از سرور برنمی‌گردد — فقط «ثبت شده / نشده». فیلد ورودی خالی
 *    یعنی «دست نزن»، نه «پاک کن»؛ پاک کردن دکمه‌ی جدا دارد.
 */

interface Status {
  hasToken: boolean;
  username: string | null;
  businessApi: boolean;
  hasSafirKey: boolean;
  safirEnabled: boolean;
  webhookUrl: string | null;
  startLink: string | null;
  bot: { id: number; first_name: string; username?: string } | null;
  botError: string | null;
  webhook: { url?: string } | null;
  members: number;
  active: number;
  channelPriority: string[];
}

function toFa(n: number) {
  return Number(n).toLocaleString("fa-IR");
}

export default function BaleAdminClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [businessApi, setBusinessApi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [safirKey, setSafirKey] = useState("");
  const [safirEnabled, setSafirEnabled] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testChat, setTestChat] = useState("");
  const [testText, setTestText] = useState("پیام آزمایشی از باشگاه مشتریان");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/club/bale");
    if (!res.ok) return;
    const d: Status = await res.json();
    setStatus(d);
    setUsername(d.username ?? "");
    setBusinessApi(d.businessApi);
    setSafirEnabled(d.safirEnabled);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/club/bale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();

      if (!res.ok) {
        setMessage({ text: d.error ?? "خطایی رخ داد", ok: false });
      } else {
        setMessage({ text: successText(action, d), ok: true });
        if (action === "save") {
          setToken("");
          setSafirKey("");
        }
        await load();
      }
    } catch {
      setMessage({ text: "ارتباط با سرور برقرار نشد", ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return <p className="text-xs font-bold text-gray-400">در حال بارگذاری…</p>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="space-y-3">
        <div>
          <h1 className="text-lg font-black text-gray-900 dark:text-white">ربات بله</h1>
          <p className="text-xs font-bold text-gray-400 mt-1 leading-relaxed">
            کانال ارسال رایگان به اعضای باشگاه. عضو با <code>/start</code> و فرستادن
            شماره‌ی موبایل، به پروفایل باشگاه وصل می‌شود.
          </p>
        </div>

        <Help title="راه‌اندازی از صفر — پنج قدم">
          <Step n={1}>
            در بله، <span dir="ltr" className="font-mono">@BotFather</span> را باز
            کنید و با <span dir="ltr" className="font-mono">/newbot</span> یک ربات
            بسازید. نام و نام کاربری می‌خواهد.
          </Step>
          <Step n={2}>
            توکنی که می‌دهد را در کادر «توکن ربات» پایین وارد کنید و
            <b> ذخیره</b> بزنید، بعد <b>تست اتصال</b>.
          </Step>
          <Step n={3}>
            <b>ثبت وب‌هوک</b> را بزنید. بدون این، ربات پیام‌های مشتریان را
            دریافت نمی‌کند و کسی نمی‌تواند عضو شود.
          </Step>
          <Step n={4}>
            در تنظیمات باشگاه، <b>بله را بالای پیامک</b> ببرید تا اعضای ربات
            پیام رایگان بگیرند.
          </Step>
          <Step n={5}>
            در قالب‌های پیامک، برای هر قالب <b>متن بله</b> را بنویسید. قالبی که
            متن بله ندارد روی بله ارسال نمی‌شود.
          </Step>
          <p className="text-[10px] font-bold text-gray-400 leading-relaxed pt-1">
            بعد از این، لینک عضویت را در سایت، فاکتور و شبکه‌های اجتماعی
            بگذارید تا مشتری‌ها عضو شوند.
          </p>
        </Help>
      </header>

      {message && (
        <div
          className={`rounded-2xl p-4 text-xs font-black ${
            message.ok
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* وضعیت */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="اتصال" value={status.bot ? "برقرار" : status.hasToken ? "ناموفق" : "بدون توکن"} tone={status.bot ? "ok" : "warn"} />
        <Stat label="نام ربات" value={status.bot?.username ? `@${status.bot.username}` : "—"} />
        <Stat label="اعضای ربات" value={toFa(status.members)} />
        <Stat label="فعال" value={toFa(status.active)} tone={status.active > 0 ? "ok" : undefined} />
      </div>

      {status.botError && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-xs font-black text-red-600 dark:text-red-400">{status.botError}</p>
        </div>
      )}

      {/* تنظیمات */}
      <Card title="تنظیمات ربات">
        <Field
          label="توکن ربات"
          hint={
            status.hasToken
              ? "توکن ثبت شده است. برای تغییر، توکن تازه را وارد کنید؛ خالی گذاشتن یعنی دست‌نخورده بماند."
              : "توکن را از @BotFather در بله بگیرید."
          }
          value={token}
          onChange={setToken}
          placeholder={status.hasToken ? "••••••••••" : "123456789:AA..."}
          dir="ltr"
        />

        <Field
          label="نام کاربری ربات"
          hint="بدون @ — برای ساخت لینک عضویت و QR"
          value={username}
          onChange={setUsername}
          placeholder="myshopbot"
          dir="ltr"
        />

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={businessApi}
            onChange={(e) => setBusinessApi(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary-600"
          />
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
            استفاده از API کسب‌وکاری بله
            <span className="block text-[10px] font-medium text-gray-400 mt-0.5">
              سهمیه‌ی ارسال بالاتر برای پیام انبوه، ولی هزینه‌ی هر پیام از اعتبار
              حساب کسب‌وکاری کم می‌شود. باید از پنل کسب‌وکار بله شارژ شده باشد.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => act("save", { token, username, businessApi })} busy={busy === "save"}>
            ذخیره
          </Button>
          <Button
            variant="ghost"
            onClick={() => act("test")}
            busy={busy === "test"}
            disabled={!status.hasToken}
          >
            تست اتصال
          </Button>
          {status.hasToken && (
            <Button
              variant="ghost"
              onClick={() => act("save", { token: "" })}
              busy={busy === "clear"}
            >
              پاک کردن توکن
            </Button>
          )}
        </div>
      </Card>

      {/* وب‌هوک */}
      <Card title="وب‌هوک">
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
          بله پیام‌های کاربران را به این آدرس می‌فرستد. بله فقط HTTPS و پورت ۴۴۳
          یا ۸۸ را می‌پذیرد، پس روی محیط لوکال کار نمی‌کند — آنجا از «دریافت
          دستی» استفاده کنید.
        </p>

        {status.webhookUrl && (
          <p className="text-[10px] font-bold text-gray-500 break-all bg-gray-50 dark:bg-white/5 rounded-xl p-3" dir="ltr">
            {status.webhookUrl}
          </p>
        )}

        {status.webhook?.url && (
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
            ثبت‌شده در بله: {status.webhook.url}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => act("set-webhook")} busy={busy === "set-webhook"} disabled={!status.hasToken}>
            ثبت وب‌هوک
          </Button>
          <Button variant="ghost" onClick={() => act("delete-webhook")} busy={busy === "delete-webhook"} disabled={!status.hasToken}>
            حذف وب‌هوک
          </Button>
          <Button variant="ghost" onClick={() => act("poll")} busy={busy === "poll"} disabled={!status.hasToken}>
            دریافت دستی پیام‌ها
          </Button>
        </div>
      </Card>

      {/* لینک عضویت */}
      {status.startLink && (
        <Card title="لینک عضویت">
          <p className="text-[10px] font-bold text-gray-500 break-all" dir="ltr">
            {status.startLink}
          </p>
          <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
            این لینک را در سایت، فاکتور یا کنار QR بگذارید.
          </p>
        </Card>
      )}

      {/* سفیر */}
      <Card title="ارسال با شماره تلفن (سفیر)">
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
          با سفیر می‌توانید به هر کسی که <b>حساب بله دارد</b> پیام بدهید، حتی
          اگر هرگز وارد ربات نشده باشد. اعضایی که وارد ربات شده‌اند همچنان
          رایگان پیام می‌گیرند و سفیر فقط برای بقیه به کار می‌رود.
        </p>

        <Help title="چطور کلید سفیر را بگیرم؟">
          <Step n={1}>
            در اپلیکیشن بله، بخش <b>«ارسال پیام انبوه»</b> را باز کنید و
            <b> پنل کسب‌وکار</b> خود را فعال کنید.
          </Step>
          <Step n={2}>
            در پنل کسب‌وکار یک <b>«سفیر»</b> بسازید. پس از ساخت،
            <span dir="ltr" className="mx-1 font-mono">api-access-key</span>
            سازمان به شما داده می‌شود — همان چیزی که باید در کادر بالا وارد کنید.
          </Step>
          <Step n={3}>
            حساب کسب‌وکاری را <b>شارژ</b> کنید. هزینه‌ی هر پیام خودکار از اعتبار
            کم می‌شود.
          </Step>
          <Step n={4}>
            برای پیام‌های <b>تبلیغاتی</b>، قالب پیام باید اول در پنل کسب‌وکار بله
            ساخته شود و <b>تیم پشتیبانی بله آن را تأیید کند</b> — درست مثل پترن
            پیامکی. پیام‌های خدماتی این محدودیت را ندارند.
          </Step>

          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-relaxed pt-1">
            توکن ربات و کلید سفیر دو چیز جدا هستند. توکن را BotFather می‌دهد،
            کلید سفیر را پنل کسب‌وکار.
          </p>
        </Help>

        <Field
          label="کلید سفیر (api-access-key)"
          hint={safirKeyHint(status.hasSafirKey)}
          value={safirKey}
          onChange={setSafirKey}
          placeholder={status.hasSafirKey ? "••••••••••" : "از پنل کسب‌وکار بله"}
          dir="ltr"
        />

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={safirEnabled}
            onChange={(e) => setSafirEnabled(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary-600"
          />
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
            ارسال به اعضای غیرعضو ربات فعال باشد
            <span className="block text-[10px] font-medium text-gray-400 mt-0.5">
              با روشن بودن این کلید، «قابل دسترس در بله» یعنی هر عضوی که شماره
              دارد — نه فقط کسانی که /start زده‌اند.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => act("save", { safirKey, safirEnabled })}
            busy={busy === "save"}
          >
            ذخیره
          </Button>
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <Field label="تست: شماره موبایل" value={testPhone} onChange={setTestPhone} placeholder="09123456789" dir="ltr" />
          <Button
            variant="ghost"
            onClick={() => act("send-test-phone", { phone: testPhone, text: testText })}
            busy={busy === "send-test-phone"}
            disabled={!status.hasSafirKey || !testPhone.trim()}
          >
            ارسال آزمایشی با شماره
          </Button>
        </div>
      </Card>

      {/* تست ارسال */}
      <Card title="ارسال آزمایشی">
        <Field label="شناسه چت" value={testChat} onChange={setTestChat} placeholder="123456789" dir="ltr" />
        <Field label="متن" value={testText} onChange={setTestText} />
        <Button
          onClick={() => act("send-test", { chatId: testChat, text: testText })}
          busy={busy === "send-test"}
          disabled={!status.hasToken || !testChat.trim()}
        >
          ارسال
        </Button>
      </Card>

      {/* اولویت کانال */}
      <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4">
        <p className="text-[11px] font-black text-gray-700 dark:text-gray-300">
          ترتیب فعلی کانال‌ها: {status.channelPriority.join(" ← ")}
        </p>
        <p className="text-[10px] font-bold text-gray-400 mt-1.5 leading-relaxed">
          هر عضو فقط از <b>اولین</b> کانال در دسترسش پیام می‌گیرد. برای اینکه بله
          پیش از پیامک امتحان شود، آن را در تنظیمات باشگاه بالاتر ببرید — پیامک
          همیشه پناهگاه نهایی است.
        </p>
      </div>
    </div>
  );
}

function Help({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4 group">
      <summary className="text-[11px] font-black text-gray-700 dark:text-gray-300 cursor-pointer list-none flex items-center justify-between">
        {title}
        <span className="text-[10px] font-bold text-gray-400 group-open:hidden">نمایش</span>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[9px] font-black ml-1.5">
        {n.toLocaleString("fa-IR")}
      </span>
      {children}
    </p>
  );
}

function safirKeyHint(has: boolean): string {
  return has
    ? "کلید ثبت شده است. خالی گذاشتن یعنی دست‌نخورده بماند."
    : "پس از ساخت «سفیر» در پنل کسب‌وکار بله در اختیارتان قرار می‌گیرد.";
}

function successText(action: string, d: Record<string, unknown>): string {
  switch (action) {
    case "test":
      return `اتصال برقرار است — ${(d.bot as { first_name?: string })?.first_name ?? ""}`;
    case "set-webhook":
      return "وب‌هوک ثبت شد";
    case "delete-webhook":
      return "وب‌هوک حذف شد";
    case "poll":
      return `${Number(d.processed ?? 0).toLocaleString("fa-IR")} پیام پردازش شد`;
    case "send-test":
    case "send-test-phone":
      return "پیام ارسال شد";
    default:
      return "ذخیره شد";
  }
}

// ─── اجزای کوچک ────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h2 className="text-xs font-black text-gray-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-[10px] font-bold text-gray-400">{label}</p>
      <p
        className={`text-sm font-black mt-1 ${
          tone === "ok"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label, hint, value, onChange, placeholder, dir,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black text-gray-500 mb-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[11px] font-bold text-gray-900 dark:text-white outline-none focus:border-primary-500 transition-colors"
      />
      {hint && <span className="block text-[10px] font-bold text-gray-400 mt-1.5 leading-relaxed">{hint}</span>}
    </label>
  );
}

function Button({
  children, onClick, busy, disabled, variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`px-4 py-2 rounded-xl text-[11px] font-black disabled:opacity-30 transition-opacity ${
        variant === "ghost"
          ? "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300"
          : "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
      }`}
    >
      {busy ? "..." : children}
    </button>
  );
}
