"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      setStatus(error ? error.message : "Check your email for the sign-in link.");
    } catch { setStatus("Could not send the link. Check the Supabase configuration."); }
    finally { setSending(false); }
  }

  return <form className="mt-7 space-y-4" onSubmit={send}><label className="block text-xs text-[#b6c8bb]" htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}/><button className="btn-primary w-full" disabled={sending}>{sending ? "Sending…" : "Send sign-in link"}</button>{status && <p role="status" className="muted text-sm">{status}</p>}</form>;
}
