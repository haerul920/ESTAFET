# Privacy data map

What personal data ESTAFET holds, where it lives, who processes it, how long it is kept, and how a person can get it out or have it removed. This describes the **designed** behaviour; the retention periods marked "to confirm" need a decision from the owner and the campus.

Processors named here are the services the code is written to use. None of them has been contracted for a live deployment yet. [TEAM TO CONFIRM: processor agreements and the campus data contact before launch.]

## Data and where it lives

| Data | Where | Who can read it | Processor | Kept |
|---|---|---|---|---|
| Email address, password hash, sign-in sessions | Supabase Auth (`auth.users`, `auth.sessions`) | the person (their session); admins see whether the email is confirmed, never the password | Supabase | While the account exists. Scrubbed at deletion |
| Profile: name, faculty, notification preference, email language | `profiles` | the person; admins (name, faculty, state) | Supabase | While the account exists. Name becomes "Pengguna lama" at deletion |
| Policy acceptances (which version, when) | `policy_acceptances` | the person; admins (counts) | Supabase | Kept: evidence |
| Projects: title, summary, tech, notes; draft items with evidence quotes | `projects`, `draft_items` | public teaser: everyone; the rest: owners (and access holders for the backlog) | Supabase | Until the owner deletes a draft; published projects stay (see deletion) |
| Uploaded files (PDF, Markdown, code tree) and extracted text | Storage buckets `project-files`, `extracted-text` (private) | owners; access holders after the agreement; admins only through break glass (reason, 5 minutes, logged, owners notified) | Supabase | Until the owner removes them or the draft is deleted |
| Text sent for an AI draft | the AI provider, per request | the provider | Google (Gemini) or Anthropic, as configured | Per the provider's terms. Only with the whole team's consent. Source code is not sent except README and manifests. "Isi manual tanpa AI" sends nothing |
| Access, requests, request messages, agreements | `project_access`, `continuation_requests`, `request_messages`, `agreement_acceptances` | the people involved; owners; admins (metadata) | Supabase | Kept: attribution evidence |
| Lineage (who continued what) | `lineage_events` | public parts: teaser lineage with team names; owners | Supabase | Append-only, kept |
| Reports and appeals | `reports`, `moderation_appeals` | admins; the reporter sees their own status | Supabase | Kept while needed for moderation [to confirm: 2 years] |
| Reporter's network address | only as a one-way hash in `rate_limit_hits` and the report's reporter key | nobody (not reversible) | Supabase | Rate limit rows are removed after 2 days; the report keeps its grouping key |
| Notifications | `notifications` | the person | Supabase | While the account exists |
| **Email outbox** | `email_outbox`: template, language, notification content. **No address** | the sender job; admins see metadata only in `/admin/emails` (template, status, attempts, error code, recipient name; no content, no address) | Supabase | Sent and skipped rows are removed after 90 days (`housekeeping`); failed rows stay until looked at |
| The email itself | sent through the email provider | the recipient; the provider processes name, address and text | SMTP service or Resend, as configured | Per the provider's retention |
| Audit log (admin actions with reasons) | `audit_log` | admins | Supabase | Kept: evidence. Append-only |
| Trial sessions (onboarding research) | `trial_sessions` | admins | Supabase | Pseudonyms (P01), no names or emails |
| Bot check | Cloudflare Turnstile sees the visitor's browser and address on guest forms and sign-up | Cloudflare | Cloudflare | Per Cloudflare's terms |
| Server logs | the host's log drain | the team | the host and log service | 30 days suggested [to confirm]. No names, emails, file contents or tokens by design (`src/lib/log.ts`) |
| Cookies | Supabase session cookie, language cookie | the browser | n/a | Session lifetime; language 1 year. No analytics, no advertising |
| Browser storage (localStorage, not cookies, never sent to the server) | ids of announcements the person dismissed (`estafet.dismissed-announcements`); for admins, the table density choice (`estafet.admin.density`) | that browser only | the person's device | Until the person clears site data |

## Rights

- **Export.** `/akun/privasi` downloads a JSON copy of the person's own data (account, profile, projects, requests, access, reports they sent, appeals, notifications). Other people's data and file contents are not included.
- **Deletion.** `/akun/privasi` schedules deletion with a **30 day grace period** that can be cancelled. After it, the daily job `anonymize_deleted_account` scrubs the profile and the sign-in email, removes draft projects and their files, and keeps what other people rely on: published projects, agreements and lineage stay, with the person shown as "Pengguna lama", so a team that continued a project keeps a correct attribution line. The Privacy Policy says so. Owners who do not want a project to stay can unpublish it before the grace period ends.
- **Correction.** Name and faculty can be edited by the person.
- **Notification emails.** On or off, and the language, on `/akun/privasi`. Safety emails (moderation, appeals, revoked access) are always sent.
- **Complaints and requests** go to the contact address in `/admin/settings`.

## Open questions for the owner and the campus

1. Retention of reports and appeals, server logs and audit rows (numbers above are suggestions).
2. The legal basis and the campus data protection contact, and the wording of the Privacy Policy (it is a draft: *Draf, belum ditinjau pihak berwenang*).
3. Whether processor agreements with Supabase, the email provider, the AI provider and Cloudflare are needed by the campus.
4. Whether to add an optional privacy friendly analytics tool. None is installed.
