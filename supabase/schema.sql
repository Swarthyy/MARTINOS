-- Martin OS foundation schema. Run in a new Supabase project's SQL editor.
-- All personal tables use row-level security and auth.uid() ownership.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_key text not null,
  source_method text not null check (source_method in ('official_api','browser_handoff','import','research')),
  status text not null check (status in ('connected','imported','attention','paused')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, integration_key)
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  source_account_key text not null,
  display_name text not null,
  currency text not null default 'AUD',
  account_type text not null check (account_type in ('bank','credit_card','other')),
  created_at timestamptz not null default now(),
  unique (user_id, source_key, source_account_key)
);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_key text not null,
  content_sha256 text not null,
  row_count integer not null default 0,
  imported_at timestamptz not null default now(),
  unique (user_id, integration_key, content_sha256)
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  source_key text not null,
  source_transaction_key text not null,
  occurred_on date not null,
  description text not null,
  amount_minor bigint not null check (amount_minor <> 0),
  currency text not null,
  -- An unknown transaction never enters spending or income totals.
  kind text not null default 'unknown' check (kind in ('unknown','expense','income','transfer','liability_payment')),
  transfer_group_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, source_key, source_transaction_key)
);
create index if not exists financial_transactions_user_date_idx on public.financial_transactions (user_id, occurred_on desc);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  metric_key text not null,
  observed_at timestamptz not null,
  value_numeric numeric,
  value_text text,
  unit text,
  provenance text not null check (provenance in ('live','cached','imported')),
  external_key text,
  created_at timestamptz not null default now(),
  unique (user_id, source_key, metric_key, observed_at, external_key)
);
create index if not exists observations_user_metric_time_idx on public.observations (user_id, metric_key, observed_at desc);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_key text not null,
  trigger_kind text not null,
  status text not null check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_summary text
);

create table if not exists public.action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  title text not null,
  rationale text not null,
  action_type text not null,
  draft_payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','rejected','executed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.integration_connections enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.imports enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.observations enable row level security;
alter table public.agent_runs enable row level security;
alter table public.action_proposals enable row level security;
alter table public.audit_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.integration_connections, public.financial_accounts,
  public.imports, public.financial_transactions, public.observations, public.agent_runs,
  public.action_proposals, public.audit_events to authenticated;

create policy owner_rows on public.integration_connections for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_rows on public.financial_accounts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_rows on public.imports for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_rows on public.financial_transactions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_rows on public.observations for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_rows on public.agent_runs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_rows on public.action_proposals for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_rows on public.audit_events for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.import_latitude_statement(p_content_sha256 text, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_account uuid;
  v_import uuid;
  v_added integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_content_sha256 !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 5000 then
    raise exception 'Invalid import';
  end if;
  if exists (select 1 from public.imports where user_id = v_user and integration_key = 'latitude' and content_sha256 = p_content_sha256) then return 0; end if;

  insert into public.financial_accounts (user_id, source_key, source_account_key, display_name, account_type)
  values (v_user, 'latitude', 'default', 'Latitude credit card', 'credit_card')
  on conflict (user_id, source_key, source_account_key) do update set display_name = excluded.display_name
  returning id into v_account;

  insert into public.imports (user_id, integration_key, content_sha256)
  values (v_user, 'latitude', p_content_sha256)
  returning id into v_import;

  insert into public.financial_transactions (user_id, account_id, import_id, source_key, source_transaction_key, occurred_on, description, amount_minor, currency)
  select v_user, v_account, v_import, 'latitude',
         items.value->>'source_transaction_key', (items.value->>'occurred_on')::date,
         items.value->>'description', (items.value->>'amount_minor')::bigint, 'AUD'
  from jsonb_array_elements(p_rows) as items(value)
  on conflict (user_id, source_key, source_transaction_key) do nothing;
  get diagnostics v_added = row_count;

  update public.imports set row_count = v_added where id = v_import;
  insert into public.integration_connections (user_id, integration_key, source_method, status, last_attempt_at, last_success_at, last_error)
  values (v_user, 'latitude', 'import', 'imported', now(), now(), null)
  on conflict (user_id, integration_key) do update set status = 'imported', last_attempt_at = now(), last_success_at = now(), last_error = null;
  insert into public.audit_events (user_id, event_type, entity_type, entity_id, details)
  values (v_user, 'statement_imported', 'import', v_import, jsonb_build_object('source', 'latitude', 'new_rows', v_added));
  return v_added;
end;
$$;
revoke all on function public.import_latitude_statement(text, jsonb) from public, anon;
grant execute on function public.import_latitude_statement(text, jsonb) to authenticated;
