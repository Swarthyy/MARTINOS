import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/api/chatgpt/bank/route";

test("bank endpoint fails closed without credentials", async () => {
  const oldActionKey = process.env.MARTIN_OS_ACTION_KEY;
  const oldBankToken = process.env.UP_API_TOKEN;
  delete process.env.MARTIN_OS_ACTION_KEY;
  delete process.env.UP_API_TOKEN;
  try {
    const response = await GET(new Request("https://example.test/api/chatgpt/bank"));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  } finally {
    if (oldActionKey === undefined) delete process.env.MARTIN_OS_ACTION_KEY; else process.env.MARTIN_OS_ACTION_KEY = oldActionKey;
    if (oldBankToken === undefined) delete process.env.UP_API_TOKEN; else process.env.UP_API_TOKEN = oldBankToken;
  }
});

test("bank endpoint rejects an invalid caller before contacting the bank", async () => {
  const oldActionKey = process.env.MARTIN_OS_ACTION_KEY;
  const oldBankToken = process.env.UP_API_TOKEN;
  process.env.MARTIN_OS_ACTION_KEY = "a".repeat(48);
  process.env.UP_API_TOKEN = "configured-test-token";
  try {
    const response = await GET(new Request("https://example.test/api/chatgpt/bank", { headers: { Authorization: "Bearer wrong" } }));
    assert.equal(response.status, 401);
  } finally {
    if (oldActionKey === undefined) delete process.env.MARTIN_OS_ACTION_KEY; else process.env.MARTIN_OS_ACTION_KEY = oldActionKey;
    if (oldBankToken === undefined) delete process.env.UP_API_TOKEN; else process.env.UP_API_TOKEN = oldBankToken;
  }
});

test("authenticated bank endpoint returns a live, non-cached snapshot", async () => {
  const oldActionKey = process.env.MARTIN_OS_ACTION_KEY;
  const oldBankToken = process.env.UP_API_TOKEN;
  const oldFetch = globalThis.fetch;
  process.env.MARTIN_OS_ACTION_KEY = "b".repeat(48);
  process.env.UP_API_TOKEN = "configured-test-token";
  globalThis.fetch = async (input, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer configured-test-token");
    return Response.json(String(input).includes("/accounts")
      ? { data: [{ id: "a1", attributes: { displayName: "Everyday", accountType: "TRANSACTIONAL", balance: { currencyCode: "AUD", valueInBaseUnits: 5000 } } }], links: { next: null } }
      : { data: [{ id: "t1", attributes: { status: "SETTLED", description: "Coffee", createdAt: "2026-10-17T00:00:00Z", settledAt: null, amount: { currencyCode: "AUD", valueInBaseUnits: -450 } }, relationships: { account: { data: { id: "a1" } } } }], links: { next: null } });
  };
  try {
    const response = await GET(new Request("https://example.test/api/chatgpt/bank?days=7", { headers: { Authorization: `Bearer ${"b".repeat(48)}` } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    const body = await response.json();
    assert.equal(body.source, "up_bank");
    assert.equal(body.periodDays, 7);
    assert.equal(body.accounts[0].balanceMinor, 5000);
    assert.equal(body.transactions[0].amountMinor, -450);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldActionKey === undefined) delete process.env.MARTIN_OS_ACTION_KEY; else process.env.MARTIN_OS_ACTION_KEY = oldActionKey;
    if (oldBankToken === undefined) delete process.env.UP_API_TOKEN; else process.env.UP_API_TOKEN = oldBankToken;
  }
});
