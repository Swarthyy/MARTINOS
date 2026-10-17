import assert from "node:assert/strict";
import test from "node:test";
import { getUpBankSnapshot, UpBankError } from "../src/lib/bank/up";

const account = {
  id: "account-internal-id",
  attributes: { displayName: "Everyday", accountType: "TRANSACTIONAL", balance: { currencyCode: "AUD", valueInBaseUnits: 12345 }, accountNumber: "do-not-return" }
};
const transaction = {
  id: "transaction-internal-id",
  attributes: { status: "SETTLED", description: "Groceries", createdAt: "2026-10-16T00:00:00Z", settledAt: "2026-10-16T01:00:00Z", amount: { currencyCode: "AUD", valueInBaseUnits: -2550 } },
  relationships: { account: { data: { id: "account-internal-id" } } }
};

test("reads live balances and transactions while omitting upstream account identifiers", async () => {
  const seen: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    seen.push(url);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-bank-token");
    assert.equal(init?.redirect, "error");
    return Response.json(url.includes("/accounts") ? { data: [account], links: { next: null } } : { data: [transaction], links: { next: null } });
  };
  const snapshot = await getUpBankSnapshot("test-bank-token", 30, fetcher, new Date("2026-10-17T00:00:00Z"));
  assert.equal(snapshot.accounts[0].balanceMinor, 12345);
  assert.equal(snapshot.transactions[0].amountMinor, -2550);
  assert.equal(snapshot.transactions[0].accountName, "Everyday");
  assert.equal(snapshot.fetchedAt, "2026-10-17T00:00:00.000Z");
  assert.equal(snapshot.transactionsTruncated, false);
  assert.equal(seen.length, 2);
  assert.equal(JSON.stringify(snapshot).includes("account-internal-id"), false);
  assert.equal(JSON.stringify(snapshot).includes("do-not-return"), false);
});

test("never follows a pagination link outside the Up API", async () => {
  const fetcher: typeof fetch = async (input) => Response.json(
    String(input).includes("/accounts")
      ? { data: [account], links: { next: "https://attacker.example/collect" } }
      : { data: [], links: { next: null } }
  );
  await assert.rejects(getUpBankSnapshot("test-bank-token", 30, fetcher), (error: unknown) => error instanceof UpBankError && error.status === 502);
});

test("bounds query history and reports bank authentication failures safely", async () => {
  await assert.rejects(getUpBankSnapshot("test-bank-token", 365), (error: unknown) => error instanceof UpBankError && error.status === 400);
  const fetcher: typeof fetch = async () => new Response("secret upstream body", { status: 401 });
  await assert.rejects(getUpBankSnapshot("test-bank-token", 30, fetcher), (error: unknown) => error instanceof UpBankError && error.status === 502 && !error.message.includes("secret upstream"));
});
