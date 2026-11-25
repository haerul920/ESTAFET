# Demo script (about 5 minutes)

Prepare: `pnpm db:start`, `pnpm db:reset`, `pnpm dev`. Mock mode (`LLM_PROVIDER=mock`) needs no internet.
Say out loud: sample projects are simulated demo data, and the AI output is simulated in mock mode.

1. **Home** (`/`): the promise, the survey numbers ("indicative only", "30 min is a target, not measured").
2. **Explore** (`/explore`): search "fish", tick "Funding not granted". The URL changes and can be shared.
3. **Teaser** (`/projects/mangrove-cover-classifier`): verified tasks show only a source label, private files are locked.
4. **Share, as a new creator**: sign up, then `/share`.
   - Basics: fill and save.
   - Consent: click "I confirm", then "Create consent link". Open the link in a private window and click "Approve publishing" (the advisor needs no account).
   - Files: drop a PDF, a Markdown file and a Word file. Then drop a ZIP and point out that it is refused. In mock mode pictures are stored but not read.
   - Click "Draft with AI and continue". The mock banner appears. One item says "Evidence not found": select it to see the source viewer.
   - Keep, edit and remove items. "Continue to publish" stays disabled until all are reviewed.
   - Preview, tick the box, "Publish teaser". It appears on Explore.
5. **Adopter**: sign in as `adopter@estafet.demo` (password `Demo-Pass-2026!`), open a published project, "Request to continue", fill the form.
6. **Creator decision**: sign in as `creator@estafet.demo`, Dashboard, "Review request", Approve, accept the agreement.
7. **Adopter**: accept the agreement. The files unlock. Open the workspace, download a file, download the agreement PDF, copy the credit line.

Shortcut using seed data: the demo creator already has a pending request on Mangrove, and *Coral Reef Photo Counter* is waiting at the Verify step.

## If the network fails

Nothing in this script needs the internet except Google Fonts on the first load (the browser falls back to system fonts) and Docker image pulls on the very first `db:start`. Run `pnpm db:start` once beforehand while online.
