import { describe, expect, it } from "vitest";
import { filterYears, parseAccessFilter, parseFilterYear } from "@/lib/explore";

describe("explore access filter", () => {
  it("accepts only open access or approval needed", () => {
    expect(parseAccessFilter("open")).toBe("open");
    expect(parseAccessFilter("by_request")).toBe("by_request");
    for (const bad of ["paused", "draft", "", undefined, ["open"]]) expect(parseAccessFilter(bad)).toBeUndefined();
  });
});

describe("explore year filter", () => {
  it("offers 2024 up to the current year, newest first", () => {
    expect(filterYears(2026)).toEqual([2026, 2025, 2024]);
    expect(filterYears(2024)).toEqual([2024]);
  });

  it("accepts only offered years from the address bar", () => {
    expect(parseFilterYear("2025", 2026)).toBe(2025);
    for (const bad of ["2023", "2027", "abc", "", undefined, ["2025"]]) {
      expect(parseFilterYear(bad, 2026)).toBeUndefined();
    }
  });
});
