import { describe, expect, it } from "vitest";
import { aiRemovalPatch, publishGap } from "@/lib/db/ai-draft";

describe("aiRemovalPatch", () => {
  const ai = "A tool that counts coral from photos.\n It was paused after the first field test.";

  it("only resets the choice when the AI never finished a run", () => {
    expect(aiRemovalPatch("My own summary.", [])).toEqual({ fill_mode: null });
  });

  it("removes the summary and tools the AI wrote", () => {
    const stored = "A tool that counts coral from photos. It was paused after the first field test.";
    expect(aiRemovalPatch(stored, [null, ai])).toEqual({ fill_mode: null, tech: [], summary: "" });
  });

  it("recognises an AI summary that was cut to the maximum length", () => {
    const long = "word ".repeat(300);
    expect(aiRemovalPatch(long.trim().slice(0, 700), [long]).summary).toBe("");
  });

  it("keeps a summary the owners wrote or changed", () => {
    expect(aiRemovalPatch("We rewrote this summary ourselves.", [ai])).toEqual({ fill_mode: null, tech: [] });
  });
});

describe("publishGap", () => {
  const full = { title: "Reef counter", summary: "x".repeat(30), field: "Engineering" };

  it("lets a filled-in project through", () => {
    expect(publishGap(full)).toBeNull();
  });

  it("names a missing basic before the summary", () => {
    expect(publishGap({ ...full, field: "", summary: "" })).toBe("basics");
    expect(publishGap({ ...full, title: "ab" })).toBe("basics");
  });

  it("asks for a summary of at least 30 characters", () => {
    expect(publishGap({ ...full, summary: "too short" })).toBe("summary");
  });
});
