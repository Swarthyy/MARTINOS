# Roadmap

## Foundation — current session

- [x] Initialize the web app, design system, responsive LIFE/CEO shell, integration registry, and truthful empty states.
- [x] Create owner-scoped auth/database foundation, historical observations, draft agent records, and Latitude normalized CSV import.
- [x] Add local tests, build checks, docs, and cloud setup instructions.
- [ ] Configure an actual Supabase project, apply schema, enable private email sign-in, and run an authenticated end-to-end import.
- [ ] Decide hosting/region, backup, and access policy before storing real finance or health data.

## Finance pilot

- [x] Build a protected read-only Up Bank API route and Custom GPT Action schema against mocked bank responses.
- [ ] Confirm first bank, deploy to HTTPS, configure secrets privately, and verify against live bank data.
- [ ] Connect the Action to the intended private GPT; test access, freshness, and revocation.
- [ ] Inspect Latitude account export/browser options with Martin in an authorized signed-in session.
- [ ] Adapt native export format or reviewed PDF; model balances, statement obligations, interest-free plans, and due dates.
- [ ] Add transaction review/classification, account balance UI, and source-aware financial totals.
- [ ] Connect Up Bank read-only, reconcile repayments and transfers, and test against real statements.

## Connected intelligence

- [ ] Prioritize Hevy, calorie exports, Google Calendar, Skool, Gmail, Instagram, and YouTube after finance pilot.
- [ ] Add scheduler, retry/backoff, source sync logs, data freshness alerts, and OAuth token lifecycle handling.
- [ ] Add read-only agent summaries with cited source records, then draft action approvals and audited executors.
- [ ] Expand to subscriptions, tax reserve, coaching relationships, and cross-domain pattern analysis.
