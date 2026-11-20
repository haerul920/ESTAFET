# AI assistance disclosure

| Tool | Role | Where |
|---|---|---|
| Claude Code (Anthropic, model Claude Sonnet 5.5) | Scaffolded the Next.js app, wrote the Supabase schema, RLS policies, seed data, UI components, server actions, ingestion and evidence code, and the unit, database and end-to-end tests. Worked from the team's `CLAUDE.md`, `PROMPTS.md` and the approved design file. | Whole repository |
| Claude Code | Drafted this documentation | `README.md`, `docs/` |

## In the product

- The synthesis step can call **Gemini** or **Anthropic** models when `LLM_PROVIDER` is set to `gemini` or `anthropic`. That live path has **not been tested** with a real key.
- In `mock` mode there is **no AI**: a deterministic rule-based extractor produces the draft, and the UI shows "Simulated AI output (mock mode)".
- Whatever drafts the items, the creator reviews every item, and the server checks every evidence quote against the source text.

## Human review

Team Beban Server reviews, runs and owns the code. [TEAM TO CONFIRM: who reviewed what.]
