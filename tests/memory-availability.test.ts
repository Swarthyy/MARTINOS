import assert from "node:assert/strict";
import test from "node:test";
import { validateDraft, type Memory } from "../src/lib/memory/model";
import { resolveAvailability } from "../src/lib/memory/availability";
export const fixture = (): Memory => ({
  ...validateDraft({
    kind: "routine",
    title: "Provisional fixture shift",
    detail: "Test only, not the production owner schedule",
    effective_from: "2026-01-01",
    routine: {
      weekdays: [1, 4],
      start: "07:30",
      end: "16:30",
      timezone: "Australia/Melbourne",
    },
    source_kind: "owner",
    source_ref: "test fixture",
    source_quote: "Hours verified in test only",
  }),
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-000000000011",
  state: "confirmed",
  created_at: "2026-01-01T00:00:00Z",
  confirmed_at: "2026-01-01T00:00:00Z",
});

test("empty calendar cannot establish free time; confirmed routine blocks without calendar", () => {
  assert.equal(
    resolveAvailability([], "2026-10-18T13:00:00Z", "2026-10-19T13:00:00Z")
      .availability,
    "unknown",
  );
  const r = resolveAvailability(
    [fixture()],
    "2026-10-18T13:00:00Z",
    "2026-10-19T13:00:00Z",
  );
  assert.equal(r.calendar_coverage, "unknown");
  assert.equal(r.busy.length, 1);
  assert.equal(r.busy[0].start, "2026-10-18T20:30:00Z");
  assert.equal(r.busy[0].end, "2026-10-19T05:30:00Z");
});
test("Melbourne winter and summer use different UTC offsets", () => {
  assert.equal(
    resolveAvailability(
      [fixture()],
      "2026-07-05T14:00:00Z",
      "2026-07-06T14:00:00Z",
    ).busy[0].start,
    "2026-07-05T21:30:00Z",
  );
  assert.equal(
    resolveAvailability(
      [fixture()],
      "2026-10-18T13:00:00Z",
      "2026-10-19T13:00:00Z",
    ).busy[0].start,
    "2026-10-18T20:30:00Z",
  );
});
test("single-date confirmed cancellation preserves next occurrence; inferred cancellation has no authority", () => {
  const m = fixture();
  const e: Memory = {
    ...m,
    id: "00000000-0000-4000-8000-000000000002",
    kind: "exception",
    target_id: m.id,
    exception_date: "2026-10-19",
    routine: null,
    state: "inferred",
  };
  assert.equal(
    resolveAvailability([m, e], "2026-10-18T13:00:00Z", "2026-10-22T13:00:00Z")
      .busy.length,
    2,
  );
  e.state = "confirmed";
  const r = resolveAvailability(
    [m, e],
    "2026-10-18T13:00:00Z",
    "2026-10-22T13:00:00Z",
  );
  assert.equal(r.busy.length, 1);
  assert.equal(r.busy[0].start, "2026-10-21T20:30:00Z");
});
test("overlapping and touching blocks merge and preserve provenance, clipped to query", () => {
  const a = fixture(),
    b = {
      ...fixture(),
      id: "00000000-0000-4000-8000-000000000002",
      routine: { ...fixture().routine!, start: "16:00", end: "18:00" },
    };
  const r = resolveAvailability(
    [a, b],
    "2026-10-19T00:00:00Z",
    "2026-10-19T06:00:00Z",
  );
  assert.equal(r.busy.length, 1);
  assert.equal(r.busy[0].start, "2026-10-19T00:00:00Z");
  assert.equal(r.busy[0].end, "2026-10-19T06:00:00Z");
  assert.equal(r.busy[0].memory_ids.length, 2);
});
test("invalid windows, dates, timezones and routines are rejected", () => {
  const f = fixture();
  for (const routine of [
    { ...f.routine, weekdays: [0] },
    { ...f.routine, start: "23:00", end: "01:00" },
    { ...f.routine, timezone: "Made/Up" },
    { ...f.routine, start: "25:00" },
  ])
    assert.throws(() => validateDraft({ ...f, routine }));
  assert.throws(() => validateDraft({ ...f, effective_from: "2026-02-30" }));
  assert.throws(() => resolveAvailability([f], "2026-01-01", "2026-01-02"));
  assert.throws(() =>
    resolveAvailability([f], "2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z"),
  );
});
test("nonexistent spring-forward and ambiguous fall-back times fail closed", () => {
  const m = fixture();
  m.routine = { ...m.routine!, weekdays: [7], start: "02:15", end: "03:30" };
  assert.throws(
    () =>
      resolveAvailability([m], "2026-10-03T14:00:00Z", "2026-10-04T14:00:00Z"),
    /ambiguous or nonexistent/,
  );
  assert.throws(
    () =>
      resolveAvailability([m], "2026-04-04T13:00:00Z", "2026-04-05T14:00:00Z"),
    /ambiguous or nonexistent/,
  );
});
test("future-dated permanent correction retains the previous rule until its effective date", () => {
  const old = fixture();
  old.state = "outdated";
  const next: Memory = {
    ...fixture(),
    id: "00000000-0000-4000-8000-000000000002",
    supersedes_id: old.id,
    effective_from: "2026-10-22",
    routine: { ...old.routine!, start: "09:00" },
  };
  const r = resolveAvailability(
    [old, next],
    "2026-10-18T13:00:00Z",
    "2026-10-22T13:00:00Z",
  );
  assert.deepEqual(
    r.busy.map((b) => b.start),
    ["2026-10-18T20:30:00Z", "2026-10-21T22:00:00Z"],
  );
});

test("a backdated second correction suppresses every earlier version from its effective date", () => {
  const original = fixture(); original.state = "outdated";
  const planned: Memory = { ...fixture(), id:"00000000-0000-4000-8000-000000000002",state:"outdated",supersedes_id:original.id,effective_from:"2026-11-01" };
  const corrected: Memory = { ...fixture(), id:"00000000-0000-4000-8000-000000000003",supersedes_id:planned.id,effective_from:"2026-10-01",routine:{...original.routine!,start:"09:00"} };
  const result = resolveAvailability([original,planned,corrected],"2026-10-18T13:00:00Z","2026-10-19T13:00:00Z");
  assert.equal(result.busy.length,1);
  assert.equal(result.busy[0].start,"2026-10-18T22:00:00Z");
  assert.deepEqual(result.busy[0].memory_ids,[corrected.id]);
});
