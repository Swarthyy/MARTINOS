import { MemoryError } from "./model";
export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
};
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
export async function readBody(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new MemoryError("Same-origin owner request required.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new MemoryError("JSON required.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new MemoryError("Request body required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32000) {
      await reader.cancel();
      throw new MemoryError("Request too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new MemoryError("Invalid JSON.");
  }
}
export function errorResponse(error: unknown) {
  return error instanceof MemoryError
    ? json({ message: error.message }, error.status)
    : json({ message: "Memory service unavailable." }, 503);
}
