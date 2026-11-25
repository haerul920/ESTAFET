import { createTranslator } from "next-intl";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import id from "../../messages/id.json";
import { SYNTHESIS_FAILURES } from "@/lib/llm/schema";
import { runSynthesis } from "@/lib/synthesis";
import { cleanup, makeUser, svc, type TestUser } from "./helpers";

/**
 * A failed AI draft, end to end against the LOCAL database: what the person reads, and what the run keeps.
 * The provider is faked: requests to it are answered here and nothing leaves this machine.
 */
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({ locale, messages: (locale === "en" ? en : id) as never, namespace: namespace as never }),
}));

const realFetch = globalThis.fetch;
const saved = { provider: process.env.LLM_PROVIDER, key: process.env.GEMINI_API_KEY };
let answer: () => Response | Promise<Response>;
let calls = 0;
let owner: TestUser;

async function projectWithFile(): Promise<string> {
  const created = await owner.client
    .from("projects")
    .insert({
      title: `AI errors ${Date.now()}`,
      summary: "A project used to see what happens when the AI draft fails.",
      kind: "research",
      field: "Engineering",
      year: 2025,
      created_by: owner.id,
    })
    .select("id")
    .single();
  expect(created.error).toBeNull();
  const projectId = created.data!.id as string;
  await svc
    .from("project_members")
    .update({ consented_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("profile_id", owner.id);
  const textPath = `${projectId}/${crypto.randomUUID()}.json`;
  const doc = { fileName: "notes.md", kind: "markdown", pages: [{ page: 1, label: "Notes", text: "TODO: test." }] };
  expect(
    (
      await svc.storage
        .from("extracted-text")
        .upload(textPath, JSON.stringify(doc), { contentType: "application/json" })
    ).error,
  ).toBeNull();
  const file = await svc.from("project_files").insert({
    project_id: projectId,
    kind: "markdown",
    storage_path: "",
    original_name: "notes.md",
    size_bytes: 11,
    extracted_text_path: textPath,
    created_by: owner.id,
  });
  expect(file.error).toBeNull();
  return projectId;
}

const lastRunError = async (projectId: string) =>
  (
    await svc
      .from("synthesis_runs")
      .select("error, status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
  ).data!;

beforeAll(async () => {
  process.env.LLM_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-key-for-a-faked-provider";
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes("generativelanguage.googleapis.com")) return realFetch(input, init);
    calls++;
    return answer();
  });
  owner = await makeUser("ai-errors");
});

afterAll(async () => {
  vi.unstubAllGlobals();
  process.env.LLM_PROVIDER = saved.provider;
  process.env.GEMINI_API_KEY = saved.key;
  await cleanup([owner]);
});

describe("when the AI draft fails", () => {
  it("has a message for every reason in both languages, without codes or jargon", () => {
    for (const messages of [id, en]) {
      for (const code of SYNTHESIS_FAILURES) {
        const text = (messages.synth.error as Record<string, string>)[code];
        expect(text, code).toBeTruthy();
        expect(text).not.toMatch(/Gemini|Anthropic|\d{3}|request failed|API/);
        expect(text).toContain(`"${messages.fill.manualBtn}"`);
      }
    }
  });

  it("says in Indonesian that the service is busy, and keeps the technical reason with the run", async () => {
    const projectId = await projectWithFile();
    answer = () => new Response("{}", { status: 503 });
    calls = 0;
    const result = await runSynthesis(projectId, owner.id, "id");
    expect(result).toEqual({ ok: false, status: 502, error: id.synth.error.busy });
    expect(calls).toBeGreaterThan(1); // the other models were still tried, as before
    expect(await lastRunError(projectId)).toEqual({ status: "failed", error: "Gemini request failed (503)." });
  });

  it.each([
    ["quota", () => new Response("{}", { status: 429 })],
    ["unavailable", () => new Response("{}", { status: 403 })],
    ["connection", () => Promise.reject(new TypeError("fetch failed"))],
    ["badAnswer", () => Response.json({ candidates: [{ content: { parts: [{ text: "not json" }] } }] })],
    ["failed", () => new Response("{}", { status: 400 })],
  ] as const)("tells %s apart, in the reader's language", async (code, respond) => {
    const projectId = await projectWithFile();
    answer = respond;
    const result = await runSynthesis(projectId, owner.id, "en");
    expect(result).toEqual({ ok: false, status: 502, error: en.synth.error[code] });
  });
});
