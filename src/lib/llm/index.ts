import type { ExtractedDoc } from "@/lib/ingest/types";
import { mockSynthesize } from "./mock";
import { chunkDocuments, estimateTokens, renderDocuments, userPrompt } from "./prompts";
import { callAnthropic, callGemini } from "./providers";
import { providerFailure, synthesisSchema, SynthesisError, type SynthesisOutput } from "./schema";

export { SynthesisError } from "./schema";
export type { SynthesisOutput } from "./schema";

export type Provider = "gemini" | "anthropic" | "mock";

export interface SynthesisConfig {
  provider: Provider;
  model: string;
  mode: "live" | "mock";
}

export function getConfig(): SynthesisConfig {
  const rawProvider = process.env.LLM_PROVIDER?.trim().toLowerCase();
  const autoGemini = !rawProvider && !process.env.VITEST && Boolean(process.env.GEMINI_API_KEY?.trim());
  const p = rawProvider || (autoGemini ? "gemini" : "mock");
  const provider: Provider = p === "gemini" || p === "anthropic" ? p : "mock";
  const defaultModel = provider === "gemini" ? "gemini-3.6-flash" : provider === "anthropic" ? "claude-sonnet-4-6" : "";
  return {
    provider,
    model: process.env.LLM_MODEL?.trim() || defaultModel,
    mode: provider === "mock" ? "mock" : "live",
  };
}

const MAX_INPUT_TOKENS = 60_000;

export type RawCall = (user: string) => Promise<string>;

/** Calls the model, validates the JSON with Zod, and retries ONCE with the validation error. */
export async function callAndValidate(call: RawCall, docs: ExtractedDoc[]): Promise<SynthesisOutput> {
  let note: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await call(userPrompt(docs, note));
    } catch (e) {
      throw new SynthesisError(e instanceof Error ? e.message : "The AI request failed.", providerFailure(e));
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
  throw new SynthesisError(`The AI answer did not match the expected format after one retry (${note}).`, "badAnswer");
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
): Promise<SynthesisOutput> {
  if (docs.every((d) => d.pages.every((p) => p.text.trim() === ""))) {
    throw new SynthesisError("The uploaded files contain no readable text.", "noText");
  }
  if (config.provider === "mock" && !rawCall) {
    return synthesisSchema.parse(mockSynthesize(docs));
  }

  const call: RawCall =
    rawCall ??
    (async (user) => {
      if (!config.model) throw new Error("LLM_MODEL is not set.");
      return config.provider === "gemini"
        ? callGemini(config.model, user, undefined, language)
        : callAnthropic(config.model, user, undefined, language);
    });

  const chunks =
    estimateTokens(renderDocuments(docs)) > MAX_INPUT_TOKENS ? chunkDocuments(docs, MAX_INPUT_TOKENS * 4) : [docs];
  const results: SynthesisOutput[] = [];
  for (const chunk of chunks) results.push(await callAndValidate(call, chunk));
  return results.length === 1 ? results[0] : merge(results);
}
