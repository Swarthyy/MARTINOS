import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { type Connection } from "@/lib/catalog";
import { isOwnerConfigured, ownerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const configured = isOwnerConfigured();
  const session = await ownerSession();
  let connections: Connection[] = [];
  let importCount = 0;
  let schemaError = false;
  let email: string | null = null;

  if (configured && !session) redirect("/login");
  if (session) {
    const { supabase, user } = session;
    email = user.email ?? null;
    const [connectionResult, importResult] = await Promise.all([
      supabase.from("integration_connections").select("integration_key,status,last_success_at,last_error,source_method"),
      supabase.from("imports").select("id", { count: "exact", head: true })
    ]);
    schemaError = Boolean(connectionResult.error || importResult.error);
    connections = (connectionResult.data ?? []) as Connection[];
    importCount = importResult.count ?? 0;
  }

  return <Dashboard configured={configured} email={email} connections={connections} importCount={importCount} schemaError={schemaError} />;
}
