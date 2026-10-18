# Read-only bank API pilot

## What it does

`GET /api/chatgpt/bank?days=30` fetches current balances and recent transactions from Up Bank's official API on demand. The response includes `source`, `fetchedAt`, a bounded time window, and truncation flags. It returns names, types, balances, dates, descriptions, amounts, currencies, and statuses. It omits account numbers and Up's internal IDs. It has no payment or account-change route and does not persist bank data in Martin OS.

The route requires `Authorization: Bearer <MARTIN_OS_ACTION_KEY>`. The key is separate from `UP_API_TOKEN`. The bank token stays on the server and is sent only to the fixed `https://api.up.com.au` origin. The server rejects redirects and pagination links outside Up's accounts/transactions endpoints. Responses are marked `no-store` and the bank's error body is never returned to callers. Configure HTTPS and rate limiting at the hosting layer before production use.

## What it does not do yet

This code has been built and tested against mocked Up responses. There is no configured Up token, public hosting, or live bank test. It does not cover Latitude, reconcile credit-card repayments, or keep a scheduled history. When ChatGPT is connected through a Custom GPT Action, it can request this data while that GPT is in use; it cannot independently monitor your finances between chats. Scheduled snapshots and alerts would be separate services with their own storage and permissions.

## Deployment and ChatGPT connection

1. Up Bank is confirmed as the first source. Create a personal API token in Up's official developer/account flow. Check the token's actual access permissions. Enter it as `UP_API_TOKEN` in the deployment host's secret settings, never in chat, Git, or a browser prompt supplied by Martin OS.
2. Import `Swarthyy/MARTINOS` into an HTTPS host such as Vercel. Use the repository root as the project root, select Next.js, and let it run `npm ci` and `npm run build`. The public `GET /api/health` route can verify the deployment before either secret is entered; it never returns bank data. Codex Cloud itself is an isolated development worker and does not provide a stable inbound API URL.
3. Set a unique, random `MARTIN_OS_ACTION_KEY` of at least 32 characters as a server-side secret in the host. Set `UP_API_TOKEN` there when available, then redeploy so the running service receives both. Keep the GPT private and restrict access to its owner. Do not use the bank token as the GPT action key. The Supabase variables are unrelated to this bank-only API and may remain unset.
4. Replace the placeholder server URL in [`openapi.bank.yaml`](openapi.bank.yaml) with the deployed HTTPS origin. Import that file as a Custom GPT Action and configure its bearer authentication with **only** `MARTIN_OS_ACTION_KEY`.
5. Test an unauthorized request (401), then a private authenticated request. Compare balances and recent transactions against Up itself. Check `fetchedAt` and both truncation flags. Do not paste the full response or either key into a public issue or chat.
6. Configure host-level request rate limits, secret rotation, and access logging that excludes authorization headers and bank response bodies before relying on it for personal finance use.

Latitude is the second source. It needs a confirmed supported API or an approved statement/browser workflow before a live endpoint can be promised.

## Current external blockers

This Codex cloud task has no Up token, deployment account, public URL, or ChatGPT action configuration. The Up domains have been saved in the cloud environment configuration draft but are not yet active. Those prerequisites are required for an end-to-end live bank response and a usable ChatGPT action URL. Enter secrets in the deployment provider's settings; never send them in a chat message.
