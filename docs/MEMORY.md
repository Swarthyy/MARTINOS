# Memory & Routines — implementation and deployment

[Architecture decision and official documentation research](decisions/004-memory.md)

## What is implemented

- `/memory`: authenticated inspection, proposal review/confirmation, structured routines, goals/preferences/obligations, versioned corrections, one-date cancellations, rejection/deactivation, provenance and a Melbourne availability view.
- `/api/agent`: an authenticated, bounded Responses function-calling loop with durable OpenAI Conversations. Reuses the owner-scoped local session UUID across requests/instances; independent conversations receive fresh operating facts. Server-side conversation IDs are never accepted from the browser.
- `/api/memory`: all six requested tools plus explicit deactivation. Mutations require verified owner cookies and matching Origin; every response disables caching. The model can propose/correct but cannot call confirmation or deactivation.
- An additive migration adds `operating_memories`, `agent_sessions`, RLS, validation triggers and atomic confirmation/session-leasing functions. Uses authenticated invoker privileges; no service key.
- Same-day weekly routines use IANA wall-clock times; Temporal expands each date with its actual DST offset. Invalid, ambiguous or nonexistent times fail closed. Split overnight commitments into two routines. Query windows are limited to 31 days.

## Deploy

1. Install with Node 24 and `npm ci`. Existing CI runs tests, typecheck and build.
2. Configure the existing Supabase project/auth following README. For a new project apply `supabase/schema.sql` first; for an existing installation leave the financial schema untouched.
3. Apply `supabase/migrations/20261019052013_operating_memory.sql` once, using the project's reviewed migration process or SQL editor. It was generated using `supabase migration new operating_memory`. This checkout's foundation was originally a standalone schema, so do not blindly run all migrations against an existing database without reconciling migration history.
4. Keep the existing public Supabase URL/anon key and private `MARTIN_OS_ALLOWED_EMAIL`. Securely add `OPENAI_API_KEY` and `MARTIN_OS_OPENAI_MODEL` on the deployment server. Choose a model enabled in that project that supports Responses and function calling. Never prefix these variables with `NEXT_PUBLIC_`. No model/account access was assumed in tests.
5. Permit HTTPS egress to `api.openai.com` and the project's Supabase host. Use the configured environment proxy/CA where applicable. Configure hosting for the route's 240-second budget; shorter limits can interrupt tool turns. Do not change the Up Bank credentials or route.
6. Run `npm run typecheck`, `npm test`, `npm run build`. Then deploy through the existing host workflow.
7. On a linked/local Supabase instance, run `supabase db advisors --linked --type all --fail-on error` (or `--local`) and verify migration history using `supabase migration list --linked` / `--local`. The SQL migration was executed in embedded PostgreSQL-compatible PGlite tests here; Supabase CLI advisors and the full live Supabase stack were not available.
8. Sign in as the allowed owner, verify another account is rejected, and perform the live smoke test below. Verify backups and review OpenAI project retention separately before storing personal data.

The subsystem never installs a provisional shift into production. The supplied Monday/Thursday hours exist only in test fixtures.

## Live smoke test (requires credentials)

1. Tell Martin a **verified test commitment**, explicitly supplying weekdays, start/end, timezone and effective date. If using the provisional mission example, label it test data and verify hours before confirming anything belonging to the real owner.
2. Check the pending record's source quote, dates and routine on `/memory`. Confirm that specific record. Verify it becomes confirmed.
3. Start a **New conversation** and ask about the routine. Refresh the page, or restart the deployment, and resume the saved session. The browser stores only its local session UUID; the remote mapping lives in PostgreSQL. Across devices, an authenticated API client can reuse that same local UUID; there is no cross-device session picker yet.
4. Check a window containing the commitment while Google Calendar is empty. The interval must be blocked, with `calendar_coverage: unknown`. Unblocked intervals must never be described as globally free.
5. Cancel one local-date occurrence and confirm the exception. Only that occurrence disappears. Rejecting/deactivating the exception restores it.
6. Correct the routine and confirm the new version. Future blocks change on the effective date; the previous immutable content remains in history. An unconfirmed/inferred change does not change availability. Exceptions refer to a specific routine version; review future exceptions when replacing that version.
7. After 20 completed turns, check that summary rollover saves a new remote Conversation ID and archives the previous ID. The summary provides conversational continuity only; confirmed database facts remain authoritative.

## Tool contract

`POST /api/memory` accepts JSON `{ "tool": "...", ...arguments }`, matching Origin and the normal owner session cookie. This is a private app endpoint, not a public ChatGPT Action or an MCP server. The bank Action key does not authorize memory access.

| Tool | Arguments / behavior |
| --- | --- |
| `get_operating_context` | Optional ISO local `on`; returns up to 40 effective confirmed records, pending count, more-available flag. |
| `retrieve_relevant_memories` | `query`: bounded lexical search of titles/details, includes explicit states and provenance; no vector store. |
| `propose_memory_update` | `draft`: kind, title, detail, effective dates, routine/exception fields and source. Returns pending/inferred record. Agent source reference/quote is stamped by the server. |
| `confirm_memory_update` | `id`: direct owner review only. Transactionally supersedes an existing confirmed version; competing stale proposals fail. Idempotent for an already confirmed proposal. |
| `correct_memory` | `id`, complete replacement `draft`; produces an unconfirmed version of the same kind. |
| `resolve_availability` | ISO instant `start`, `end` (with offsets), positive window up to 31 days; merged routine blocks and unblocked-by-routines intervals. Missing memory storage is an error, never an empty/free schedule. |
| `deactivate_memory` | `id`; marks outdated and preserves the record. Not model-callable. |

Routine payload: `{"weekdays":[1,4],"start":"07:30","end":"16:30","timezone":"Australia/Melbourne"}`; Monday=1, Sunday=7. Example syntax only, not an assertion about the owner's hours. Exceptions have `kind: exception`, `routine: null`, `target_id`, `exception_date` and effective dates containing that date. Preferences, goals and text obligations do not independently generate busy intervals: use a routine for a timed commitment.

`POST /api/agent`: `{ "message": "...", "session_id": "optional local UUID" }` → `{ "session_id": "...", "answer": "..." }`. To begin an independent conversation omit the local ID. The same owner identity and services can underpin future voice adapters; live Realtime/telephony conversation IDs are not interchangeable with Conversations IDs without an adapter.

## Failure and retention behavior

No automatic provider retries: a timed-out response may already have appended history or proposed a record. Inspect the memory review queue before resending. An interrupted model turn marks the session for review and rejects further acquisition; start a New conversation to continue with the same confirmed operating facts. Remote history and pending proposals remain recoverable. An active database lease expires after five minutes if a worker is terminated. A hard process kill before the session can be marked is still a distributed-systems recovery edge case; inspect the remote transcript before manually clearing a lease or resuming an interrupted session.

A failed summary retains the original mapping. A failed save is surfaced, never reported as persisted. Provider errors do not expose upstream bodies or keys. Missing credentials disable agent chat without disabling direct routine management. Storage failures prevent availability calculations. At 1000 memory versions, the read service fails rather than silently omitting commitments; add paginated reads before increasing that limit.

Old Conversations remain in the OpenAI project; PostgreSQL stores their IDs, not transcript copies. Source references retain the conversation ID and verbatim user turn excerpt. Summaries are capped and carry no authority to confirm facts. This implementation does not perform semantic search over all old conversations; lexical structured-memory retrieval supplies cross-conversation operating knowledge. Administrators must export/delete OpenAI Conversations and Supabase records separately according to the chosen retention policy. Deactivation is historical preservation, not erasure. No retention/deletion automation is included.

## Verification performed locally

- Executed the actual migration in PGlite with simulated Supabase `auth.uid()` and database roles. Verified RLS isolation, anonymous denial, immutable content, invalid SQL writes, atomic confirmation, stale correction rejection, session lease exclusion, persisted exceptions and record deactivation.
- Exercised the eight-step agent workflow with an injected OpenAI provider and real SQL memory/session persistence; verified context in a new conversation and resumed conversation identity.
- Closed and reopened a file-backed test database to verify confirmed memory and remote Conversation mapping survive process/database restart.
- Tested DST winter/summer offsets and transition errors, merged overlapping intervals, inferred cancellation precedence, future-effective corrections, request origin/size/JSON validation, unauthorized routes, provider failures, summary rollover/failure, and prohibition on model self-confirmation.
- Live OpenAI responses, live Supabase Auth/PostgREST, Supabase advisors and the signed-in interactive browser workflow remain unverified without configured services. The local production HTTP smoke test covers setup page rendering and unauthorized API responses only.
