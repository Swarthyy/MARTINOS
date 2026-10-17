import { createHash, timingSafeEqual } from "node:crypto";
import { getUpBankSnapshot, UpBankError } from "@/lib/bank/up";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: responseHeaders });
}

function validActionKey(request: Request, configuredKey: string) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || configuredKey.length < 32) return false;
  const supplied = header.slice(7);
  const expectedHash = createHash("sha256").update(configuredKey).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}

export async function GET(request: Request) {
  const actionKey = process.env.MARTIN_OS_ACTION_KEY;
  const bankToken = process.env.UP_API_TOKEN;
  if (!actionKey || !bankToken) return json({ error: "Bank API is not configured." }, 503);
  if (!validActionKey(request, actionKey)) return json({ error: "Unauthorized." }, 401);
  const url = new URL(request.url);
  const rawDays = url.searchParams.get("days") ?? "30";
  if (!/^\d{1,2}$/.test(rawDays)) return json({ error: "days must be an integer from 1 to 90." }, 400);
  try {
    const snapshot = await getUpBankSnapshot(bankToken, Number(rawDays));
    return json(snapshot, 200);
  } catch (error) {
    if (error instanceof UpBankError) return json({ error: error.message }, error.status);
    return json({ error: "Bank API failed." }, 503);
  }
}
