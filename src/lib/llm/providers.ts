import { systemPrompt } from "./prompts";

/** Live provider calls. Plain fetch, no SDK. Keys and model names come from the environment. */

export interface LiveCall {
  system: string;
  user: string;
}

function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : t;
}

export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
];

export async function callGemini(
  model: string,
  user: string,
  signal?: AbortSignal,
  language: "id" | "en" = "en",
  /** Instructions for a task other than drafting. */
  system?: string,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");

  const candidates = [model, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== model)].filter(Boolean);
  let lastStatus = 0;

  for (const candidate of candidates) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system ?? systemPrompt(language) }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        signal,
      },
    );
    if (res.ok) {
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (text) return stripFence(text);
    }
    lastStatus = res.status;
    // Retry on model not found (404), rate limit (429), or transient overload (503).
    if (res.status !== 404 && res.status !== 429 && res.status !== 503) break;
  }

  throw new Error(`Gemini request failed (${lastStatus}).`);
}

export async function callAnthropic(
  model: string,
  user: string,
  signal?: AbortSignal,
  language: "id" | "en" = "en",
  /** Instructions for a task other than drafting. */
  system?: string,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      temperature: 0,
      system: system ?? systemPrompt(language),
      messages: [{ role: "user", content: user }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Anthropic request failed (${res.status}).`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text =
    json.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("") ?? "";
  if (!text) throw new Error("Anthropic returned no text.");
  return stripFence(text);
}
