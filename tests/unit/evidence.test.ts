import { describe, expect, it } from "vitest";
import { checkItemEvidence, matchQuote } from "@/lib/evidence/match";
import { normalize } from "@/lib/evidence/normalize";

const PAGE = `The panel appreciated the data collection effort and the clear baseline.
The choice of the two coastal sites is not justified against the wider re-
gion. We recommend resubmitting with a sampling plan.`;

describe("normalize", () => {
  it("lowercases, collapses whitespace and joins hyphenated line breaks", () => {
    expect(normalize("Gener-\n  alization   is  “hard”")).toBe('generalization is "hard"');
  });
});

describe("matchQuote", () => {
  it("matches an exact quote", () => {
    expect(matchQuote("We recommend resubmitting with a sampling plan.", PAGE).status).toBe("matched");
  });

  it("matches across a hyphenated line break", () => {
    expect(matchQuote("not justified against the wider region", PAGE).status).toBe("matched");
  });

  it("matches despite whitespace and case differences", () => {
    expect(matchQuote("THE  PANEL appreciated\n the data collection   effort", PAGE).status).toBe("matched");
  });

  it("returns partial for a near miss (one word differs)", () => {
    const quote = "The choice of the two coastal sites is not justified against the wider area. We recommend resubmitting with a sampling plan";
    const r = matchQuote(quote, PAGE);
    expect(r.status).toBe("partial");
    expect(r.score).toBeGreaterThanOrEqual(0.9);
  });

  it("returns not_found for a fabricated quote", () => {
    expect(matchQuote("The service will be deployed on the university cloud next semester.", PAGE).status).toBe("not_found");
  });

  it("returns not_found when the quote is cited on the wrong page", () => {
    const pages = new Map([["f1", new Map([[1, "Intro page about drones."], [2, PAGE]])]]);
    const quote = "We recommend resubmitting with a sampling plan.";
    expect(checkItemEvidence([{ file_id: "f1", page: 1, quote }], pages)).toBe("not_found");
    expect(checkItemEvidence([{ file_id: "f1", page: 2, quote }], pages)).toBe("matched");
  });

  it("returns not_found for missing page text or an empty quote", () => {
    expect(matchQuote("anything", undefined).status).toBe("not_found");
    expect(matchQuote("   ", PAGE).status).toBe("not_found");
  });
});

describe("checkItemEvidence", () => {
  it("is partial when some quotes match and some do not", () => {
    const pages = new Map([["f1", new Map([[1, PAGE]])]]);
    const status = checkItemEvidence(
      [
        { file_id: "f1", page: 1, quote: "a sampling plan" },
        { file_id: "f1", page: 1, quote: "completely invented sentence about nothing" },
      ],
      pages,
    );
    expect(status).toBe("partial");
  });

  it("is not_found without evidence", () => {
    expect(checkItemEvidence([], new Map())).toBe("not_found");
  });
});
