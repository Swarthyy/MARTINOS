import Link from "next/link";
import { redirect } from "next/navigation";
import { isOwnerConfigured, ownerSession } from "@/lib/auth";
import { MemoryPanel } from "@/components/memory-panel";
export const dynamic = "force-dynamic";
export default async function MemoryPage() {
  if (!isOwnerConfigured())
    return (
      <main className="mx-auto max-w-4xl p-8">
        <Link href="/">← Dashboard</Link>
        <h1 className="my-6 text-3xl">Memory & Routines</h1>
        <p>
          Configure Supabase and the owner email to store private memories. No
          example routines have been saved.
        </p>
      </main>
    );
  if (!(await ownerSession())) redirect("/login");
  return (
    <MemoryPanel
      agentConfigured={Boolean(
        process.env.OPENAI_API_KEY && process.env.MARTIN_OS_OPENAI_MODEL,
      )}
    />
  );
}
