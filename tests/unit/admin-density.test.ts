import { describe, expect, it } from "vitest";
import { DENSITY_KEY, parseDensity } from "@/lib/admin/density";

describe("admin table density", () => {
  it("is compact only when the stored value says so", () => {
    expect(parseDensity("compact")).toBe("compact");
    for (const v of [null, undefined, "", "comfortable", "COMPACT", "dense"])
      expect(parseDensity(v)).toBe("comfortable");
  });

  it("is kept under its own browser storage key, not a cookie", () => {
    expect(DENSITY_KEY).toBe("estafet.admin.density");
  });
});
