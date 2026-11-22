import "../../scripts/lib/env";
import { expect, test } from "@playwright/test";

/**
 * Operations endpoints (R7), against the local stack and the local dev server (which sets a local-only CRON_SECRET):
 * the health check, the scheduled jobs and their secret, and the email preview.
 */
const SECRET = process.env.CRON_SECRET ?? "local-only-cron-secret-0123456789-abcdefghij";
const auth = { authorization: `Bearer ${SECRET}` };

test("the health endpoint reports the database as up and is not cached", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect(await res.json()).toMatchObject({ status: "ok", database: "up" });
});

test("scheduled jobs refuse requests without the secret", async ({ request }) => {
  for (const job of ["emails", "daily"]) {
    expect((await request.get(`/api/cron/${job}`)).status()).toBe(401);
    expect((await request.get(`/api/cron/${job}`, { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
    expect((await request.get(`/api/cron/${job}`, { headers: { authorization: SECRET } })).status()).toBe(401);
  }
});

test("scheduled jobs run with the secret, and an unknown job is a 404", async ({ request }) => {
  const emails = await request.get("/api/cron/emails", { headers: auth });
  expect(emails.status()).toBe(200);
  expect(await emails.json()).toMatchObject({ job: "emails", steps: [{ name: "emails", ok: true }] });

  const daily = await request.post("/api/cron/daily", { headers: auth });
  const body = await daily.json();
  expect(body.steps.map((s: { name: string }) => s.name)).toEqual([
    "expire_requests",
    "remind_expiring_requests",
    "escalate_overdue_holds",
    "housekeeping",
    "account_deletions",
  ]);
  expect(body.steps.every((s: { ok: boolean }) => s.ok)).toBe(true);
  expect(daily.status()).toBe(200);

  expect((await request.get("/api/cron/nothing", { headers: auth })).status()).toBe(404);
});

test("the email preview lists templates and renders them (outside production)", async ({ request }) => {
  const list = await request.get("/api/dev/email-preview");
  expect(list.status()).toBe(200);
  expect(await list.text()).toContain("moderation");
  const html = await request.get("/api/dev/email-preview?template=moderation&locale=id");
  expect(html.status()).toBe(200);
  expect(await html.text()).toContain("disembunyikan");
  const text = await request.get("/api/dev/email-preview?template=report_outcome&locale=en&format=text");
  expect(await text.text()).toContain("Report LP-1A2B3C4D was reviewed");
  expect((await request.get("/api/dev/email-preview?template=nope")).status()).toBe(404);
});

test("the sitemap lists the public pages with language alternates", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain("/explore");
  expect(xml).toContain('hreflang="en"');
  // No address of the admin area (a project whose slug merely starts with "admin" is fine).
  expect(xml).not.toMatch(/<loc>[^<]*\/admin(\/|<)/);
});

test("a public project page has a canonical address, structured data and a share picture; a missing one is not indexed", async ({
  page,
  request,
}) => {
  await page.goto("/en/projects/campus-waste-sorting-assistant");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/en\/projects\/campus-waste-sorting-assistant$/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="id"]')).toHaveCount(1);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
  expect(ld).toMatchObject({ "@type": "CreativeWork", inLanguage: "en" });
  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(og).toBeTruthy();

  const image = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");

  await page.goto("/en/projects/this-project-does-not-exist");
  const robots = await page.locator('meta[name="robots"]').evaluateAll((m) => m.map((x) => x.getAttribute("content")));
  expect(robots.join(" ")).toMatch(/noindex/);
});

test("local, staging and demo are closed to search engines", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \//);
  const res = await request.get("/explore");
  expect(res.status()).toBe(200);
});
