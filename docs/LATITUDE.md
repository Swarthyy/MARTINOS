# Latitude first integration: findings and experiment plan

## Verified in this session

- No signed-in browser capability or Latitude account is exposed to this Codex cloud task.
- No Latitude API credentials or provider network access are configured here.
- The application accepts an authenticated, normalized CSV of Latitude transactions, stores it with an import hash, and records source freshness. Re-importing the same file produces zero new rows. Data is stored under the signed-in user's Supabase row-level security policy.

We have **not verified** whether Latitude's current account UI supports transaction CSV export, what columns it provides, whether balances/due dates/repayment history/interest-free obligations are exportable, or whether browser retrieval is permitted and reliable. These depend on the actual account and current site. The importer therefore does not claim to synchronize those fields.

## Account-level experiment with Martin

1. In an available ChatGPT Work browser session, Martin signs in to Latitude himself. Do not share a password, recovery code, or MFA result with Martin OS or Codex.
2. Inspect the account's statements/transactions menus for an official CSV/OFX/PDF export, date range, card identifier, and available balances, due dates, payment history, and interest-free plan details. Record the exact export columns and any limitation, without copying personal values into public notes.
3. Check Latitude's applicable permissions/terms for account-level automation before repeating browser steps. Stop at CAPTCHA or MFA and use manual sign-in.
4. If an export exists, normalize a copy locally to `date,description,amount,currency,external_id` and test the importer. Negative amounts represent charges; positive amounts represent repayments/refunds. The template contains only a header row.
5. If only PDF statements exist, design a parser against a redacted sample and require human review of extracted rows before import. If account UI access is unsuitable, retain manual statement import.

The next Latitude adapter should add statement periods, outstanding balances, minimum payment and due date, and interest-free purchase plans **only after source fields are verified**. Keep the source document and observation time distinct from transaction time. Cross-check totals against the original statement. Up Bank repayments will later be matched as transfers rather than counted twice.
