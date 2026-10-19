# ADR 004 — Hybrid agent memory

Date: 2026-10-19. Decision recorded before implementation.

## Audit

The application is Next.js 16.4.2 / React 19 with Supabase SSR cookies, verified `getUser()` authentication and an email owner allowlist. Personal tables use `auth.uid()` RLS; there is no service-role client. There is no existing agent/chat runtime, calendar adapter, vector store or memory subsystem. Up Bank has an independent read-only Action-key route; Latitude is an authenticated import. Neither integration needs modification.

This environment exposes no application secrets or provider identities. The connected Supabase inventory contains only inactive projects, none linked to this checkout; no live MARTIN OS database could be identified. Provider HTTP access is restricted. Local verification must use an isolated PostgreSQL-compatible test database and injected provider responses; deployment verification is separate.

## Official documentation reviewed

- [Agents SDK sessions](https://openai.github.io/openai-agents-js/guides/sessions/): `OpenAIConversationsSession` is server-backed and accepts a persisted conversation ID; `MemorySession` is process-local. The compaction wrapper must not wrap a Conversations session.
- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state): Conversations plus Responses persist messages/tool items across jobs and devices. Use one state owner; do not also replay transcripts or chain previous responses.
- [Compaction](https://developers.openai.com/api/docs/guides/compaction): standalone compaction returns an opaque canonical input window. Server-side compaction documents input-array or previous-response chaining. This implementation instead uses explicit bounded summary rollover for Conversations, avoiding an unverified combination.
- [Sandbox memory](https://openai.github.io/openai-agents-js/guides/sandbox-agents/memory/): distills workspace execution lessons to files. It is distinct from conversational sessions and requires a sandbox lifecycle. It does not supply authoritative scheduling facts or inherit this owner's ChatGPT memories.
- [Codex memory implementation](https://github.com/openai/codex/blob/main/codex-rs/memories/README.md): belongs to the Codex harness; this web app cannot assume access to desktop/cloud memory.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): use ownership predicates, explicit grants and both update checks. Documentation was retrieved through the Supabase docs tool. The changelog endpoint was attempted but unavailable; no claim of a completed changelog audit.

These APIs are usable from a deployed Node/Next.js server with its own API key. They do not expose ChatGPT's personal Memory database. No sandbox or multi-agent runtime is needed for this mission.

## Decision

Use the OpenAI Conversations REST API with Responses function calling directly, avoiding an SDK orchestration dependency for this small runtime. PostgreSQL stores the owner-to-conversation mapping and an expiring database lease to serialize turns across server instances. OpenAI owns conversational history; the app does not duplicate a transcript store. A local session UUID is the only client-selectable identity; remote IDs are resolved server-side under RLS.

After 20 completed turns, summarize the existing conversation through Responses, then start a new Conversation seeded with that non-authoritative summary. Retain old conversation IDs for source provenance/recovery. Summary failure must leave the old conversation intact and fail visibly. Summaries never confirm or supersede facts. A fresh conversation always receives a bounded current operating-context digest; tools retrieve additional matching facts, rather than replaying all previous chats. Future voice adapters can reuse the same authenticated session service and owner ID; no phone or voice executor is included.

Structured operating memories are immutable versions with pending, inferred, confirmed or outdated state; each has a source kind/reference/quote, creation time, effective dates and optional superseded record. Corrections are proposals until the owner explicitly confirms the specific record. Confirmation atomically marks the prior version outdated and activates the new one with a row lock, rejecting stale competing corrections. Deactivation preserves history. Inferred/proposed records never block time or cancel confirmed commitments. Temporary overrides are confirmed, date-specific exceptions pointing to a confirmed routine; they leave the recurring record intact.

All six tools share owner-scoped services. The model may read context, retrieve facts, propose changes/corrections and resolve availability. `confirm_memory_update` is deliberately absent from model-callable tools: only a direct owner review request invokes it. All changes, including inferred records, require visible review to become confirmed. The agent cannot approve its own proposals.

Availability expands confirmed weekly wall-clock routines in an IANA timezone, applies confirmed one-date exceptions, intersects requested bounds and merges overlapping busy intervals. DST uses Temporal with ambiguous/nonexistent wall times rejected instead of guessed. No calendar integration exists: results explicitly describe routine coverage, and absence of routines is unknown availability. Calendar busy intervals can be supplied by a future trusted adapter; missing/failed calendar coverage must never be described as globally free.

## Scope and deployment

No fixture is seeded into production. Monday/Thursday 07:30–16:30 Melbourne is test data only. No vector database, financial integration changes, external actions or background agents. Database and provider failures fail closed. Deployment requires applying the additive migration and securely configuring Supabase, owner email, OpenAI API key and model. OpenAI retains conversations separately from Supabase backups; deletion/retention requires administering both stores. Live provider semantics and signed-in browser execution remain release checks when credentials exist.
