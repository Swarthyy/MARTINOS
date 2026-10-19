import { Temporal } from "@js-temporal/polyfill";

export type Routine = {
  weekdays: number[];
  start: string;
  end: string;
  timezone: string;
};
export type MemoryDraft = {
  kind: "routine" | "preference" | "goal" | "obligation" | "exception";
  title: string;
  detail: string;
  effective_from: string;
  effective_until: string | null;
  routine: Routine | null;
  target_id: string | null;
  exception_date: string | null;
  source_kind: "owner" | "conversation" | "inference";
  source_ref: string;
  source_quote: string;
  supersedes_id: string | null;
};
export type Memory = MemoryDraft & {
  id: string;
  user_id: string;
  state: "pending" | "inferred" | "confirmed" | "outdated";
  created_at: string;
  confirmed_at: string | null;
};
export class MemoryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new MemoryError("Expected an object.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new MemoryError(`Text must contain 1–${max} characters.`);
  return value.trim();
}
export function uuid(value: unknown): string {
  const result = text(value, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    throw new MemoryError("Invalid record ID.");
  return result;
}
export function date(value: unknown): string {
  const result = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || result.startsWith("0000"))
    throw new MemoryError("Use an ISO date.");
  try {
    Temporal.PlainDate.from(result);
  } catch {
    throw new MemoryError("Invalid date.");
  }
  return result;
}
export function validateDraft(value: unknown): MemoryDraft {
  const x = object(value);
  const kind = text(x.kind);
  if (
    !["routine", "preference", "goal", "obligation", "exception"].includes(kind)
  )
    throw new MemoryError("Invalid memory kind.");
  const effective_from = date(x.effective_from);
  const effective_until = x.effective_until ? date(x.effective_until) : null;
  if (effective_until && effective_until < effective_from)
    throw new MemoryError("End date precedes start date.");
  const source_kind = text(x.source_kind);
  if (!["owner", "conversation", "inference"].includes(source_kind))
    throw new MemoryError("Invalid source kind.");
  let routine: Routine | null = null;
  if (kind === "routine") {
    const r = object(x.routine);
    if (
      !Array.isArray(r.weekdays) ||
      !r.weekdays.length ||
      r.weekdays.length > 7 ||
      r.weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
    )
      throw new MemoryError("Select weekdays 1 (Monday) to 7 (Sunday).");
    const start = text(r.start, 5),
      end = text(r.end, 5),
      timezone = text(r.timezone, 100);
    if (
      ![start, end].every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) ||
      end <= start
    )
      throw new MemoryError(
        "Use same-day times with end after start. Split overnight routines.",
      );
    if (/^[+-]/.test(timezone))
      throw new MemoryError("Use an IANA timezone, not a fixed offset.");
    try {
      Temporal.Now.zonedDateTimeISO(timezone);
    } catch {
      throw new MemoryError("Invalid IANA timezone.");
    }
    routine = {
      weekdays: [...new Set(r.weekdays as number[])].sort(),
      start,
      end,
      timezone,
    };
  }
  const target_id = kind === "exception" ? uuid(x.target_id) : null;
  const exception_date = kind === "exception" ? date(x.exception_date) : null;
  if (
    exception_date &&
    (exception_date < effective_from ||
      (effective_until && exception_date > effective_until))
  )
    throw new MemoryError("Exception must be inside its effective dates.");
  return {
    kind: kind as MemoryDraft["kind"],
    title: text(x.title, 160),
    detail: text(x.detail),
    effective_from,
    effective_until,
    routine,
    target_id,
    exception_date,
    source_kind: source_kind as MemoryDraft["source_kind"],
    source_ref: text(x.source_ref, 200),
    source_quote: text(x.source_quote),
    supersedes_id: x.supersedes_id ? uuid(x.supersedes_id) : null,
  };
}
export function currentMemories(memories: Memory[], on: string) {
  const successors = new Map(memories.filter(m => m.supersedes_id && m.confirmed_at).map(m => [m.supersedes_id!, m]));
  return memories.filter((m) => {
    if (m.effective_from > on || (m.effective_until && m.effective_until < on))
      return false;
    let successor = successors.get(m.id);
    let cutoff = successor?.effective_from;
    const visited = new Set<string>();
    while (successor && !visited.has(successor.id)) {
      visited.add(successor.id);
      if (!cutoff || successor.effective_from < cutoff) cutoff = successor.effective_from;
      successor = successors.get(successor.id);
    }
    if (cutoff && on >= cutoff) return false;
    return (
      m.state === "confirmed" ||
      (m.state === "outdated" &&
        Boolean(m.confirmed_at) &&
        Boolean(cutoff) &&
        on < cutoff!)
    );
  });
}
