import { describe, expect, it } from "vitest";
import { basicsFields, basicsSchema, kindName, settleKind } from "./basics";

const v = (k: string) => k;
const base = { title: "Mangrove Cover Classifier", field: "Forestry", year: "2025" };

describe("basicsSchema: kind of work", () => {
  it("needs a name when the kind is other", () => {
    const r = basicsSchema(v).safeParse({ ...base, kind: "other", kind_other: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["kind_other"]);
    expect(r.error?.issues[0]?.message).toBe("kindOtherMin");
  });

  it("refuses a name longer than 60 characters", () => {
    const r = basicsSchema(v).safeParse({ ...base, kind: "other", kind_other: "x".repeat(61) });
    expect(r.error?.issues[0]?.message).toBe("kindOtherMax");
  });

  it("keeps the trimmed name for other", () => {
    const r = basicsSchema(v).parse({ ...base, kind: "other", kind_other: "  Tugas akhir  " });
    expect(r.kind_other).toBe("Tugas akhir");
  });

  it("drops a leftover name for the fixed kinds, as the database requires", () => {
    const r = basicsSchema(v).parse({ ...base, kind: "hackathon", kind_other: "Tugas akhir" });
    expect(r.kind_other).toBeNull();
    expect(r.stopped_note).toBe("");
  });

  it("exposes the single-field rules for Save and exit", () => {
    expect(basicsFields(v).kind.safeParse("community_service").success).toBe(true);
  });
});

describe("settleKind (Save and exit)", () => {
  it("saves other only together with a usable name", () => {
    const patch: Record<string, string | number | null> = { title: "T", kind: "other", kind_other: "x" };
    const skipped: string[] = [];
    settleKind(patch, skipped);
    expect(patch).toEqual({ title: "T" });
    expect(skipped).toEqual(["kind", "kind_other"]);
  });

  it("keeps other with its name", () => {
    const patch: Record<string, string | number | null> = { kind: "other", kind_other: "Magang" };
    settleKind(patch, []);
    expect(patch).toEqual({ kind: "other", kind_other: "Magang" });
  });

  it("clears the name for a fixed kind and never writes a name alone", () => {
    const fixed: Record<string, string | number | null> = { kind: "research", kind_other: "Magang" };
    settleKind(fixed, []);
    expect(fixed).toEqual({ kind: "research", kind_other: null });
    const alone: Record<string, string | number | null> = { kind_other: "Magang" };
    settleKind(alone, ["kind"]);
    expect(alone).toEqual({});
  });
});

describe("kindName", () => {
  const labels = { hackathon: "Hackathon", other: "Lainnya" };
  it("shows the owner's own name for other", () => {
    expect(kindName({ kind: "other", kind_other: "Tugas akhir" }, labels)).toBe("Tugas akhir");
  });
  it("falls back to the label", () => {
    expect(kindName({ kind: "hackathon", kind_other: null }, labels)).toBe("Hackathon");
    expect(kindName({ kind: "other", kind_other: null }, labels)).toBe("Lainnya");
  });
});
