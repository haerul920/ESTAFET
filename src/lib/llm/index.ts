import type { ExtractedDoc } from "@/lib/ingest/types";
import { mockSynthesize } from "./mock";
import { chunkDocuments, estimateTokens, renderDocuments, userPrompt } from "./prompts";
import { callAnthropic, callGemini, ProviderError, timeoutMs } from "./providers";
import { synthesisSchema, SynthesisError, type SynthesisOutput } from "./schema";

export { SynthesisError } from "./schema";
export type { SynthesisErrorCode, SynthesisOutput } from "./schema";

export type Provider = "gemini" | "anthropic" | "mock";

export interface SynthesisConfig {
  provider: Provider;
  model: string;
  mode: "live" | "mock";
  /** Optional second model of the same provider, tried when the first one is busy or times out. */
  fallbackModel?: string;
}

export function getConfig(): SynthesisConfig {
  const p = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  const provider: Provider = p === "gemini" || p === "anthropic" ? p : "mock";
  return {
    provider,
    model: process.env.LLM_MODEL ?? "",
    mode: provider === "mock" ? "mock" : "live",
    fallbackModel: process.env.LLM_FALLBACK_MODEL || undefined,
  };
}

/** The whole live run (all attempts) must finish inside the synthesis route's 120 s, with time left to save. */
const RUN_BUDGET_MS = 100_000;
const RETRY_PAUSE_MS = 1_500;

const MAX_INPUT_TOKENS = 60_000;

export type RawCall = (user: string) => Promise<string>;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One live request with a single second chance: when the model is busy or times out, wait a moment and try again,
 * with the fallback model when one is configured. Everything shares one deadline so the route never runs out of time.
 */
export function liveCall(
  config: SynthesisConfig,
  language: "id" | "en",
  meta: { model?: string } = {},
  budgetMs = RUN_BUDGET_MS,
  send: typeof callGemini = config.provider === "gemini" ? callGemini : callAnthropic,
): RawCall {
  const deadline = AbortSignal.timeout(budgetMs);
  return async (user) => {
    if (!config.model) throw new ProviderError("config", "LLM_MODEL is not set.");
    const models = [config.model, config.fallbackModel || config.model];
    let last: unknown;
    for (const [i, model] of models.entries()) {
      if (deadline.aborted) break;
      try {
        const text = await send(model, user, deadline, language);
        meta.model = model;
        return text;
      } catch (e) {
        last = e;
        if (!(e instanceof ProviderError && e.transient) || i === models.length - 1) throw e;
        await pause(RETRY_PAUSE_MS);
      }
    }
    throw last instanceof Error
      ? last
      : new ProviderError(
          "timeout",
          `No answer within ${Math.round(budgetMs / 1000)} s (per attempt ${timeoutMs() / 1000} s).`,
        );
  };
}

/** Calls the model, validates the JSON with Zod, and retries ONCE with the validation error. */
export async function callAndValidate(call: RawCall, docs: ExtractedDoc[]): Promise<SynthesisOutput> {
  let note: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await call(userPrompt(docs, note));
    } catch (e) {
      if (e instanceof SynthesisError) throw e;
      if (e instanceof ProviderError) throw new SynthesisError(e.message, e.code);
      throw new SynthesisError(e instanceof Error ? e.message : "The AI request failed.");
    }
    try {
      const parsed = synthesisSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      note = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } catch {
      note = "The answer was not valid JSON.";
    }
  }
  throw new SynthesisError(`The AI answer did not match the expected format after one retry (${note}).`, "format");
}

function merge(parts: SynthesisOutput[]): SynthesisOutput {
  const seen = new Set<string>();
  const dedupe = <T>(items: T[], key: (t: T) => string) =>
    items.filter((i) => {
      const k = key(i).toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return {
    summary: parts[0].summary,
    objectives: dedupe(
      parts.flatMap((p) => p.objectives),
      (o) => "o:" + o.title,
    ),
    completed: dedupe(
      parts.flatMap((p) => p.completed),
      (o) => "c:" + o.title,
    ),
    next_tasks: dedupe(
      parts.flatMap((p) => p.next_tasks),
      (o) => "n:" + o.title,
    ),
    lessons: dedupe(
      parts.flatMap((p) => p.lessons),
      (o) => "l:" + o.text,
    ),
    tech: [...new Set(parts.flatMap((p) => p.tech))],
  };
}

/**
 * The single entry point. `mock` returns deterministic fixtures built from the text.
 * Live providers chunk large inputs below MAX_INPUT_TOKENS and merge the results.
 */
export async function synthesize(
  docs: ExtractedDoc[],
  config: SynthesisConfig = getConfig(),
  rawCall?: RawCall,
  language: "id" | "en" = "en",
  /** Filled with the model that actually answered (the fallback model when the first one was busy). */
  meta: { model?: string } = {},
): Promise<SynthesisOutput> {
  if (docs.every((d) => d.pages.every((p) => p.text.trim() === ""))) {
    throw new SynthesisError("The uploaded files contain no readable text.", "empty");
  }
  if (config.provider === "mock" && !rawCall) {
    return synthesisSchema.parse(mockSynthesize(docs));
  }

  const call: RawCall = rawCall ?? liveCall(config, language, meta);

  const chunks =
    estimateTokens(renderDocuments(docs)) > MAX_INPUT_TOKENS ? chunkDocuments(docs, MAX_INPUT_TOKENS * 4) : [docs];
  const results: SynthesisOutput[] = [];
  for (const chunk of chunks) results.push(await callAndValidate(call, chunk));
  return results.length === 1 ? results[0] : merge(results);
}
