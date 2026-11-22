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
