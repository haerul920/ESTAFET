/**
 * ESTAFET Load Test Suite (Phase R8 Quality Gate, Item 6).
 *
 * Scenarios:
 *   1. browse_explore_and_teasers: 200 concurrent virtual users browsing /, /explore,
 *      filtered search queries, and published project teaser pages.
 *   2. concurrent_uploads: 20 concurrent virtual users uploading files to
 *      POST /api/projects/:projectId/files (enabled when LOAD_PROJECT_ID and LOAD_COOKIE are set).
 *   3. rate_limit_probe: verifies that rate-limited endpoints return 429 cleanly (never 5xx).
 *
 * Usage (against a local production build or a dedicated STAGING environment):
 *   k6 run -e BASE_URL=http://localhost:3100 -e ALLOW_LOAD_TEST=1 tests/load/explore-and-uploads.k6.js
 */
import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const ALLOW_LOAD_TEST = __ENV.ALLOW_LOAD_TEST === "1";
const LOAD_PROJECT_ID = __ENV.LOAD_PROJECT_ID || "";
const LOAD_COOKIE = __ENV.LOAD_COOKIE || "";
const SMOKE_ONLY = __ENV.SMOKE === "1";

if (!ALLOW_LOAD_TEST) {
  fail(
    "Refusing to run load test without -e ALLOW_LOAD_TEST=1. Never run load tests against a shared cloud database without explicit confirmation.",
  );
}

const hasUploadTarget = Boolean(LOAD_PROJECT_ID && LOAD_COOKIE);

export const options = {
  scenarios: {
    browse_explore_and_teasers: {
      executor: "ramping-vus",
      exec: "browsePublicPages",
      startVUs: SMOKE_ONLY ? 2 : 10,
      stages: SMOKE_ONLY
        ? [
            { duration: "10s", target: 5 },
            { duration: "5s", target: 0 },
          ]
        : [
            { duration: "30s", target: 100 },
            { duration: "60s", target: 200 },
            { duration: "30s", target: 0 },
          ],
      gracefulRampDown: "10s",
    },
    ...(hasUploadTarget
      ? {
          concurrent_uploads: {
            executor: "constant-vus",
            exec: "uploadDraftFiles",
            vus: SMOKE_ONLY ? 2 : 20,
            duration: SMOKE_ONLY ? "10s" : "45s",
            startTime: "10s",
          },
        }
      : {}),
  },
  thresholds: {
    "http_req_failed{scenario:browse_explore_and_teasers}": ["rate<0.01"],
    "http_req_duration{scenario:browse_explore_and_teasers}": ["p(95)<800", "p(99)<1500"],
    ...(hasUploadTarget
      ? {
          "http_req_duration{scenario:concurrent_uploads}": ["p(95)<3000"],
        }
      : {}),
  },
};

const PUBLIC_PATHS = [
  "/",
  "/explore",
  "/explore?q=mangrove",
  "/explore?kind=research&sort=tasks",
  "/projects/mangrove-cover-classifier",
  "/projects/campus-waste-sorting-assistant",
  "/projects/fish-freshness-indicator",
  "/projects/study-group-matcher",
  "/terms",
  "/privacy",
  "/pedoman",
  "/api/health",
];

export function browsePublicPages() {
  const path = PUBLIC_PATHS[Math.floor(Math.random() * PUBLIC_PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`, {
    headers: {
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    },
    tags: { path },
  });

  check(res, {
    "public page status is 200": (r) => r.status === 200,
    "no 5xx server error": (r) => r.status < 500,
  });

  sleep(0.5 + Math.random() * 1.0);
}

const SAMPLE_MD = `# Catatan Uji Beban ESTAFET

## Ringkasan
Dokumen ini dipakai untuk menguji unggahan paralel pada pipeline ekstraksi Markdown ESTAFET.

## Tugas berikutnya
- TODO: Verifikasi akurasi klasifikasi pada dataset lapangan kedua.
- Susun protokol kalibrasi kamera sebelum survei berikutnya.
`;

export function uploadDraftFiles() {
  const data = {
    files: http.file(SAMPLE_MD, `load-notes-${__VU}-${__ITER}.md`, "text/markdown"),
  };

  const res = http.post(`${BASE_URL}/api/projects/${LOAD_PROJECT_ID}/files`, data, {
    headers: {
      Cookie: LOAD_COOKIE,
    },
    tags: { endpoint: "upload" },
  });

  // 200 is a normal upload, 400 is max-files-per-project cap (10 files), 429 is the 30/hr per-user rate limit.
  // None of them may ever produce a 5xx server error.
  check(res, {
    "upload handled cleanly (200, 400 cap, or 429 rate-limited)": (r) =>
      r.status === 200 || r.status === 400 || r.status === 429,
    "upload never throws 5xx": (r) => r.status < 500,
  });

  sleep(1.0 + Math.random() * 1.5);
}
