"use client";
import Link from "next/link";
import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useState, type FormEvent } from "react";
import type { Memory, MemoryDraft } from "@/lib/memory/model";
import type { resolveAvailability } from "@/lib/memory/availability";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const blank = (): MemoryDraft => ({
  kind: "routine",
  title: "",
  detail: "",
  effective_from: today(),
  effective_until: null,
  routine: {
    weekdays: [],
    start: "",
    end: "",
    timezone: "Australia/Melbourne",
  },
  source_kind: "owner",
  source_ref: "Memory & Routines",
  source_quote: "",
  supersedes_id: null,
  target_id: null,
  exception_date: null,
});
export function MemoryPanel({ agentConfigured }: { agentConfigured: boolean }) {
  const [memories, setMemories] = useState<Memory[]>([]),
    [draft, setDraft] = useState(blank),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [availability, setAvailability] = useState<ReturnType<
    typeof resolveAvailability
  > | null>(null);
  const [windowStart, setWindowStart] = useState(today()),
    [windowEnd, setWindowEnd] = useState(today());
  const [sessionId, setSessionId] = useState(""),
    [message, setMessage] = useState(""),
    [answer, setAnswer] = useState("");
  async function api(path: string, data?: unknown) {
    const r = await fetch(path, {
      method: data ? "POST" : "GET",
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.message ?? "Request failed.");
    return result;
  }
  async function load() {
    const result = await api("/api/memory");
    setMemories(result.memories);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    setSessionId(localStorage.getItem("martin-memory-session") ?? "");
  }, []);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  async function mutate(tool: string, extra: Record<string, unknown>) {
    await api("/api/memory", { tool, ...extra });
    setAvailability(null);
    await load();
  }
  function edit(m: Memory) {
    setDraft({
      ...m,
      supersedes_id: m.id,
      source_kind: "owner",
      source_ref: "Memory & Routines correction",
      source_quote: "",
    });
    setNotice("Edit the record below, then propose and review the correction.");
  }
  function cancel(m: Memory) {
    setDraft({
      ...blank(),
      kind: "exception",
      title: `Cancelled: ${m.title}`,
      detail: "Cancel one occurrence only.",
      routine: null,
      target_id: m.id,
      exception_date: today(),
      effective_from: today(),
      effective_until: today(),
    });
  }
  async function propose(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await mutate("propose_memory_update", {
        draft: {
          ...draft,
          source_quote:
            draft.source_quote ||
            `Owner entered: ${draft.title}. ${draft.detail}`,
        },
      });
      setDraft(blank());
      setNotice("Proposal saved. Review its details and confirm below.");
    });
  }
  const field =
    "w-full rounded-lg border border-[#354541] bg-[#0e1716] p-3 text-white";
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-10">
      <Link href="/" className="muted">
        ← Dashboard
      </Link>
      <header>
        <p className="eyebrow">MARTIN OS</p>
        <h1 className="my-3 text-3xl">Memory & Routines</h1>
        <p className="muted">
          Review what Martin knows. Only confirmed routines block time;
          corrections preserve earlier versions.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-xl border border-amber-600 p-4">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="panel space-y-4 p-6">
        <h2 className="text-xl">Talk to Martin</h2>
        <p className="muted">
          Potentially lasting knowledge becomes a proposal for your review.
        </p>
        {!agentConfigured && (
          <p>
            Conversations need a server OpenAI key and model. You can still
            manage routines below.
          </p>
        )}
        <p className="muted text-sm">
          {sessionId ? `Saved session: ${sessionId}` : "New conversation"}
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const result = await api("/api/agent", {
                message,
                session_id: sessionId || undefined,
              });
              setSessionId(result.session_id);
              localStorage.setItem("martin-memory-session", result.session_id);
              setAnswer(result.answer);
              setMessage("");
              await load();
            });
          }}
        >
          <label className="block">
            Message
            <textarea
              className={field}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={8000}
            />
          </label>
          <div className="flex gap-3">
            <button disabled={busy || !agentConfigured} className="btn-primary">
              Send
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn-quiet"
              onClick={() => {
                setSessionId("");
                localStorage.removeItem("martin-memory-session");
                setAnswer("");
              }}
            >
              New conversation
            </button>
          </div>
        </form>
        {answer && (
          <p className="whitespace-pre-wrap" aria-live="polite">
            {answer}
          </p>
        )}
      </section>
      <section className="panel space-y-4 p-6">
        <h2 className="text-xl">
          {draft.supersedes_id ? "Correct a memory" : "Add a memory"}
        </h2>
        <form onSubmit={propose} className="grid gap-4 md:grid-cols-2">
          <label>
            Kind
            <select
              className={field}
              value={draft.kind}
              onChange={(e) => {
                const kind = e.target.value as MemoryDraft["kind"];
                setDraft({
                  ...blank(),
                  kind,
                  routine: kind === "routine" ? blank().routine : null,
                });
              }}
            >
              {["routine", "preference", "goal", "obligation", "exception"].map(
                (k) => (
                  <option key={k}>{k}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Title
            <input
              className={field}
              value={draft.title}
              required
              maxLength={160}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="md:col-span-2">
            Details
            <textarea
              className={field}
              value={draft.detail}
              required
              maxLength={2000}
              onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
            />
          </label>
          <label>
            Effective from
            <input
              type="date"
              className={field}
              required
              value={draft.effective_from}
              onChange={(e) =>
                setDraft({ ...draft, effective_from: e.target.value })
              }
            />
          </label>
          <label>
            Effective until (optional)
            <input
              type="date"
              className={field}
              value={draft.effective_until ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, effective_until: e.target.value || null })
              }
            />
          </label>
          {draft.routine && (
            <>
              <fieldset className="md:col-span-2 flex flex-wrap gap-4">
                <legend className="mb-2">Repeat weekly</legend>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (d, i) => (
                    <label key={d}>
                      <input
                        type="checkbox"
                        checked={draft.routine!.weekdays.includes(i + 1)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            routine: {
                              ...draft.routine!,
                              weekdays: e.target.checked
                                ? [...draft.routine!.weekdays, i + 1]
                                : draft.routine!.weekdays.filter(
                                    (n) => n !== i + 1,
                                  ),
                            },
                          })
                        }
                      />{" "}
                      {d}
                    </label>
                  ),
                )}
              </fieldset>
              <label>
                Start (local)
                <input
                  className={field}
                  type="time"
                  required
                  value={draft.routine.start}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      routine: { ...draft.routine!, start: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                End (same day)
                <input
                  className={field}
                  type="time"
                  required
                  value={draft.routine.end}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      routine: { ...draft.routine!, end: e.target.value },
                    })
                  }
                />
              </label>
              <label className="md:col-span-2">
                Timezone
                <input
                  className={field}
                  value={draft.routine.timezone}
                  required
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      routine: { ...draft.routine!, timezone: e.target.value },
                    })
                  }
                />
              </label>
            </>
          )}
          {draft.kind === "exception" && (
            <>
              <label>
                Routine
                <select
                  className={field}
                  required
                  value={draft.target_id ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, target_id: e.target.value })
                  }
                >
                  <option value="">Choose a confirmed routine</option>
                  {memories
                    .filter(
                      (m) => m.state === "confirmed" && m.kind === "routine",
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Cancelled local date
                <input
                  className={field}
                  type="date"
                  required
                  value={draft.exception_date ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      exception_date: e.target.value,
                      effective_from: e.target.value,
                      effective_until: e.target.value,
                    })
                  }
                />
              </label>
            </>
          )}
          <div className="flex gap-3 md:col-span-2">
            <button disabled={busy} className="btn-primary">
              Propose for review
            </button>
            <button
              type="button"
              className="btn-quiet"
              onClick={() => setDraft(blank())}
            >
              Reset
            </button>
          </div>
        </form>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl">Stored knowledge · {memories.length}</h2>
        {!memories.length && (
          <p className="muted">
            No memories stored. The example work schedule has not been added.
          </p>
        )}
        {memories.map((m) => (
          <article key={m.id} className="panel space-y-3 p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-bold">{m.title}</h3>
              <span>
                {m.state}
                {m.kind === "exception"
                  ? " · temporary override"
                  : ` · ${m.kind}`}
              </span>
            </div>
            <p>{m.detail}</p>
            {m.routine && (
              <p>
                {m.routine.weekdays
                  .map(
                    (d) =>
                      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d - 1],
                  )
                  .join(", ")}{" "}
                · {m.routine.start}–{m.routine.end} · {m.routine.timezone}
              </p>
            )}
            <p className="muted text-sm">
              {m.effective_from} → {m.effective_until ?? "ongoing"}
              {m.exception_date && ` · Cancel ${m.exception_date}`}
            </p>
            <details className="muted text-sm">
              <summary>Source & history</summary>
              <p>
                {m.source_kind} · {m.source_ref}
              </p>
              <blockquote className="whitespace-pre-wrap">
                {m.source_quote}
              </blockquote>
              <p>
                Created {m.created_at} · Confirmed {m.confirmed_at ?? "not yet"}
              </p>
              <p>
                ID {m.id}
                {m.supersedes_id && ` · Replaces ${m.supersedes_id}`}
                {m.target_id && ` · Routine ${m.target_id}`}
              </p>
            </details>
            <div className="flex flex-wrap gap-3">
              {["pending", "inferred"].includes(m.state) && (
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await mutate("confirm_memory_update", { id: m.id });
                      setNotice("Memory confirmed.");
                    })
                  }
                >
                  Confirm this record
                </button>
              )}
              {m.state === "confirmed" && (
                <>
                  <button
                    className="btn-quiet"
                    onClick={() => edit(m)}
                    disabled={busy}
                  >
                    Correct
                  </button>
                  {m.kind === "routine" && (
                    <button
                      className="btn-quiet"
                      disabled={busy}
                      onClick={() => cancel(m)}
                    >
                      Cancel one occurrence
                    </button>
                  )}
                </>
              )}
              {m.state !== "outdated" && (
                <button
                  className="btn-quiet"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await mutate("deactivate_memory", { id: m.id });
                      setNotice("Deactivated; historical record retained.");
                    })
                  }
                >
                  {m.state === "confirmed" ? "Deactivate" : "Reject proposal"}
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      <section className="panel space-y-4 p-6">
        <h2 className="text-xl">Upcoming availability</h2>
        <p className="muted">
          Confirmed routine blocks, displayed in Melbourne time. Other
          commitments and calendar coverage are unknown.
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              setAvailability(null);
              const start = Temporal.PlainDate.from(windowStart)
                .toZonedDateTime("Australia/Melbourne")
                .toInstant()
                .toString();
              const end = Temporal.PlainDate.from(windowEnd)
                .add({ days: 1 })
                .toZonedDateTime("Australia/Melbourne")
                .toInstant()
                .toString();
              setAvailability(
                await api("/api/memory", {
                  tool: "resolve_availability",
                  start,
                  end,
                }),
              );
            });
          }}
        >
          <label>
            From (Melbourne date)
            <input
              className={field}
              type="date"
              required
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </label>
          <label>
            Through (Melbourne date)
            <input
              className={field}
              type="date"
              required
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </label>
          <button disabled={busy} className="btn-primary">
            Check routine blocks
          </button>
        </form>
        {availability && (
          <div aria-live="polite">
            <p>{availability.note}</p>
            {!availability.busy.length && (
              <p>No confirmed routine blocks in this window.</p>
            )}
            {availability.busy.map((b) => (
              <p key={b.start} className="mt-3">
                {new Date(b.start).toLocaleString("en-AU", {
                  timeZone: "Australia/Melbourne",
                })}{" "}
                –{" "}
                {new Date(b.end).toLocaleString("en-AU", {
                  timeZone: "Australia/Melbourne",
                })}{" "}
                · {b.titles.join(", ")}
              </p>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
