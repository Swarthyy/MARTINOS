import assert from "node:assert/strict";
import test from "node:test";
import {
  runAgent,
  openAIProvider,
  agentToolDefinitions,
  type Provider,
  type SessionStore,
  type AgentSession,
} from "../src/lib/memory/agent";
import { memoryTools, type MemoryStore } from "../src/lib/memory/service";
const id = "00000000-0000-4000-8000-000000000001";
function sessionFixture(turns = 0) {
  const state: AgentSession = {
    id,
    conversation_id: "conv_old",
    archived_conversation_ids: [],
    turns,
  };
  let releases = 0;
  const sessions: SessionStore = {
    async create() {
      return id;
    },
    async acquire() {
      return structuredClone(state);
    },
    async save(_id, _token, patch) {
      Object.assign(state, patch);
    },
    async release() {
      releases++;
    },
  };
  return { state, sessions, releases: () => releases };
}
const empty: MemoryStore = {
  async list() {
    return [];
  },
  async propose() {
    throw Error("unexpected write");
  },
  async confirm() {
    throw Error("unexpected confirm");
  },
  async deactivate() {
    throw Error("unexpected deactivate");
  },
};
const answer = (value: string) => ({
  id: "resp_test",
  status: "completed",
  output: [
    { type: "message", content: [{ type: "output_text", text: value }] },
  ],
});

test("summary rollover persists new Conversation mapping, keeps old ID and never replays transcripts", async () => {
  const f = sessionFixture(20);
  const requests: Record<string, unknown>[] = [];
  let seed = "";
  const provider: Provider = {
    async createConversation(summary) {
      seed = summary!;
      return "conv_new";
    },
    async respond(body) {
      requests.push(body);
      return answer(
        requests.length === 1
          ? "Unresolved question, verify routines."
          : "Hello again",
      );
    },
  };
  const result = await runAgent(
    { message: "Continue", sessionId: id, model: "test-model" },
    f.sessions,
    empty,
    provider,
  );
  assert.equal(result.answer, "Hello again");
  assert.equal(seed, "Unresolved question, verify routines.");
  assert.deepEqual(f.state.archived_conversation_ids, ["conv_old"]);
  assert.equal(f.state.conversation_id, "conv_new");
  assert.equal(f.state.turns, 1);
  assert.equal(requests[1].conversation, "conv_new");
  assert.deepEqual(requests[1].input, [{ role: "user", content: "Continue" }]);
  assert.equal(f.releases(), 1);
});
test("failed summary leaves original Conversation mapping and releases lease", async () => {
  const f = sessionFixture(20);
  await assert.rejects(
    runAgent(
      { message: "Continue", sessionId: id, model: "test-model" },
      f.sessions,
      empty,
      {
        async createConversation() {
          throw Error("must not create");
        },
        async respond() {
          throw new Error("dependency failed");
        },
      },
    ),
    /dependency failed/,
  );
  assert.equal(f.state.conversation_id, "conv_old");
  assert.equal(f.state.turns, 20);
  assert.equal(f.releases(), 1);
});
test("provider handles HTTP, network and malformed/incomplete responses without exposing credentials", async () => {
  for (const fetcher of [
    async () => new Response("sensitive upstream text", { status: 500 }),
    async () => {
      throw Error("secret-key");
    },
    async () =>
      Response.json({ id: "resp_1", status: "incomplete", output: [] }),
    async () => new Response("invalid"),
  ]) {
    const p = openAIProvider("private-test-key", fetcher as typeof fetch);
    await assert.rejects(
      p.respond({}),
      (error) =>
        error instanceof Error &&
        !/sensitive|private-test-key|secret-key/.test(error.message),
    );
  }
});
test("model cannot self-confirm a proposal even if it invents a confirmation tool call", async () => {
  assert.ok(
    !agentToolDefinitions.some((t) => t.name === "confirm_memory_update"),
  );
  const f = sessionFixture();
  let call = 0;
  const provider: Provider = {
    async createConversation() {
      return "conv_unneeded";
    },
    async respond(body) {
      if (++call === 1)
        return {
          id: "resp_1",
          status: "completed",
          output: [
            {
              type: "function_call",
              call_id: "call_1",
              name: "confirm_memory_update",
              arguments: JSON.stringify({ id }),
            },
          ],
        };
      assert.match(JSON.stringify(body.input), /Tool not permitted/);
      return answer("Please review.");
    },
  };
  await runAgent(
    { message: "Confirm everything", sessionId: id, model: "test" },
    f.sessions,
    empty,
    provider,
  );
});
test("memory dependency failure prevents a scheduling answer and releases lease", async () => {
  const f = sessionFixture();
  let calls = 0;
  await assert.rejects(
    runAgent(
      { message: "Am I available?", sessionId: id, model: "test" },
      f.sessions,
      {
        ...empty,
        async list() {
          throw Error("database unavailable");
        },
      },
      {
        async createConversation() {
          return "conv_new";
        },
        async respond() {
          calls++;
          return answer("free");
        },
      },
    ),
    /database unavailable/,
  );
  assert.equal(calls, 0);
  assert.equal(f.releases(), 1);
});
test("operating context validates date and bounds retrieval", async () => {
  const tools = memoryTools(empty);
  await assert.rejects(
    tools.get_operating_context("2026-02-30"),
    /Invalid date/,
  );
  await assert.rejects(tools.retrieve_relevant_memories(""), /Text/);
});
test("interrupted remote turn is marked for review rather than silently replayed", async () => {
  const f = sessionFixture();
  await assert.rejects(
    runAgent(
      { message: "Remember this", sessionId: id, model: "test" },
      f.sessions,
      empty,
      {
        async createConversation() {
          return "conv_new";
        },
        async respond() {
          throw Error("timeout after provider received input");
        },
      },
    ),
    /timeout/,
  );
  assert.equal(f.state.needs_review, true);
  assert.equal(f.state.turns, 0);
  assert.equal(f.releases(), 1);
});
