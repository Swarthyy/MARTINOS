-- Additive memory subsystem; no fixture or changes to financial tables.
create table public.operating_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('routine','preference','goal','obligation','exception')),
  title text not null check (length(trim(title)) between 1 and 160),
  detail text not null check (length(trim(detail)) between 1 and 2000),
  state text not null default 'pending' check (state in ('pending','inferred','confirmed','outdated')),
  effective_from date not null,
  effective_until date check (effective_until >= effective_from),
  routine jsonb,
  target_id uuid,
  exception_date date,
  supersedes_id uuid,
  source_kind text not null check (source_kind in ('owner','conversation','inference')),
  source_ref text not null check (length(trim(source_ref)) between 1 and 200),
  source_quote text not null check (length(trim(source_quote)) between 1 and 2000),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique(user_id,id),
  foreign key(user_id,target_id) references public.operating_memories(user_id,id),
  foreign key(user_id,supersedes_id) references public.operating_memories(user_id,id),
  check ((kind = 'routine') = (routine is not null)),
  check ((kind = 'exception' and target_id is not null and exception_date is not null) or (kind <> 'exception' and target_id is null and exception_date is null)),
  check (exception_date is null or (exception_date >= effective_from and (effective_until is null or exception_date <= effective_until))),
  check (id is distinct from target_id and id is distinct from supersedes_id)
);
create index operating_memories_owner_state on public.operating_memories(user_id,state);
create unique index memory_single_successor on public.operating_memories(user_id,supersedes_id) where state = 'confirmed';
alter table public.operating_memories enable row level security;
create policy owner_rows on public.operating_memories for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select,insert,update on public.operating_memories to authenticated;
revoke all on public.operating_memories from anon;

-- Validate at the database boundary too; keep content immutable for historical recovery.
create function public.validate_operating_memory() returns trigger language plpgsql security invoker set search_path = public as $$
declare d jsonb;
begin
  if TG_OP = 'UPDATE' and (to_jsonb(new) - 'state' - 'confirmed_at') is distinct from (to_jsonb(old) - 'state' - 'confirmed_at') then
    raise exception 'Memory content is immutable; propose a correction';
  end if;
  if TG_OP = 'UPDATE' and not (new.state = old.state or (old.state in ('pending','inferred') and new.state in ('confirmed','outdated')) or (old.state = 'confirmed' and new.state = 'outdated')) then
    raise exception 'Invalid state transition';
  end if;
  if new.kind = 'routine' then
    if jsonb_typeof(new.routine) is distinct from 'object' or jsonb_typeof(new.routine->'weekdays') is distinct from 'array' or
       jsonb_array_length(new.routine->'weekdays') not between 1 and 7 or
       coalesce(new.routine->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       coalesce(new.routine->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       (new.routine->>'end') <= (new.routine->>'start') or
       not exists(select 1 from pg_timezone_names where name = new.routine->>'timezone') then raise exception 'Invalid routine'; end if;
    for d in select value from jsonb_array_elements(new.routine->'weekdays') loop
      if d::text !~ '^[1-7]$' then raise exception 'Invalid weekday'; end if;
    end loop;
  end if;
  if new.kind = 'exception' and (TG_OP = 'INSERT' or new.state = 'confirmed') and not exists(select 1 from public.operating_memories where id = new.target_id and user_id = new.user_id and kind = 'routine' and state = 'confirmed') then
    raise exception 'Exception requires a confirmed owned routine';
  end if;
  if new.state = 'confirmed' and new.confirmed_at is null then raise exception 'Confirmation timestamp required'; end if;
  return new;
end $$;
create trigger validate_operating_memory before insert or update on public.operating_memories for each row execute function public.validate_operating_memory();

create function public.confirm_memory_update(p_id uuid) returns public.operating_memories
language plpgsql security invoker set search_path = public as $$
declare m public.operating_memories; previous public.operating_memories;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  -- Same-owner advisory lock prevents competing corrections and lock inversions.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 4));
  select * into m from public.operating_memories where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Memory not found'; end if;
  if m.state = 'confirmed' then return m; end if;
  if m.state not in ('pending','inferred') then raise exception 'Memory is no longer pending'; end if;
  if m.supersedes_id is not null then
    select * into previous from public.operating_memories where id = m.supersedes_id and user_id = auth.uid() for update;
    if not found or previous.state <> 'confirmed' or previous.kind <> m.kind then raise exception 'Stale or incompatible correction'; end if;
    update public.operating_memories set state = 'outdated' where id = previous.id;
  end if;
  update public.operating_memories set state = 'confirmed', confirmed_at = now() where id = m.id returning * into m;
  return m;
end $$;
revoke all on function public.confirm_memory_update(uuid) from public,anon;
grant execute on function public.confirm_memory_update(uuid) to authenticated;
revoke all on function public.validate_operating_memory() from public,anon;

create table public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text,
  archived_conversation_ids text[] not null default '{}',
  turns integer not null default 0 check(turns >= 0),
  needs_review boolean not null default false,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_sessions_owner on public.agent_sessions(user_id,created_at desc);
alter table public.agent_sessions enable row level security;
create policy owner_rows on public.agent_sessions for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select,insert,update on public.agent_sessions to authenticated;
revoke all on public.agent_sessions from anon;

create function public.acquire_agent_session(p_id uuid, p_token uuid) returns public.agent_sessions
language plpgsql security invoker set search_path = public as $$
declare s public.agent_sessions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.agent_sessions set lease_token = p_token, lease_until = now() + interval '5 minutes', updated_at = now()
  where id = p_id and user_id = auth.uid() and not needs_review and (lease_until is null or lease_until < now()) returning * into s;
  if not found then raise exception 'Session unavailable or busy'; end if;
  return s;
end $$;
revoke all on function public.acquire_agent_session(uuid,uuid) from public,anon;
grant execute on function public.acquire_agent_session(uuid,uuid) to authenticated;
