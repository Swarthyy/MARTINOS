import { ownerSession } from "@/lib/auth";
import { memoryTools, supabaseMemoryStore } from "@/lib/memory/service";
import { object, text, uuid } from "@/lib/memory/model";
import { errorResponse, json, readBody } from "@/lib/memory/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = await ownerSession();
    if (!session) return json({ message: "Owner sign-in required." }, 401);
    return json({
      memories: await supabaseMemoryStore(
        session.supabase,
        session.user.id,
      ).list(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const session = await ownerSession();
    if (!session) return json({ message: "Owner sign-in required." }, 401);
    const body = object(await readBody(request));
    const tools = memoryTools(
      supabaseMemoryStore(session.supabase, session.user.id),
    );
    switch (body.tool) {
      case "get_operating_context":
        return json(
          await tools.get_operating_context(
            typeof body.on === "string" ? body.on : undefined,
          ),
        );
      case "retrieve_relevant_memories":
        return json(
          await tools.retrieve_relevant_memories(text(body.query, 200)),
        );
      case "propose_memory_update":
        return json(await tools.propose_memory_update(body.draft));
      case "confirm_memory_update":
        return json(await tools.confirm_memory_update(uuid(body.id), true));
      case "correct_memory":
        return json(await tools.correct_memory(uuid(body.id), body.draft));
      case "deactivate_memory":
        return json(await tools.deactivate_memory(uuid(body.id)));
      case "resolve_availability":
        return json(
          await tools.resolve_availability(
            text(body.start, 100),
            text(body.end, 100),
          ),
        );
      default:
        return json({ message: "Unknown memory tool." }, 400);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
