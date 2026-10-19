import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  validateDraft,
  type Memory,
  type MemoryDraft,
} from "../src/lib/memory/model";
import { memoryTools, type MemoryStore } from "../src/lib/memory/service";
import {
  runAgent,
  type AgentSession,
  type SessionStore,
  type Provider,
  type AgentResponse,
} from "../src/lib/memory/agent";
const owner = "00000000-0000-4000-8000-000000000011",
  other = "00000000-0000-4000-8000-000000000012";
const draft = () =>
  validateDraft({
    kind: "routine",
    title: "Fixture work",
    detail: "Provisional schedule used only in automated tests",
    effective_from: "2026-01-01",
    routine: {
      weekdays: [1, 4],
      start: "07:30",
      end: "16:30",
      timezone: "Australia/Melbourne",
    },
    source_kind: "conversation",
    source_ref: "test conversation",
    source_quote: "I work Monday and Thursday, 7:30 to 16:30 Melbourne time.",
  });
async function database(dataDir?: string) {
  const db = new PGlite(dataDir);
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${owner}'),('${other}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261019052013_operating_memory.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`,
  );
  return db;
}
function store(db: PGlite): MemoryStore {
  return {
    async list() {
      return (
        await db.query<Memory>(
          "select *,effective_from::text,effective_until::text,exception_date::text from public.operating_memories order by created_at desc",
        )
      ).rows;
    },
    async propose(d) {
      return (
        await db.query<Memory>(
          `insert into public.operating_memories(user_id,kind,title,detail,effective_from,effective_until,routine,target_id,exception_date,supersedes_id,source_kind,source_ref,source_quote,state) values(auth.uid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
          [
            d.kind,
            d.title,
            d.detail,
            d.effective_from,
            d.effective_until,
            d.routine ? JSON.stringify(d.routine) : null,
            d.target_id,
            d.exception_date,
            d.supersedes_id,
            d.source_kind,
            d.source_ref,
            d.source_quote,
            d.source_kind === "inference" ? "inferred" : "pending",
          ],
        )
      ).rows[0];
    },
    async confirm(id) {
      return (
        await db.query<Memory>(
          "select * from public.confirm_memory_update($1)",
          [id],
        )
      ).rows[0];
    },
    async deactivate(id) {
      return (
        await db.query<Memory>(
          "update public.operating_memories set state='outdated' where id=$1 returning *",
          [id],
        )
      ).rows[0];
    },
  };
}
// Cast date columns to text to match the Supabase/PostgREST wire representation.

test("migration executes: RLS isolates owners, anonymous callers fail, history is immutable, invalid SQL writes rejected", async () => {
  const db = await database();
  try {
    const s = store(db),
      m = await s.propose(draft());
    await db.exec(
      `select set_config('request.jwt.claim.sub','${other}',false)`,
    );
    assert.equal((await s.list()).length, 0);
    await assert.rejects(s.confirm(m.id), /not found/);
    await assert.rejects(
      s.propose({ ...draft(), supersedes_id: m.id }),
      /foreign key/,
    );
    assert.equal(
      (
        await db.query(
          "update public.operating_memories set user_id=auth.uid() where id=$1 returning *",
          [m.id],
        )
      ).rows.length,
      0,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${owner}',false)`,
    );
    await assert.rejects(
      db.query(
        "update public.operating_memories set title='Changed' where id=$1",
        [m.id],
      ),
      /immutable/,
    );
    await assert.rejects(
      s.propose({
        ...draft(),
        routine: {
          weekdays: [9],
          start: "07:30",
          end: "16:30",
          timezone: "Australia/Melbourne",
        },
      }),
      /weekday/,
    );
    await db.exec("reset role; set role anon;");
    await assert.rejects(
      db.query("select * from public.operating_memories"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.confirm_memory_update($1)", [m.id]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("learn → review → persist → independent session → schedule → correct, with stale correction rejected", async () => {
  const db = await database();
  try {
    const memories = store(db);
    // Persist local agent sessions in actual SQL, as separate runtime instances do.
    const sessions: SessionStore = {
      async create() {
        return (
          await db.query<{ id: string }>(
            "insert into public.agent_sessions(user_id) values(auth.uid()) returning id",
          )
        ).rows[0].id;
      },
      async acquire(id, token) {
        return (
          await db.query<AgentSession>(
            "select * from public.acquire_agent_session($1,$2)",
            [id, token],
          )
        ).rows[0];
      },
      async save(id, token, p) {
        await db.query(
          `update public.agent_sessions set conversation_id=coalesce($3,conversation_id),turns=coalesce($4,turns) where id=$1 and lease_token=$2`,
          [id, token, p.conversation_id ?? null, p.turns ?? null],
        );
      },
      async release(id, token) {
        await db.query(
          "update public.agent_sessions set lease_token=null,lease_until=null where id=$1 and lease_token=$2",
          [id, token],
        );
      },
    };
    let responseCount = 0,
      conversations = 0;
    const requests: Record<string, unknown>[] = [];
    const provider: Provider = {
      async createConversation() {
        return `conv_test${++conversations}`;
      },
      async respond(body) {
        requests.push(body);
        responseCount++;
        if (responseCount === 1)
          return {
            id: "resp_1",
            status: "completed",
            output: [
              {
                type: "function_call",
                name: "propose_memory_update",
                call_id: "call_1",
                arguments: JSON.stringify({ draft: draft() }),
              },
            ],
          };
        return {
          id: `resp_${responseCount}`,
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "Please review the proposed work routine.",
                },
              ],
            },
          ],
        };
      },
    };
    const first = await runAgent(
      { message: draft().source_quote, model: "fixture-model" },
      sessions,
      memories,
      provider,
    );
    const proposal = (await memories.list())[0];
    assert.equal(proposal.state, "pending");
    assert.equal(proposal.source_ref, "conversation:conv_test1");
    const tools = memoryTools(memories);
    await assert.rejects(
      tools.confirm_memory_update(proposal.id, false),
      /Direct owner review/,
    );
    await tools.confirm_memory_update(proposal.id, true);
    assert.equal((await memories.list())[0].state, "confirmed");
    const second = await runAgent(
      { message: "What do you remember?", model: "fixture-model" },
      sessions,
      store(db),
      provider,
    );
    assert.notEqual(first.session_id, second.session_id);
    assert.match(String(requests.at(-1)!.instructions), /Fixture work/);
    const nextTurn = await runAgent(
      {
        message: "Continue",
        sessionId: first.session_id,
        model: "fixture-model",
      },
      sessions,
      store(db),
      provider,
    );
    assert.equal(nextTurn.session_id, first.session_id);
    assert.equal(requests.at(-1)!.conversation, "conv_test1");
    const window = ["2026-10-18T13:00:00Z", "2026-10-19T13:00:00Z"] as const;
    assert.equal(
      (await tools.resolve_availability(...window)).busy[0].start,
      "2026-10-18T20:30:00Z",
    );
    const changed: MemoryDraft = {
      ...draft(),
      routine: { ...draft().routine!, start: "09:00" },
      source_kind: "owner",
    };
    const a = await tools.correct_memory(proposal.id, changed),
      b = await tools.correct_memory(proposal.id, {
        ...changed,
        title: "Competing proposal",
      });
    await tools.confirm_memory_update(a.id, true);
    await assert.rejects(tools.confirm_memory_update(b.id, true), /Stale/);
    const history = await memories.list();
    assert.equal(history.find((m) => m.id === proposal.id)!.state, "outdated");
    assert.equal(
      history.find((m) => m.id === proposal.id)!.routine!.start,
      "07:30",
    );
    assert.equal(
      (await tools.resolve_availability(...window)).busy[0].start,
      "2026-10-18T22:00:00Z",
    );
    await tools.deactivate_memory(a.id);
    assert.equal((await tools.resolve_availability(...window)).busy.length, 0);
  } finally {
    await db.close();
  }
});

test("database lease rejects concurrent session use and cross-owner acquisition", async () => {
  const db = await database();
  try {
    const id = (
      await db.query<{ id: string }>(
        "insert into public.agent_sessions(user_id) values(auth.uid()) returning id",
      )
    ).rows[0].id;
    await db.query("select * from public.acquire_agent_session($1,$2)", [
      id,
      owner,
    ]);
    await assert.rejects(
      db.query("select * from public.acquire_agent_session($1,$2)", [
        id,
        other,
      ]),
      /unavailable or busy/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${other}',false)`,
    );
    await assert.rejects(
      db.query("select * from public.acquire_agent_session($1,$2)", [
        id,
        other,
      ]),
      /unavailable or busy/,
    );
  } finally {
    await db.close();
  }
});

test("confirmed one-date cancellation persists, inferred cancellation cannot clear a shift, deactivation restores it", async () => {
  const db = await database();
  try {
    const s = store(db),
      tools = memoryTools(s);
    const shift = await tools.propose_memory_update(draft());
    await tools.confirm_memory_update(shift.id, true);
    const exception = {
      ...draft(),
      kind: "exception",
      routine: null,
      target_id: shift.id,
      exception_date: "2026-10-19",
      effective_from: "2026-10-19",
      effective_until: "2026-10-19",
      source_kind: "inference",
    };
    const e = await tools.propose_memory_update(exception);
    const window = ["2026-10-18T13:00:00Z", "2026-10-19T13:00:00Z"] as const;
    assert.equal((await tools.resolve_availability(...window)).busy.length, 1);
    await tools.confirm_memory_update(e.id, true);
    assert.equal((await tools.resolve_availability(...window)).busy.length, 0);
    await tools.deactivate_memory(e.id);
    assert.equal((await tools.resolve_availability(...window)).busy.length, 1);
    const bad = {
      ...draft(),
      routine: {
        start: "07:00",
        end: "08:00",
        timezone: "Australia/Melbourne",
      },
    };
    await assert.rejects(
      s.propose(bad as unknown as MemoryDraft),
      /Invalid routine/,
    );
  } finally {
    await db.close();
  }
});

test("memory and remote Conversation mapping survive database close and reopening", async () => {
  const directory = await mkdtemp(join(tmpdir(), "martin-memory-"));
  let db = await database(directory);
  try {
    const s = store(db);
    const m = await s.propose(draft());
    await s.confirm(m.id);
    const session = (
      await db.query<{ id: string }>(
        "insert into public.agent_sessions(user_id,conversation_id) values(auth.uid(),'conv_persisted') returning id",
      )
    ).rows[0].id;
    await db.close();
    db = new PGlite(directory);
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
    assert.equal((await store(db).list())[0].state, "confirmed");
    assert.equal(
      (
        await db.query<{ conversation_id: string }>(
          "select conversation_id from public.agent_sessions where id=$1",
          [session],
        )
      ).rows[0].conversation_id,
      "conv_persisted",
    );
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
