import { afterEach, describe, expect, it, vi } from "vitest";
import { liveCall, synthesize, type SynthesisConfig } from "@/lib/llm";
import { callGemini, classifyStatus, ProviderError, timeoutMs } from "@/lib/llm/providers";
import { SynthesisError } from "@/lib/llm/schema";
import type { ExtractedDoc } from "@/lib/ingest/types";

const DOC: ExtractedDoc = {
  fileName: "notes.md",
  kind: "markdown",
  pages: [{ page: 1, label: "Open work", text: "TODO: edge class needs far more labeled images." }],
};
const VALID = JSON.stringify({
  summary: "A baseline model.",
  objectives: [],
  completed: [],
  next_tasks: [
    {
      title: "Label more edge images",
      description: "",
      effort: "medium",
      evidence: [{ file: "notes.md", page: 1, quote: "edge class needs far more labeled images" }],
    },
  ],
  lessons: [],
  tech: [],
});
const CONFIG: SynthesisConfig = { provider: "gemini", model: "primary", mode: "live", fallbackModel: "backup" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("provider errors", () => {
  it("sorts HTTP answers into what people can do about them", () => {
    expect(classifyStatus("Gemini", 503, "high demand").code).toBe("busy");
    expect(classifyStatus("Gemini", 429, "Too many requests").code).toBe("busy");
    expect(classifyStatus("Gemini", 429, "You exceeded your current quota").code).toBe("quota");
    expect(classifyStatus("Anthropic", 529, "Overloaded").code).toBe("busy");
    expect(classifyStatus("Gemini", 404, "model is no longer available").code).toBe("config");
    expect(classifyStatus("Gemini", 403, "API key not valid").code).toBe("config");
    expect(classifyStatus("Gemini", 418, "").code).toBe("failed");
  });

  it("retries only busy and timeout", () => {
    expect(new ProviderError("busy", "").transient).toBe(true);
    expect(new ProviderError("timeout", "").transient).toBe(true);
    expect(new ProviderError("quota", "").transient).toBe(false);
    expect(new ProviderError("config", "").transient).toBe(false);
  });

  it("keeps the per-attempt timeout inside the route's time", () => {
    expect(timeoutMs({})).toBe(45_000);
    expect(timeoutMs({ LLM_TIMEOUT_SECONDS: "30" })).toBe(30_000);
    expect(timeoutMs({ LLM_TIMEOUT_SECONDS: "500" })).toBe(45_000);
    expect(timeoutMs({ LLM_TIMEOUT_SECONDS: "abc" })).toBe(45_000);
  });
});

describe("second chance with the fallback model", () => {
  it("uses the fallback model when the first one is busy, and reports which one answered", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError("busy", "Gemini: busy (503)."))
      .mockResolvedValueOnce(VALID);
    const meta: { model?: string } = {};
    const out = await synthesize([DOC], CONFIG, liveCall(CONFIG, "id", meta, 10_000, send), "id");
    expect(send.mock.calls.map((c) => c[0])).toEqual(["primary", "backup"]);
    expect(meta.model).toBe("backup");
    expect(out.next_tasks).toHaveLength(1);
  });

  it("tries the same model again when no fallback is set", async () => {
    const send = vi.fn().mockRejectedValueOnce(new ProviderError("timeout", "slow")).mockResolvedValueOnce(VALID);
    const config = { ...CONFIG, fallbackModel: undefined };
    await synthesize([DOC], config, liveCall(config, "en", {}, 10_000, send));
    expect(send.mock.calls.map((c) => c[0])).toEqual(["primary", "primary"]);
  });

  it("does not retry a wrong key or a retired model, and keeps the reason", async () => {
    const send = vi.fn().mockRejectedValue(new ProviderError("config", "Gemini: request refused (404)."));
    const err = await synthesize([DOC], CONFIG, liveCall(CONFIG, "en", {}, 10_000, send)).catch((e) => e);
    expect(send).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(SynthesisError);
    expect(err.code).toBe("config");
  });

  it("gives up after the second busy answer with code busy", async () => {
    const send = vi.fn().mockRejectedValue(new ProviderError("busy", "busy"));
    const err = await synthesize([DOC], CONFIG, liveCall(CONFIG, "en", {}, 10_000, send)).catch((e) => e);
    expect(send).toHaveBeenCalledTimes(2);
    expect(err.code).toBe("busy");
  });

  it("marks an answer in the wrong shape as a format error", async () => {
    const send = vi.fn().mockResolvedValue('{"summary": 5}');
    const err = await synthesize([DOC], CONFIG, liveCall(CONFIG, "en", {}, 10_000, send)).catch((e) => e);
    expect(err.code).toBe("format");
  });
});

describe("Gemini answers", () => {
  const answer = (body: unknown, status = 200) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

  it("ignores thought parts and keeps the answer text", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    answer({
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: "thinking…", thought: true }, { text: '{"a":1}' }] } },
      ],
    });
    await expect(callGemini("m", "x")).resolves.toBe('{"a":1}');
  });

  it("reports a cut-off answer, a safety stop and an overloaded model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    answer({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"a":' }] } }] });
    await expect(callGemini("m", "x")).rejects.toMatchObject({ code: "failed" });
    answer({ candidates: [{ finishReason: "SAFETY" }] });
    await expect(callGemini("m", "x")).rejects.toMatchObject({ code: "blocked" });
    answer({ error: { message: "This model is currently experiencing high demand." } }, 503);
    await expect(callGemini("m", "x")).rejects.toMatchObject({ code: "busy" });
  });

  it("turns a request that never answers into a timeout", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("LLM_TIMEOUT_SECONDS", "5");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }),
    );
    const controller = new AbortController();
    const pending = callGemini("m", "x", controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "timeout" });
  });

  it("refuses to call without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(callGemini("m", "x")).rejects.toMatchObject({ code: "config" });
  });
});
