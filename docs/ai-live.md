# Live AI (Gemini)

How to switch the AI draft from mock mode to a real model, what was tested, and what to watch.

## Switch it on

Set these for the environment (Vercel → Settings → Environment Variables, or `.env.local`):

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash-lite
LLM_FALLBACK_MODEL=gemini-3.5-flash     # optional, tried once when the first model is busy or too slow
GEMINI_API_KEY=...                      # from Google AI Studio, never commit it
LLM_TIMEOUT_SECONDS=45                  # optional, per attempt
```

Then check it with one synthetic project before people use it:

```
pnpm ai:smoke                                   # uses LLM_MODEL from .env.local / .env
pnpm ai:smoke --model gemini-3.5-flash-lite     # try another model
pnpm ai:smoke --lang en                         # English draft (default: Indonesian)
```

The smoke test sends only invented text (a made-up water-sensor project with one hidden prompt injection). It never
touches the database. It prints the items, how many evidence quotes were found on the cited page, and whether the
injection was ignored. Exit code 1 when the injection was followed or nothing came back.

## What happens on a run

1. The team consent gate, the per-person, per-project and platform-wide daily caps run first (unchanged).
2. One deadline of 100 s covers the whole run; the synthesis route allows 120 s.
3. Each request has its own timeout (`LLM_TIMEOUT_SECONDS`, default 45 s).
4. When the model is busy (HTTP 429 rate limit, 500, 502, 503, 504) or too slow, the run waits 1.5 s and tries once
   more, on `LLM_FALLBACK_MODEL` when set, else on the same model.
5. A wrong key, a retired model (HTTP 400, 401, 403, 404) or a used-up quota is not retried. It raises an alert once a day.
6. The answer is validated with Zod and retried once with the validation error (unchanged). Every quote is then
   checked against the cited page: "Bukti cocok" or "Bukti tidak ditemukan".
7. People see a short translated message per failure (`synth.error.*`: busy, timeout, quota, config, blocked, failed,
   format, empty), always with the manual option. The run record keeps the technical reason (`code: message`, no file
   contents) for `/admin/pipeline`, and the model that actually answered.

## Tested live (2026-11-23, one free-tier key)

| Model                                                                               | Result                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gemini-3.5-flash-lite`                                                             | Worked in 3 of 5 runs: 5 to 16 s, 7 to 12 items, injection ignored, Indonesian and English drafts. The last 2 runs failed cleanly (busy, then no answer within 45 s on the fallback) and stopped after 51 s instead of hanging. |
| `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.1-flash-lite` | HTTP 503 "high demand" at the time of testing.                                                                                                                                                                                  |
| `gemini-3.7-flash`, `gemini-flash-latest`                                           | No answer within 60 to 90 s (before this change the request had no timeout and hung).                                                                                                                                           |
| `gemini-2.5-flash`                                                                  | HTTP 404: no longer available to new keys.                                                                                                                                                                                      |
| `gemini-pro-latest`                                                                 | HTTP 429: quota (free tier).                                                                                                                                                                                                    |

Before the prompt was tightened, one quote joined two separate sentences and was correctly marked "Bukti tidak
ditemukan". Rule 2 of the prompt now asks for one continuous passage per quote.

## Not done or not verified

- Only synthetic text was sent. No real student report, no long PDF (chunking above 60k tokens is unit-tested only).
- The full app flow with a live model (upload, run, verify board) was not run in a browser for this change.
- Cost per run is not measured or shown; the daily caps are the only cost control. A free-tier key has low limits.
- Availability depends on Google: at the time of testing most Flash models were overloaded. Keep the fallback set and
  keep "Isi manual tanpa AI" visible.
