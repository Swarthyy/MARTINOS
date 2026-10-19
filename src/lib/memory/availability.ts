import { Temporal } from "@js-temporal/polyfill";
import { currentMemories, MemoryError, type Memory } from "./model";
export type Busy = {
  start: string;
  end: string;
  memory_ids: string[];
  titles: string[];
};
export function resolveAvailability(
  memories: Memory[],
  start: string,
  end: string,
) {
  let from: Temporal.Instant, to: Temporal.Instant;
  try {
    from = Temporal.Instant.from(start);
    to = Temporal.Instant.from(end);
  } catch {
    throw new MemoryError("Availability requires ISO instants with offsets.");
  }
  if (
    Temporal.Instant.compare(from, to) >= 0 ||
    to.epochMilliseconds - from.epochMilliseconds > 31 * 86400000
  )
    throw new MemoryError("Choose a positive window of at most 31 days.");
  const candidates = memories.filter(
    (m) =>
      m.state === "confirmed" ||
      (m.state === "outdated" &&
        m.confirmed_at &&
        memories.some(
          (next) => next.supersedes_id === m.id && next.confirmed_at,
        )),
  );
  const busy: Busy[] = [];
  const effectiveByDate = new Map<string, Memory[]>();
  for (const m of candidates.filter((m) => m.kind === "routine" && m.routine)) {
    const r = m.routine!;
    let day = from.toZonedDateTimeISO(r.timezone).toPlainDate();
    const last = to.toZonedDateTimeISO(r.timezone).toPlainDate();
    while (Temporal.PlainDate.compare(day, last) <= 0) {
      const d = day.toString();
      let effective = effectiveByDate.get(d);
      if (!effective) {
        effective = currentMemories(memories, d);
        effectiveByDate.set(d, effective);
      }
      const cancelled = effective.some(
        (e) =>
          e.kind === "exception" &&
          e.target_id === m.id &&
          e.exception_date === d &&
          e.effective_from <= d &&
          (!e.effective_until || e.effective_until >= d),
      );
      if (
        effective.some((active) => active.id === m.id) &&
        r.weekdays.includes(day.dayOfWeek) &&
        d >= m.effective_from &&
        (!m.effective_until || d <= m.effective_until) &&
        !cancelled
      ) {
        let a: Temporal.Instant, b: Temporal.Instant;
        try {
          a = day
            .toPlainDateTime(r.start)
            .toZonedDateTime(r.timezone, { disambiguation: "reject" })
            .toInstant();
          b = day
            .toPlainDateTime(r.end)
            .toZonedDateTime(r.timezone, { disambiguation: "reject" })
            .toInstant();
        } catch {
          throw new MemoryError(
            `Routine ${m.title} has an ambiguous or nonexistent local time on ${d}; correct it before scheduling.`,
            409,
          );
        }
        const s = Math.max(a.epochMilliseconds, from.epochMilliseconds),
          e = Math.min(b.epochMilliseconds, to.epochMilliseconds);
        if (s < e)
          busy.push({
            start: Temporal.Instant.fromEpochMilliseconds(s).toString(),
            end: Temporal.Instant.fromEpochMilliseconds(e).toString(),
            memory_ids: [m.id],
            titles: [m.title],
          });
      }
      day = day.add({ days: 1 });
    }
  }
  busy.sort((a, b) => a.start.localeCompare(b.start));
  const merged: Busy[] = [];
  for (const interval of busy) {
    const previous = merged.at(-1);
    if (
      previous &&
      Temporal.Instant.compare(
        Temporal.Instant.from(interval.start),
        Temporal.Instant.from(previous.end),
      ) <= 0
    ) {
      if (
        Temporal.Instant.compare(
          Temporal.Instant.from(interval.end),
          Temporal.Instant.from(previous.end),
        ) > 0
      )
        previous.end = interval.end;
      previous.memory_ids = [
        ...new Set([...previous.memory_ids, ...interval.memory_ids]),
      ];
      previous.titles = [...new Set([...previous.titles, ...interval.titles])];
    } else merged.push({ ...interval });
  }
  const unblocked: { start: string; end: string }[] = [];
  let cursor = from.toString();
  for (const b of merged) {
    if (
      Temporal.Instant.compare(
        Temporal.Instant.from(cursor),
        Temporal.Instant.from(b.start),
      ) < 0
    )
      unblocked.push({ start: cursor, end: b.start });
    cursor = b.end;
  }
  if (Temporal.Instant.compare(Temporal.Instant.from(cursor), to) < 0)
    unblocked.push({ start: cursor, end: to.toString() });
  return {
    busy: merged,
    unblocked_by_routines: unblocked,
    calendar_coverage: "unknown" as const,
    availability: merged.length ? "blocked_in_part" : "unknown",
    note: "Routine coverage only. Unblocked time is not confirmed free; calendar and other commitments have not been checked.",
  };
}
