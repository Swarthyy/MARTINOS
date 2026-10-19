import { Temporal } from "@js-temporal/polyfill";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  currentMemories,
  date,
  MemoryError,
  text,
  uuid,
  validateDraft,
  type Memory,
} from "./model";
import { resolveAvailability } from "./availability";

export type MemoryStore = {
  list(): Promise<Memory[]>;
  propose(draft: ReturnType<typeof validateDraft>): Promise<Memory>;
  confirm(id: string): Promise<Memory>;
  deactivate(id: string): Promise<Memory>;
};
export function supabaseMemoryStore(
  db: SupabaseClient,
  owner: string,
): MemoryStore {
  function checked<T>(data: T | null, error: unknown): T {
    if (error || data === null)
      throw new MemoryError(
        "Memory storage unavailable or record changed. Reload and try again.",
        503,
      );
    return data;
  }
  return {
    async list() {
      // Fetch all versions for correct precedence. Fail rather than silently truncate routines.
      const { data, error } = await db
        .from("operating_memories")
        .select("*")
        .eq("user_id", owner)
        .order("created_at", { ascending: false })
        .limit(1000);
      const rows = checked(data, error) as Memory[];
      if (rows.length === 1000)
        throw new MemoryError(
          "Memory capacity requires pagination before scheduling.",
          503,
        );
      return rows;
    },
    async propose(draft) {
      const { data, error } = await db
        .from("operating_memories")
        .insert({
          ...draft,
          user_id: owner,
          state: draft.source_kind === "inference" ? "inferred" : "pending",
        })
        .select("*")
        .single();
      return checked(data, error) as Memory;
    },
    async confirm(id) {
      const { data, error } = await db.rpc("confirm_memory_update", {
        p_id: uuid(id),
      });
      return checked(data, error) as Memory;
    },
    async deactivate(id) {
      const { data, error } = await db
        .from("operating_memories")
        .update({ state: "outdated" })
        .eq("user_id", owner)
        .eq("id", uuid(id))
        .select("*")
        .single();
      return checked(data, error) as Memory;
    },
  };
}
export function memoryTools(
  store: MemoryStore,
  source?: { ref: string; quote: string },
) {
  async function propose(value: unknown) {
    const draft = validateDraft(value);
    if (source) {
      draft.source_kind = "conversation";
      draft.source_ref = source.ref;
      draft.source_quote = source.quote.slice(0, 2000);
    }
    if (draft.supersedes_id || draft.target_id) {
      const records = await store.list();
      const target = records.find(
        (m) => m.id === (draft.supersedes_id || draft.target_id),
      );
      if (!target || target.state !== "confirmed")
        throw new MemoryError("Choose a current confirmed record.");
      if (draft.supersedes_id && target.kind !== draft.kind)
        throw new MemoryError("Corrections must retain the memory kind.");
      if (draft.target_id && target.kind !== "routine")
        throw new MemoryError("Exceptions require a routine.");
    }
    return store.propose(draft);
  }
  return {
    async get_operating_context(
      on = Temporal.Now.plainDateISO("Australia/Melbourne").toString(),
    ) {
      const all = await store.list();
      const active = currentMemories(all, date(on));
      return {
        on,
        confirmed: active.slice(0, 40),
        pending_count: all.filter((m) =>
          ["pending", "inferred"].includes(m.state),
        ).length,
        more_available: active.length > 40,
        calendar_coverage: "unknown",
      };
    },
    async retrieve_relevant_memories(query: string) {
      const words = text(query, 200).toLowerCase().split(/\s+/);
      return (await store.list())
        .filter((m) =>
          words.some((w) =>
            `${m.title} ${m.detail} ${m.kind}`.toLowerCase().includes(w),
          ),
        )
        .slice(0, 40);
    },
    propose_memory_update: propose,
    async confirm_memory_update(id: string, ownerReview: boolean) {
      if (!ownerReview)
        throw new MemoryError("Direct owner review is required.", 403);
      return store.confirm(uuid(id));
    },
    async correct_memory(id: string, value: unknown) {
      return propose({ ...validateDraft(value), supersedes_id: uuid(id) });
    },
    async resolve_availability(start: string, end: string) {
      return resolveAvailability(await store.list(), start, end);
    },
    async deactivate_memory(id: string) {
      return store.deactivate(uuid(id));
    },
  };
}
