/**
 * یک نوبت گفتگو با دستیار — docs/plans/admin-assistant.md (از برتر CRM، docs/88)
 *
 * سهمیه ← گفتگو ← حلقه‌ی «مدل ↔ ابزار» (حداکثر MAX_TOOL_ROUNDS، دور آخر بی‌ابزار) ← ذخیره.
 *
 * ⚠️ نوبت مستقل از اتصال مرورگر اجرا و ذخیره می‌شود: `emit` بعد از قطع اتصال بی‌صدا رد
 * می‌شود ولی حلقه ادامه می‌دهد. اگر CDN جریان را بافر کند یا وسطش ببُرد، کلاینت پاسخ
 * ذخیره‌شده را از `GET conversations/:id` می‌خواند (بخش ۹ سند).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { StaffAccess } from "@/lib/permissions";
import { getAiSettings, GAPGPT_BASE_URL } from "@/lib/ai/settings";
import { HISTORY_MESSAGES, MAX_TOOL_ROUNDS, REQUEST_TIMEOUT_MS, TOOL_RESULT_MAX_CHARS, estimateAssistantCost } from "./constants";
import { ALL_TOOLS, toolsFor, type AssistantTool, type ToolContext } from "./tools";
import { buildSystemPrompt } from "./prompt";
import { AiRequestError, isDroppedConnection, streamChatCompletion, type ChatMessage } from "./ai-stream";
import {
  assistantQuota, createConversation, createMessage, findOwnConversation,
  getAssistantSetting, recentMessages, touchConversation,
} from "./store";

export type AssistantEvent =
  | { type: "meta"; conversationId: string; remaining: number }
  | { type: "tool"; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; remaining: number }
  | { type: "error"; message: string };

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}\n…(بقیه کوتاه شد)` : text;
}

/** BigInt در JSON.stringify خطا می‌دهد */
const jsonSafe = (_k: string, v: unknown) => (typeof v === "bigint" ? Number(v) : v);

async function runTool(
  tool: AssistantTool | undefined,
  rawArgs: string,
  ctx: ToolContext,
): Promise<{ ok: boolean; output: string; args: unknown }> {
  // دوباره چک: مدلی که نام ابزار ناموجود یا نامجاز بسازد هیچ داده‌ای نمی‌گیرد
  if (!tool || !tool.available(ctx.access)) {
    return { ok: false, output: JSON.stringify({ error: "این ابزار برای شما وجود ندارد" }), args: rawArgs };
  }
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs.trim() ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, output: JSON.stringify({ error: "ورودی ابزار JSON معتبر نبود" }), args: rawArgs };
  }
  try {
    const result = await tool.run(args, ctx);
    return { ok: true, output: truncate(JSON.stringify(result, jsonSafe), TOOL_RESULT_MAX_CHARS), args };
  } catch (error) {
    console.error(`[assistant] خطای ابزار ${tool.name}`, error);
    return { ok: false, output: JSON.stringify({ error: "خواندن این داده ناموفق بود" }), args };
  }
}

export async function runAssistantTurn(
  input: { access: StaffAccess; message: string; conversationId?: string; pagePath?: string },
  emit: (event: AssistantEvent) => void,
): Promise<void> {
  const { access, message, pagePath } = input;
  const started = Date.now();

  const [setting, quota, ai, store] = await Promise.all([
    getAssistantSetting(),
    assistantQuota(access.userId),
    getAiSettings(),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true } }),
  ]);
  if (!setting.enabled) return emit({ type: "error", message: "راهنمای هوشمند در این فروشگاه خاموش است" });
  if (quota.limit <= 0) return emit({ type: "error", message: "راهنمای هوشمند برای حساب شما فعال نیست" });
  if (quota.remaining <= 0) {
    return emit({
      type: "error",
      message: `سقف ${quota.limit.toLocaleString("fa-IR")} پرسش امروز شما پر شده است؛ فردا دوباره می‌توانید بپرسید. برای سقف بیشتر به مدیر بگویید.`,
    });
  }
  if (!ai.apiKey) return emit({ type: "error", message: "کلید هوش مصنوعی ثبت نشده است (تنظیمات هوش مصنوعی)" });

  const conversation =
    (input.conversationId && (await findOwnConversation(access.userId, input.conversationId))) ||
    (await createConversation(access.userId, access.name, message.replace(/\s+/g, " ").slice(0, 80)));

  const history = await recentMessages(conversation.id, HISTORY_MESSAGES);
  await createMessage({ conversationId: conversation.id, userId: access.userId, role: "USER", content: message, pagePath });
  emit({ type: "meta", conversationId: conversation.id, remaining: quota.remaining });

  const tools = toolsFor(access);
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        access,
        storeName: store?.storeName?.trim() || null,
        pagePath,
        extraGuide: setting.extraGuide,
        toolNames: tools.map((t) => t.name),
        missingTopics: ALL_TOOLS.filter((t) => !t.available(access)).map((t) => t.topic),
        quota: { limit: quota.limit, remainingAfter: Math.max(0, quota.remaining - 1) },
      }),
    },
    ...history.map((row) => ({ role: row.role === "USER" ? ("user" as const) : ("assistant" as const), content: row.content })),
    { role: "user", content: message },
  ];
  const specs = tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const audit: { name: string; args: unknown; ok: boolean }[] = [];
  let answer = "";
  let promptTokens = 0;
  let completionTokens = 0;

  const save = (data: { content: string; error?: string }) =>
    createMessage({
      conversationId: conversation.id,
      userId: access.userId,
      role: "ASSISTANT",
      content: data.content,
      error: data.error ?? null,
      toolCalls: audit.length ? (audit as Prisma.InputJsonValue) : undefined,
      model: setting.model,
      promptTokens,
      completionTokens,
      costUsd: estimateAssistantCost(setting.model, promptTokens, completionTokens),
      durationMs: Date.now() - started,
      pagePath,
    });

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // دور آخر بدون ابزار — مدل باید با همان که دارد جواب بدهد
      const lastRound = round === MAX_TOOL_ROUNDS;
      let streamed = false;
      const request = () =>
        streamChatCompletion({
          baseUrl: GAPGPT_BASE_URL,
          apiKey: ai.apiKey,
          model: setting.model,
          messages,
          tools: lastRound ? [] : specs,
          maxTokens: setting.maxTokens,
          signal: controller.signal,
          onDelta: (text) => {
            streamed = true;
            emit({ type: "delta", text });
          },
        });
      const result = await request().catch((error: unknown) => {
        // درگاه گاهی اتصال را وسط جریان می‌بُرد (`TypeError: terminated`، در فاز ۰ هم دیده شد) —
        // اگر هنوز چیزی به کاربر نرسیده یک بار دوباره؛ وگرنه تکرار، متن را دوبار نشان می‌دهد
        if (!isDroppedConnection(error) || streamed) throw error;
        console.warn("[assistant] قطع اتصال سرویس، تلاش دوباره", round);
        return request();
      });
      promptTokens += result.promptTokens;
      completionTokens += result.completionTokens;
      answer += result.content;

      if (result.toolCalls.length === 0 || lastRound) {
        if (result.finishReason === "length" && !answer.trim()) {
          throw new AiRequestError("مدل پیش از نوشتن پاسخ به سقف توکن رسید؛ سقف توکن را در تنظیمات بیشتر کنید");
        }
        break;
      }

      messages.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });
      for (const label of new Set(result.toolCalls.map((c) => toolByName.get(c.function.name)?.label ?? "خواندن داده"))) {
        emit({ type: "tool", label });
      }
      const outputs = await Promise.all(
        result.toolCalls.map((call) => runTool(toolByName.get(call.function.name), call.function.arguments, { access, pagePath })),
      );
      result.toolCalls.forEach((call, i) => {
        const output = outputs[i];
        audit.push({ name: call.function.name, args: output.args, ok: output.ok });
        messages.push({ role: "tool", tool_call_id: call.id, content: output.output });
      });
    }

    answer = answer.trim();
    if (!answer) throw new AiRequestError("مدل پاسخ خالی برگرداند؛ دوباره بپرسید");

    const saved = await save({ content: answer });
    await touchConversation(conversation.id);
    emit({ type: "done", messageId: saved.id, remaining: Math.max(0, quota.remaining - 1) });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    const text = aborted
      ? "پاسخ بیش از حد طول کشید؛ دوباره بپرسید یا مدل سریع‌تری انتخاب شود"
      : error instanceof AiRequestError
        ? error.message
        : isDroppedConnection(error)
          ? "سرویس هوش مصنوعی اتصال را وسط پاسخ قطع کرد؛ دوباره بپرسید"
          : "اتصال به سرویس هوش مصنوعی برقرار نشد";
    if (!(error instanceof AiRequestError) && !aborted) console.error("[assistant] خطای نوبت گفتگو", error);
    await save({ content: answer.trim(), error: text }).catch(() => undefined);
    emit({ type: "error", message: text });
  } finally {
    clearTimeout(timer);
  }
}
