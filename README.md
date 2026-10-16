# Martin OS

Martin OS is a private command centre for life and business. This foundation includes a responsive LIFE / CEO dashboard, a source registry with freshness states, owner-scoped Supabase authentication, a historical PostgreSQL schema, and a Latitude CSV import path. Cards intentionally show **No data yet** until real sources supply values.

## Run locally

Requires Node.js 20.9 or newer (Node 24 is validated here).

```bash
cd /workspace/MARTINOS
npm ci
npm run dev
```

Open `http://localhost:3000`. Without Supabase settings this is a setup preview with no personal data or import access.

To enable private data, create a Supabase project, run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor, configure email one-time link sign-in and an allowed redirect URL of `http://localhost:3000/auth/callback`, and set the three variables in [`.env.example`](.env.example) in `.env.local`. `MARTIN_OS_ALLOWED_EMAIL` must match the verified Supabase user's email. Rebuild after adding the `NEXT_PUBLIC_` values, as Next.js includes them at build time. Never use a service role key in this app. Configure equivalent callback URLs for any deployed origin. Supabase should disable open sign-ups or use an invite-only policy for a private deployment.

```bash
npm run typecheck
npm test
npm run build
```

The Latitude importer accepts the normalized [`latitude-template.csv`](public/latitude-template.csv), not an arbitrary native statement format. Use negative AUD amounts for charges and positive amounts for repayments/refunds. The importer records transactions as `unknown` until explicit categorization/reconciliation exists.

## Documents

- [Architecture and data model](docs/ARCHITECTURE.md)
- [Integration feasibility](docs/INTEGRATIONS.md)
- [Latitude investigation and import handoff](docs/LATITUDE.md)
- [Roadmap](docs/ROADMAP.md)
- [Progress log](docs/PROGRESS.md)

The project began in an empty GitHub repository. This foundation is the first project revision.
