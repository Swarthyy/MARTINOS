import { redirect } from "next/navigation";
import { ownerSession, isOwnerConfigured } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isOwnerConfigured()) redirect("/");
  if (await ownerSession()) redirect("/");
  return <main className="app-shell flex min-h-screen items-center justify-center p-5"><div className="panel w-full max-w-md p-8"><div className="eyebrow">Private workspace</div><h1 className="mt-3 text-3xl font-semibold">Sign in to Martin OS</h1><p className="muted mt-3 text-sm leading-6">Enter the approved email address. Supabase will send a one-time sign-in link.</p><LoginForm/></div></main>;
}
