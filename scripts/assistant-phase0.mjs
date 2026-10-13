/**
 * فاز ۰ راهنمای هوشمند پنل — آزمون function calling جریانی روی مدل‌های GapGPT.
 * docs/plans/admin-assistant.md بخش ۱۰
 *
 * برای هر مدل چهار سؤال فارسی با دو ابزار ساختگی:
 *   ۱. یک ابزار بی‌ورودی  ۲. ابزار با ورودی enum  ۳. دو ابزار موازی  ۴. بی‌ابزار
 * زمان اولین تکه، درستی tool_calls سرهم‌شده و پاسخ دور دوم (بعد از نتیجه‌ی ابزار) ثبت می‌شود.
 *
 * اجرا: node scripts/assistant-phase0.mjs [model ...]
 * کلید: GAPGPT_API_KEY از .env یا .env.local
 */
import { config } from "dotenv";
import OpenAI from "openai";

config({ path: ".env.local" });
config({ path: ".env" });

const apiKey = process.env.GAPGPT_API_KEY?.trim();
if (!apiKey) {
  console.error("GAPGPT_API_KEY تنظیم نشده");
  process.exit(1);
}
const client = new OpenAI({ apiKey, baseURL: "https://api.gapgpt.app/v1", timeout: 120_000 });

const MODELS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["gpt-4.1-mini", "gpt-4o-mini", "gemini-2.5-flash", "gpt-4.1", "claude-sonnet-4-6"];

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_my_tasks",
      description: "کارهای باز کارتابل کاربر جاری با مهلت. ورودی ندارد؛ کاربر از سشن معلوم است.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "report_sales",
      description: "فروش فروشگاه در یک بازه، همراه مقایسه با دوره‌ی هم‌طول قبل.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "yesterday", "this_week", "this_month", "last_month"],
            description: "بازه‌ی گزارش",
          },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
];

const FAKE_RESULTS = {
  get_my_tasks: { tasks: [{ code: 12, title: "نوشتن متای دسته‌ی پرینتر", dueAt: "1405/07/22" }] },
  report_sales: {
    period: "this_month",
    revenue: 412_000_000,
    orders: 87,
    previous: { revenue: 365_000_000, orders: 79 },
    deltas: { revenue: "+12.9%", orders: "+10.1%" },
  },
};

const SYSTEM = "تو دستیار پنل مدیریت یک فروشگاه اینترنتی هستی. فارسی و کوتاه جواب بده. برای داده فقط از ابزارها استفاده کن و عدد نساز.";

const CASES = [
  { q: "امروز چه کارهایی دارم؟", expect: ["get_my_tasks"] },
  { q: "فروش این ماه چطور بوده نسبت به قبل؟", expect: ["report_sales"], args: { report_sales: { period: "this_month" } } },
  { q: "هم کارهای من را بگو هم فروش امروز را.", expect: ["get_my_tasks", "report_sales"], args: { report_sales: { period: "today" } } },
  { q: "سلام، تو کی هستی؟", expect: [] },
];

/** یک دور جریانی؛ tool_calls را با index سرهم می‌کند (مثل برتر ai-stream.ts) */
async function streamRound(model, messages, withTools) {
  const t0 = Date.now();
  let first = null;
  let text = "";
  const calls = [];
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    ...(withTools ? { tools: TOOLS } : {}),
    max_tokens: 600,
  });
  for await (const chunk of stream) {
    const d = chunk.choices?.[0]?.delta;
    if (!d) continue;
    if (first === null && (d.content || d.tool_calls)) first = Date.now() - t0;
    if (d.content) text += d.content;
    for (const tc of d.tool_calls ?? []) {
      const i = tc.index ?? calls.length;
      calls[i] ??= { id: "", name: "", args: "" };
      if (tc.id) calls[i].id = tc.id;
      if (tc.function?.name) calls[i].name += tc.function.name;
      if (tc.function?.arguments) calls[i].args += tc.function.arguments;
    }
  }
  return { first, total: Date.now() - t0, text, calls: calls.filter(Boolean) };
}

async function runCase(model, c) {
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: c.q }];
  const r1 = await streamRound(model, messages, true);
  // درست = هر ابزار خواسته‌شده صدا زده شده و ابزار ناخواسته‌ای نیامده؛ تکرار یک ابزار فقط یادداشت است
  const names = new Set(r1.calls.map((x) => x.name));
  let ok = names.size === c.expect.length && c.expect.every((n) => names.has(n));
  const notes = [];
  if (r1.calls.length > names.size) notes.push(`${r1.calls.length} فراخوانی`);
  for (const call of r1.calls) {
    let parsed;
    try {
      parsed = call.args ? JSON.parse(call.args) : {};
    } catch {
      ok = false;
      notes.push(`JSON خراب: ${call.args}`);
      continue;
    }
    const want = c.args?.[call.name];
    if (want && JSON.stringify(parsed) !== JSON.stringify(want)) notes.push(`${call.name}(${JSON.stringify(parsed)})`);
  }
  if (!r1.calls.length) return { ok, first: r1.first, total: r1.total, answer: r1.text, notes };

  messages.push({
    role: "assistant",
    content: r1.text || null,
    tool_calls: r1.calls.map((x) => ({ id: x.id, type: "function", function: { name: x.name, arguments: x.args || "{}" } })),
  });
  for (const call of r1.calls) {
    // نتیجه‌ی ساختگی بازه‌ی خواسته‌شده را برمی‌گرداند تا خطای خواندن بازه دیده شود
    let args = {};
    try { args = JSON.parse(call.args || "{}"); } catch {}
    const result = { ...(FAKE_RESULTS[call.name] ?? {}), ...(args.period ? { period: args.period } : {}) };
    messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
  }
  const r2 = await streamRound(model, messages, false);
  return {
    ok,
    first: r1.first,
    total: r1.total + r2.total,
    second: r2.first,
    answer: r2.text,
    ids: r1.calls.map((x) => x.id.slice(0, 12)).join(","),
    notes,
  };
}

for (const model of MODELS) {
  console.log(`\n══ ${model}`);
  for (const c of CASES) {
    try {
      const r = await runCase(model, c);
      console.log(
        `${r.ok ? "✓" : "✗"} «${c.q}» اولین تکه ${r.first}ms، کل ${r.total}ms` +
          (r.second != null ? `، دور دوم ${r.second}ms` : "") +
          (r.ids ? ` ids=${r.ids}` : "") +
          (r.notes.length ? ` [${r.notes.join("؛ ")}]` : ""),
      );
      console.log(`   ↳ ${r.answer.replace(/\s+/g, " ").slice(0, 220)}`);
    } catch (e) {
      console.log(`✗ «${c.q}» خطا: ${e?.status ?? ""} ${e?.message ?? e}`);
    }
  }
}
