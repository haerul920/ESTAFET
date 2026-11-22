import { afterEach, describe, expect, it, vi } from "vitest";

// The page is not rendered here. These modules only load the next-intl navigation helpers, which need Next itself.
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

describe("/styleguide", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a 404 in PRODUCTION, before any message or data is loaded", async () => {
    const { default: StyleguidePage } = await import("@/app/[locale]/styleguide/page");
    vi.stubEnv("APP_ENV", "PRODUCTION");
    await expect(StyleguidePage()).rejects.toMatchObject({ digest: expect.stringMatching(/404/) });
  });

  it("asks search engines not to index it", async () => {
    const { generateMetadata } = await import("@/app/[locale]/styleguide/page");
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "id" }) });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });
});
