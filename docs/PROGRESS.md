# Progress log

## 2026-10-16 — foundation initialized

- Found `Swarthyy/MARTINOS` empty with no commits or remote refs. Chose the requested Next.js/TypeScript/Tailwind/Supabase path and initialized the local checkout.
- Audited the cloud instance: Node 24 is available; no browser automation tool, Supabase project, provider account connection, or app credentials were exposed. Network policy allows package/development hosts only. Latitude account behavior could not be observed.
- Implemented responsive LIFE/CEO dashboard, source registry and freshness display, setup preview, email-link auth with owner allowlist, PostgreSQL/RLS schema, normalized Latitude CSV import, and idempotency logic.
- Added architecture, feasibility, Latitude experiment, roadmap, and run instructions.
- A clean `npm ci`, typecheck, three Latitude parser tests, and production build passed. Local HTTP smoke checks returned the preview dashboard and CSV template (200), while unauthenticated import was rejected (401).
- The Supabase schema and signed-in import flow remain untested because there is no project or owner account configured. Native Latitude export fields and browser access remain unverified.

Next session: configure Supabase, apply schema, test authenticated import and duplicate handling, then inspect Latitude export options in a permitted signed-in browser session. Do not claim a live Latitude connection before that experiment.

## 2026-10-17 — read-only cloud bank API pilot

- Narrowed the immediate task to an API ChatGPT can query. Built a bounded, read-only Up Bank adapter and `GET /api/chatgpt/bank`, protected by a separate action key. Added an OpenAPI Action definition and deployment instructions.
- Mocked tests cover authentication, live response shape, safe upstream errors, pagination host validation, and omission of bank account identifiers. Typecheck and production build pass.
- This is **not deployed** and has no live bank access: no Up token, public hosting credentials, or ChatGPT Action setup are present in this cloud task. The restricted cloud network policy does not list `api.up.com.au`. Bank selection and ChatGPT connection type are pending Martin's reply.

## 2026-10-18 — Up Bank confirmed

- Martin confirmed Up Bank as the first source and Latitude second.
- Saved `api.up.com.au` and `developer.up.com.au` in the cloud environment draft, plus a secure `UP_API_TOKEN` requirement for cloud-side validation. The draft is not published and the running network policy has not changed.
- Confirmed Node 24 can reach an allowed domain through the managed proxy using `NODE_OPTIONS=--use-env-proxy`; this flag is needed when testing the Up adapter inside the cloud environment.
- Added GitHub CI for clean install, typecheck, tests, and build. Live Up verification and deployment remain dependent on secure token entry and a hosting account.

## 2026-10-19 — Mission 004-B persistent memory

- Audited existing authentication, schema, integrations and agent gaps; reviewed official OpenAI sessions, Conversations, compaction and sandbox-memory documentation. Recorded ADR 004 before implementation.
- Added owner-scoped operating memories, immutable version history, source quotes, pending/inferred/confirmed/outdated states, atomic review/correction, one-date cancellations and database session leases in an additive migration. No real owner routines were seeded.
- Added OpenAI Conversations/Responses runtime, bounded context retrieval, owner-only confirmation, summary rollover and interruption handling. Browser session IDs resolve to server-side owner mappings; no bank Action key grants memory access.
- Added Memory & Routines UI and timezone-aware routine availability, with unknown calendar coverage and rejection of ambiguous/nonexistent DST times. Preserved Up Bank code and configuration.
- Executed the migration and eight-step mocked-provider workflow in PGlite, including RLS and persistence across database reopening; added boundary, precedence, overlap, DST and dependency-failure tests. See docs/MEMORY.md for deployment and limitations.
- The Supabase connector inventory contains only inactive projects and no project is linked to this checkout. No Supabase/OpenAI app credentials are configured. Live provider behavior, signed-in browser flow, project migration application and Supabase advisors remain deployment checks; local tests do not establish a production deployment.

Verification result: automated suite and added recurrence regressions pass; TypeScript and the production build pass. Local production HTTP checks returned 200 for `/memory` and 401 for unauthenticated memory/chat APIs. No live deployment was performed.
