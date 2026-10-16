import assert from "node:assert/strict";
import test from "node:test";
import { parseLatitudeCsv } from "../src/lib/latitude";

test("normalizes signed AUD transaction amounts without floating point", () => {
  const rows = parseLatitudeCsv("date,description,amount,currency,external_id\n2026-01-01,Coffee,-12.50,AUD,abc\n2026-01-02,Repayment,200,AUD,def\n");
  assert.deepEqual(rows.map((row) => row.amount_minor), [-1250, 20000]);
  assert.equal(rows[0].external_id, "abc");
});

test("rejects malformed amounts and unsupported currency", () => {
  assert.throws(() => parseLatitudeCsv("date,description,amount\n2026-01-01,Coffee,-1.234"), /two places/);
  assert.throws(() => parseLatitudeCsv("date,description,amount,currency\n2026-01-01,Coffee,-1,USD"), /only AUD/);
});

test("requires source columns and valid dates", () => {
  assert.throws(() => parseLatitudeCsv("date,amount\n2026-01-01,-1"), /needs date/);
  assert.throws(() => parseLatitudeCsv("date,description,amount\ninvalid,Coffee,-1"), /YYYY-MM-DD/);
});
