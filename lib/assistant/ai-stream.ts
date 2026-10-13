/**
 * یک دور Chat Completions جریانی با function calling — docs/plans/admin-assistant.md
 * (از برتر CRM، docs/88)
 *
 * جریانی است چون درگاه GapGPT اتصال بی‌داده‌ی طولانی را می‌بندد و کاربر هم پاسخ را
 * کلمه‌به‌کلمه می‌بیند. `tool_calls` در جریان تکه‌تکه می‌آید و با `index` سرهم می‌شود.
 */

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCallPayload[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCallPayload = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type StreamResult = {
  content: string;
  toolCalls: ToolCallPayload[];
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
};

/** خطایی که متنش برای کاربر قابل‌نمایش است */
export class AiRequestError extends Error {}

type StreamChunk = {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export async function streamChatCompletion(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  maxTokens: number;
  signal: AbortSignal;
  onDelta: (text: string) => void;
}): Promise<StreamResult> {
  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.apiKey}` },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      ...(params.tools.length > 0 && { tools: params.tools }),
      max_tokens: params.maxTokens,
      temperature: 0.3,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    console.error("[assistant] پاسخ ناموفق سرویس", response.status, detail.slice(0, 300));
    if (response.status === 401 || response.status === 403) {
      throw new AiRequestError("کلید هوش مصنوعی پذیرفته نشد؛ در تنظیمات هوش مصنوعی بررسی کنید");
    }
    if (response.status === 402 || /credit|balance|quota/i.test(detail)) {
      throw new AiRequestError("اعتبار حساب هوش مصنوعی تمام شده است");
    }
    throw new AiRequestError(`سرویس هوش مصنوعی پاسخ ${response.status} داد`);
  }

  const result: StreamResult = { content: "", toolCalls: [], finishReason: null, promptTokens: 0, completionTokens: 0 };
  const calls = new Map<number, ToolCallPayload>();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const data = line.trim();
      if (!data.startsWith("data:")) continue;
      const payload = data.slice(5).trim();
      if (payload === "[DONE]") continue;

      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload) as StreamChunk;
      } catch {
        continue; // تکه‌ی ناقص یا نظر SSE
      }

      const choice = chunk.choices?.[0];
      const text = choice?.delta?.content;
      if (text) {
        result.content += text;
        params.onDelta(text);
      }
      for (const part of choice?.delta?.tool_calls ?? []) {
        const index = part.index ?? 0;
        const call = calls.get(index) ?? { id: "", type: "function" as const, function: { name: "", arguments: "" } };
        if (part.id) call.id = part.id;
        if (part.function?.name) call.function.name += part.function.name;
        if (part.function?.arguments) call.function.arguments += part.function.arguments;
        calls.set(index, call);
      }
      if (choice?.finish_reason) result.finishReason = choice.finish_reason;
      if (chunk.usage) {
        result.promptTokens = chunk.usage.prompt_tokens ?? result.promptTokens;
        result.completionTokens = chunk.usage.completion_tokens ?? result.completionTokens;
      }
    }
  }

  result.toolCalls = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, call]) => ({ ...call, id: call.id || `call_${index}` }))
    .filter((call) => call.function.name);
  return result;
}

/** قطع اتصال از سمت درگاه (undici: `terminated`، `fetch failed`، ریست سوکت) — نه خطای HTTP و نه مهلت خودمان */
export function isDroppedConnection(error: unknown): boolean {
  if (!(error instanceof Error) || error.name === "AbortError" || error instanceof AiRequestError) return false;
  return /terminated|fetch failed|ECONNRESET|socket|other side closed/i.test(`${error.message} ${String(error.cause ?? "")}`);
}
