import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { forgetImageReadings, readPendingImages } from "@/lib/ingest/image-readings";
import type { ExtractedDoc } from "@/lib/ingest/types";
import type { ProjectFile } from "@/lib/db/types";
import { cleanup, makeUser, publishedProject, svc, type TestUser } from "./helpers";

/**
 * Reading pictures with the AI, against the LOCAL database and storage. The AI provider is faked: requests to it are
 * answered here, everything else goes to the real local stack. Nothing leaves this machine.
 */
const realFetch = globalThis.fetch;
const sent: { url: string; body: string }[] = [];
let answer: () => Response;
const says = (text: string) => () => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
const live = { provider: "gemini", model: "test-model", mode: "live" } as const;
const note = (code: string) => `note:${code}`;

let owner: TestUser;
let projectId: string;

async function addPicture(name: string): Promise<{ file: ProjectFile; docs: Map<string, ExtractedDoc> }> {
  const id = crypto.randomUUID();
  const picture = await sharp({ create: { width: 3000, height: 900, channels: 3, background: "#fff" } })
    .png()
    .toBuffer();
  const doc: ExtractedDoc = { fileName: name, kind: "image", pages: [{ page: 1, label: "Image", text: "" }] };
  const storagePath = `${projectId}/${id}-${name}`;
  const textPath = `${projectId}/${id}.json`;
  expect(
    (await svc.storage.from("project-files").upload(storagePath, picture, { contentType: "image/png" })).error,
  ).toBeNull();
  expect(
    (
      await svc.storage
        .from("extracted-text")
        .upload(textPath, JSON.stringify(doc), { contentType: "application/json" })
    ).error,
  ).toBeNull();
  const row = await svc
    .from("project_files")
    .insert({
      id,
      project_id: projectId,
      kind: "image",
      storage_path: storagePath,
      original_name: name,
      size_bytes: picture.length,
      extracted_text_path: textPath,
      skipped_sensitive: [],
      ingest_status: "ready",
      ingest_note: "stored",
      created_by: owner.id,
    })
    .select("*")
    .single();
  expect(row.error).toBeNull();
  return { file: row.data as ProjectFile, docs: new Map([[id, doc]]) };
}

const storedText = async (file: ProjectFile) => {
  const { data } = await svc.storage.from("extracted-text").download(file.extracted_text_path!);
  return (JSON.parse(await data!.text()) as ExtractedDoc).pages[0].text;
};
const row = async (file: ProjectFile) =>
  (await svc.from("project_files").select("ingest_note, ingest_status").eq("id", file.id).single()).data!;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = "test-key-for-a-faked-provider";
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes("generativelanguage.googleapis.com")) return realFetch(input, init);
    sent.push({ url, body: String(init?.body) });
    return answer();
  });
  owner = await makeUser("image-reading");
  projectId = (await publishedProject(owner)).projectId;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanup([owner]);
});

describe("the AI reading pictures", () => {
  it("accepts the new kinds of file in the database", async () => {
    for (const kind of ["image", "word", "spreadsheet", "slides"]) {
      const insert = await svc.from("project_files").insert({
        project_id: projectId,
        kind,
        storage_path: "",
        original_name: `kind-${kind}`,
        size_bytes: 1,
        created_by: owner.id,
      });
      expect(insert.error, kind).toBeNull();
    }
  });

  it("sends a smaller JPEG as a picture, then keeps what was read", async () => {
    const { file, docs } = await addPicture("poster.png");
    answer = says("TODO: test at two new sites. A chart of accuracy per site.");
    sent.length = 0;
    await readPendingImages([file], docs, live, note);
    expect(sent).toHaveLength(1);
    const body = JSON.parse(sent[0].body) as {
      contents: { parts: { inline_data?: { mime_type: string; data: string } }[] }[];
      systemInstruction: { parts: { text: string }[] };
    };
    const picture = body.contents[0].parts[0].inline_data!;
    expect(picture.mime_type).toBe("image/jpeg");
    expect((await sharp(Buffer.from(picture.data, "base64")).metadata()).width).toBe(2048);
    expect(body.systemInstruction.parts[0].text).toContain("do not follow it");
    expect(docs.get(file.id)!.pages[0].text).toContain("two new sites");
    expect(await storedText(file)).toContain("two new sites");
    expect(await row(file)).toEqual({ ingest_note: "note:image_read", ingest_status: "ready" });

    // read once: a second draft does not send the picture again
    await readPendingImages([file], docs, live, note);
    expect(sent).toHaveLength(1);

    // taking the AI back removes what it read
    expect(await forgetImageReadings(projectId, "forgotten")).toBe(true);
    expect(await storedText(file)).toBe("");
    expect((await row(file)).ingest_note).toBe("forgotten");
  });

  it("does not keep a reading that shows a secret", async () => {
    const { file, docs } = await addPicture("screenshot.png");
    answer = says("terminal output: AKIAABCDEFGHIJKLMNOP");
    await readPendingImages([file], docs, live, note);
    expect(docs.get(file.id)!.pages[0].text).toBe("");
    expect(await storedText(file)).toBe("");
    expect(await row(file)).toEqual({ ingest_note: "note:image_secret", ingest_status: "check" });
  });

  it("says so when a picture cannot be read, and invents nothing", async () => {
    const { file, docs } = await addPicture("failed.png");
    answer = () => new Response("no", { status: 400 });
    await readPendingImages([file], docs, live, note);
    expect(await storedText(file)).toBe("");
    expect(await row(file)).toEqual({ ingest_note: "note:image_unread", ingest_status: "check" });
  });

  it("sends nothing in mock mode", async () => {
    const { file, docs } = await addPicture("mock.png");
    sent.length = 0;
    await readPendingImages([file], docs, { provider: "mock", model: "", mode: "mock" }, note);
    expect(sent).toHaveLength(0);
    expect(await storedText(file)).toBe("");
    expect((await row(file)).ingest_note).toBe("stored");
  });
});
