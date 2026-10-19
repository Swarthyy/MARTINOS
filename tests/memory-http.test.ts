import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../src/app/api/memory/route";
import { POST as agent } from "../src/app/api/agent/route";
import { readBody } from "../src/lib/memory/http";

test("memory read, confirmation, and agent routes fail closed without owner authentication", async () => {
  const previous = process.env.MARTIN_OS_ALLOWED_EMAIL;
  delete process.env.MARTIN_OS_ALLOWED_EMAIL;
  try {
    for (const response of [
      await GET(),
      await POST(
        new Request("https://example.test/api/memory", { method: "POST" }),
      ),
      await agent(
        new Request("https://example.test/api/agent", { method: "POST" }),
      ),
    ]) {
      assert.equal(response.status, 401);
      assert.match(response.headers.get("cache-control")!, /no-store/);
    }
  } finally {
    if (previous === undefined) delete process.env.MARTIN_OS_ALLOWED_EMAIL;
    else process.env.MARTIN_OS_ALLOWED_EMAIL = previous;
  }
});
test("mutation boundary rejects cross-origin, missing origin, malformed and oversized JSON", async () => {
  const req = (body: string, origin?: string) =>
    new Request("https://example.test/api/memory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body,
    });
  await assert.rejects(readBody(req("{}", "https://evil.test")), /Same-origin/);
  await assert.rejects(readBody(req("{}")), /Same-origin/);
  await assert.rejects(
    readBody(req("broken", "https://example.test")),
    /Invalid JSON/,
  );
  await assert.rejects(
    readBody(
      req(JSON.stringify({ text: "x".repeat(33000) }), "https://example.test"),
    ),
    /too large/,
  );
  assert.deepEqual(
    await readBody(
      req('{"tool":"get_operating_context"}', "https://example.test"),
    ),
    { tool: "get_operating_context" },
  );
});
