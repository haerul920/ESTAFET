import { systemPrompt } from "./prompts";

/** Live provider calls. Plain fetch, no SDK. Keys and model names come from the environment. */

export interface LiveCall {
  system: string;
  user: string;
}

/**
 * What went wrong with a live call, so the app can tell people something useful and decide whether to retry.
 * - `busy`: the provider is overloaded or rate limited right now (HTTP 429 rate, 500, 502, 503, 504, 529). Retry later.
 * - `timeout`: no answer within the time limit.
 * - `quota`: the key's quota or billing limit is used up (HTTP 429 with a quota message). Retrying does not help today.
 * - `config`: the key is wrong or the model does not exist for this key (HTTP 400, 401, 403, 404). An admin must fix it.
 * - `blocked`: the provider refused to answer (safety filter).
 * - `failed`: anything else, including an empty or cut-off answer.
 */
export type ProviderErrorCode = "busy" | "timeout" | "quota" | "config" | "blocked" | "failed";

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
  /** Worth another attempt in a moment (possibly with the fallback model). */
  get transient(): boolean {
    return this.code === "busy" || this.code === "timeout";
  }
}

/** Per attempt. The synthesis route has 120 s in total, so two attempts must fit with room for saving the draft. */
export function timeoutMs(env: Record<string, string | undefined> = process.env): number {
  const s = Number(env.LLM_TIMEOUT_SECONDS);
  return Number.isFinite(s) && s >= 5 && s <= 110 ? s * 1000 : 45_000;
}

export function classifyStatus(provider: string, status: number, detail: string): ProviderError {
  const short = detail.replace(/\s+/g, " ").slice(0, 160);
  if (status === 429 && /quota|billing|exceeded your current/i.test(detail))
    return new ProviderError("quota", `${provider}: quota used up (429). ${short}`);
  if ([429, 500, 502, 503, 504, 529].includes(status))
    return new ProviderError("busy", `${provider}: busy or rate limited (${status}). ${short}`);
  if ([400, 401, 403, 404].includes(status))
    return new ProviderError(
      "config",
      `${provider}: request refused (${status}). Check the API key and LLM_MODEL. ${short}`,
    );
  return new ProviderError("failed", `${provider}: request failed (${status}). ${short}`);
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timer = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timer]) : timer;
}

async function send(provider: string, url: string, init: RequestInit, ms: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: withTimeout(init.signal ?? undefined, ms) });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new ProviderError("timeout", `${provider}: no answer within ${Math.round(ms / 1000)} s.`);
    throw new ProviderError("busy", `${provider}: network error (${e instanceof Error ? e.message : "unknown"}).`);
  }
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return j.error?.message ?? "";
  } catch {
    return "";
  }
}

function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : t;
}

export async function callGemini(
  model: string,
  user: string,
  signal?: AbortSignal,
  language: "id" | "en" = "en",
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ProviderError("config", "GEMINI_API_KEY is not set.");
  const res = await send(
    "Gemini",
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(language) }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 16_384 },
      }),
      signal,
    },
    timeoutMs(),
  );
  if (!res.ok) throw classifyStatus("Gemini", res.status, await errorDetail(res));
  const json = (await res.json()) as {
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason)
    throw new ProviderError("blocked", `Gemini blocked the request (${json.promptFeedback.blockReason}).`);
  const candidate = json.candidates?.[0];
  const reason = candidate?.finishReason ?? "";
  if (/SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/.test(reason))
    throw new ProviderError("blocked", `Gemini stopped the answer (${reason}).`);
  // Thinking models may return thought parts; only the answer text counts.
  const text =
    candidate?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("") ?? "";
  if (reason === "MAX_TOKENS") throw new ProviderError("failed", "Gemini's answer was cut off (MAX_TOKENS).");
  if (!text) throw new ProviderError("failed", `Gemini returned no text${reason ? ` (${reason})` : ""}.`);
  return stripFence(text);
}

export async function callAnthropic(
  model: string,
  user: string,
  signal?: AbortSignal,
  language: "id" | "en" = "en",
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ProviderError("config", "ANTHROPIC_API_KEY is not set.");
  const res = await send(
    "Anthropic",
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        temperature: 0,
        system: systemPrompt(language),
        messages: [{ role: "user", content: user }],
      }),
      signal,
    },
    timeoutMs(),
  );
  if (!res.ok) throw classifyStatus("Anthropic", res.status, await errorDetail(res));
  const json = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
  if (json.stop_reason === "refusal") throw new ProviderError("blocked", "Anthropic declined to answer.");
  if (json.stop_reason === "max_tokens")
    throw new ProviderError("failed", "Anthropic's answer was cut off (max_tokens).");
  const text =
    json.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("") ?? "";
  if (!text) throw new ProviderError("failed", "Anthropic returned no text.");
  return stripFence(text);
}
