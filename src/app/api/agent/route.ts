import { ownerSession } from "@/lib/auth";
import {
  openAIProvider,
  runAgent,
  supabaseSessionStore,
} from "@/lib/memory/agent";
import { supabaseMemoryStore } from "@/lib/memory/service";
import { object, text, uuid } from "@/lib/memory/model";
import { errorResponse, json, readBody } from "@/lib/memory/http";
export const maxDuration = 240;
export async function POST(request: Request) {
  try {
    const session = await ownerSession();
    if (!session) return json({ message: "Owner sign-in required." }, 401);
    const body = object(await readBody(request));
    if (!process.env.OPENAI_API_KEY || !process.env.MARTIN_OS_OPENAI_MODEL)
      return json(
        {
          message:
            "Configure the server OpenAI key and model to enable conversations.",
        },
        503,
      );
    return json(
      await runAgent(
        {
          message: text(body.message, 8000),
          sessionId: body.session_id ? uuid(body.session_id) : undefined,
          model: process.env.MARTIN_OS_OPENAI_MODEL,
        },
        supabaseSessionStore(session.supabase, session.user.id),
        supabaseMemoryStore(session.supabase, session.user.id),
        openAIProvider(process.env.OPENAI_API_KEY),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
