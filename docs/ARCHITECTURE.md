# Architecture decision 001: source-aware personal command centre

## Decision

Use **Next.js 16 + React 19 + TypeScript + Tailwind 4** for the web app, and **Supabase Auth + PostgreSQL** for private storage. A single deployable web app keeps operations simple while the integrations remain independent modules. Use official APIs with OAuth first, supported browser workflows second, and structured imports third. Run agents read-only or draft-only until individual action types have reviewed permissions.

This is a foundation, not a production deployment. The current cloud environment has no Supabase project, database, signed-in browser, or application secrets. The dashboard renders an honest setup preview without those services.

## Runtime boundaries

```text
Browser UI -> Next.js server routes -> owner session -> Supabase Auth/RLS -> PostgreSQL
                                      -> provider adapters (future)
ChatGPT Work browser (if available) -> user-reviewed export -> import adapter
```

The server never uses a Supabase service-role key. It checks the verified user and `MARTIN_OS_ALLOWED_EMAIL` before reading source data or accepting imports. Supabase row-level security limits all personal tables to `auth.uid()`. The two public Supabase client settings are not secrets. Credentials for future providers must be kept server-side or in provider-managed OAuth storage; do not log tokens, raw statements, passwords, or email bodies.

## Data model

| Table | Purpose |
| --- | --- |
| `integration_connections` | Source method, status, last attempt, last success, and safe error summary. |
| `financial_accounts` | Stable source-specific account identity and currency. |
| `imports` | Statement hash, row count, and import time. Duplicate files are ignored. |
| `financial_transactions` | Historical signed minor-unit amounts, source identity, classification, and transfer group. |
| `observations` | Time-stamped measurements for health, audience, revenue, and other domains with provenance. |
| `agent_runs` | Agent execution history and errors. |
| `action_proposals` | Draft suggestions and review state; no executor is present yet. |
| `audit_events` | Minimal activity trail without statement contents or credentials. |

Provider adapters should normalize records to these tables, keep external IDs where available, upsert idempotently, and update connection freshness only after successful persistence. Raw provider payloads should remain outside the main tables unless a future retention policy and encryption model justify them. `observations.provenance` distinguishes live, cached, and imported data; illustrative figures are never stored as measurements.

## Financial counting rules

Money is stored as signed integer minor units (AUD cents), never floating-point dollars. Imported transactions start with `kind = unknown`; they are excluded from financial totals. Classification must distinguish expenses, income, transfers, and liability payments. When Up Bank is connected, credit-card repayments should be linked by amount/date/account pair through `transfer_group_id`, reviewed on ambiguous matches, and excluded from both spending and income totals. Latitude's credit balance is a liability, not cash. Outstanding balance, due dates, interest-free plans, and statement-period totals require separate source records once a reliable export or API is confirmed; this CSV importer does not infer them.

## Agent permission model

Each future agent receives an explicit read scope and a set of draft action types. Its run, inputs by source reference, output, and errors are recorded. External side effects require an action-specific approval, a separately scoped executor, and an audit event. Sending messages, changing accounts, moving money, and purchases are outside the foundation's execution capabilities.

## Next architecture decisions for Martin

1. Choose where the private Supabase project and eventual web app should live (region and hosting). Australia is a sensible default if available near the user's financial sources.
2. Decide whether Martin OS stays single-user or should support assistants/coaches as separate roles. Current database is user-owned and is safe to extend, but shared access needs a new authorization model.
3. Set a financial data retention and backup policy before real imports.
