# AI assistance disclosure

| Tool | Role | Where |
|---|---|---|
| Claude Code (Anthropic, model Claude Sonnet 5.5) | Scaffolded the Next.js app, wrote the Supabase schema, RLS policies, seed data, UI components, server actions, ingestion and evidence code, and the unit, database and end-to-end tests. Worked from the team's `CLAUDE.md`, `PROMPTS.md` and the approved design file. | Whole repository |
| Claude Code | Release edition, phases R0 and R1 (after the first commit, tag `final-day-start`): audited the code and wrote `docs/release-plan.md`; wrote the R1 migrations, SQL rules, database tests, migration dry run, dashboard, access flows and end-to-end tests. Worked from `PROMPTS_RELEASE.md` and `CLAUDE.md` section 14. | `docs/release-plan.md`, `docs/migrations-r1.md`, `supabase/migrations/2026112100000*`, `tests/`, `src/` |
| Claude Code | Release edition, phase R2: next-intl routing, the Indonesian and English message files (**the Indonesian text is an AI draft, not yet reviewed by a native speaker**), the language switcher, localized API errors, agreement PDF and the i18n check script. | `messages/`, `src/i18n/`, `scripts/check-i18n.mjs`, `docs/copy-review.md` |
| Claude Code | Release edition, phase R3: z-index tokens, CSS motion system, Radix-based dialog, menu, tooltip, tabs and toast wrappers, the new Home hero and meadow, the Playwright overlap audit, the performance and screenshot scripts, and the Supabase query reference. | `src/components/ui/`, `src/styles/`, `tests/e2e/overlap.spec.ts`, `scripts/`, `docs/performance.md`, `docs/sql-queries.md` |
| Claude Code | Release edition, phase R4: the R4 migrations and their database tests, the `/bagikan` wizard changes, the project settings page, access settings, request thread, backlog progress, watch button, and the new Playwright flows. | `supabase/migrations/20261122*`, `tests/db/r4.test.ts`, `src/app/[locale]/bagikan`, `src/app/[locale]/proyek`, `tests/e2e/r4-flows.spec.ts` |
| Claude Code | Release edition, phase R5: the report dialog, the bot check, the "Laporan saya" page, the held-project notice, the owner decision and appeal pages, the admin appeals queue, the moderation settings, the five legal pages in Indonesian and English (**drafts written by the AI, not reviewed by a lawyer or the university**), forced policy re-acceptance, the account privacy page, the data export and the account deletion processor, with their tests | `src/`, `messages/`, `scripts/process-deletions.ts`, `tests/` |
| Claude Code | Drafted this documentation | `README.md`, `docs/` |

## In the product

- The synthesis step can call **Gemini** or **Anthropic** models when `LLM_PROVIDER` is set to `gemini` or `anthropic`. That live path has **not been tested** with a real key.
- In `mock` mode there is **no AI**: a deterministic rule-based extractor produces the draft, and the UI shows "Simulated AI output (mock mode)".
- Live drafts are written in the language of the interface (Indonesian or English). Quotes stay in the language of the source file. The Indonesian prompt line is untested with a real key.
- Whatever drafts the items, the owners review every item, and the server checks every evidence quote against the source text.

## Human review

Team Beban Server reviews, runs and owns the code. [TEAM TO CONFIRM: who reviewed what.]
