import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ownerSession } from "@/lib/auth";
import { parseLatitudeCsv } from "@/lib/latitude";

export async function POST(request: NextRequest) {
  const session = await ownerSession();
  if (!session) return NextResponse.json({ message: "Sign in with the approved account before importing." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size > 5_000_000 || file.size === 0) return NextResponse.json({ message: "Choose a CSV file under 5 MB." }, { status: 400 });
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = parseLatitudeCsv(bytes.toString("utf8"));
    const occurrences = new Map<string, number>();
    const rows = parsed.map((row) => {
      const basis = row.external_id ? `id:${row.external_id}` : `${row.occurred_on}|${row.description}|${row.amount_minor}`;
      const occurrence = row.external_id ? 0 : (occurrences.get(basis) ?? 0) + 1;
      occurrences.set(basis, occurrence);
      const source_transaction_key = createHash("sha256").update(`${basis}|${occurrence}`).digest("hex");
      const { external_id: _externalId, ...data } = row;
      return { ...data, source_transaction_key };
    });
    const hash = createHash("sha256").update(bytes).digest("hex");
    const { data, error } = await session.supabase.rpc("import_latitude_statement", { p_content_sha256: hash, p_rows: rows });
    if (error) return NextResponse.json({ message: "The database import failed. Check that the schema is applied." }, { status: 500 });
    return NextResponse.json({ imported: data, message: "Import complete." });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Invalid CSV." }, { status: 400 });
  }
}
