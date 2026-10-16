# Integration feasibility, 2026-10-16

This is a planning classification, not a claim that credentials or provider access exist. Official API access, account tier, permission scopes, and rate limits must be verified before implementation. This Codex cloud task exposes no signed-in browser tools or connected provider accounts. Its HTTP egress is restricted to preset package/development domains; provider domains must be added through environment settings when a concrete adapter needs them.

| Source | Leading method | Feasibility now | Main dependency or fallback |
| --- | --- | --- | --- |
| Latitude | Structured import; investigate supported browser export | **Import foundation built** | Native export format, dashboard fields, authentication and terms still need account-level verification. |
| Up Bank | Official API | Promising, unconnected | Confirm current API access and scopes; implement read-only transactions and transfer reconciliation. [Developer docs](https://developer.up.com.au/). |
| Hevy | Official API or structured export | Research | Verify current API availability/account requirements; use export if needed. |
| ChatGPT Calories Project | Structured export | Feasible with supplied data | Agree on a stable JSON/CSV export contract. No direct project access here. |
| Oura | Official API | Future | OAuth/personal access and device data availability. [Developer docs](https://cloud.ouraring.com/). |
| Apple Health | Device export / bridge | Future | Web app cannot directly read Apple Health; require user-controlled export or companion bridge. |
| Body measurements / goals | Manual entry or import | Straightforward | Define units, timezone, and update cadence. |
| Skool community/revenue | API if offered; browser handoff/import otherwise | Research | Confirm official access, membership export, payouts, fees, and permissions in the actual account. |
| Instagram | Meta Graph API | Conditional | Professional account, app review/scopes, linked Facebook Page, and eligible insights. [Meta docs](https://developers.facebook.com/docs/instagram-platform/). |
| YouTube | YouTube Data and Analytics APIs | Conditional | Google OAuth, channel ownership, quotas. [Analytics docs](https://developers.google.com/youtube/analytics). |
| TikTok | Official API if analytics scopes available | Research | Product eligibility and approved scopes; export fallback. [Developer portal](https://developers.tiktok.com/). |
| X | Official API | Research | API access tier and cost; export fallback. [Developer portal](https://developer.x.com/). |
| Gmail | Gmail API | Conditional | Sensitive OAuth scope review; begin read-only metadata or drafts only. [API docs](https://developers.google.com/workspace/gmail/api/guides). |
| Calendly | Official API/webhooks | Promising | OAuth or personal token, event scopes, webhook reliability. [Developer docs](https://developer.calendly.com/). |
| Linktree | Official integration if available; export otherwise | Research | Verify analytics access and export options in account. |
| Google Calendar | Official API | Promising | OAuth read-only scope and calendar selection. [API docs](https://developers.google.com/workspace/calendar/api/guides/overview). |
| TickTick | Official API if suitable; export otherwise | Research | Verify supported task permissions and data completeness. |
| Notion | Official API | Promising | Explicit page/database sharing with integration. [API docs](https://developers.notion.com/). |
| Google Drive | Official API | Conditional | Narrow file scopes and user-selected folders; avoid broad content access initially. [API docs](https://developers.google.com/workspace/drive/api/guides/about-sdk). |
| GitHub | Official API | Promising | Repo-scoped permissions. Cloud Git checkout access does not imply API credentials. [REST docs](https://docs.github.com/en/rest). |
| WBM meeting records | Structured import | Feasible with supplied records | Agree on format, participants, and privacy rules. |
| ChatGPT conversations/projects | User-directed export | Feasible with supplied files | No direct signed-in project access here; define import structure and consent. |
| Recurring subscriptions / tax reserve | Derived from classified finance data | Later | Require reliable categories and obligations first. |
| Investments / crypto | API or import | Later | Provider selection, currency conversions, and tax treatment. |

**Browser handoff:** ChatGPT Work may offer a signed-in cloud browser in another session. Codex Cloud does not expose that tool in this task. A Work workflow could inspect an account after Martin signs in, export a statement, and hand a reviewed CSV to Martin OS. This is not an unattended sync. Any future browser automation must respect account terms, authentication, MFA/CAPTCHA, and rate limits.
