import { serverSupabase, isConfigured } from "./supabase";

export function isOwnerConfigured() {
  return isConfigured() && Boolean(process.env.MARTIN_OS_ALLOWED_EMAIL);
}

export async function ownerSession() {
  if (!isOwnerConfigured()) return null;
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.email?.toLowerCase() !== process.env.MARTIN_OS_ALLOWED_EMAIL!.toLowerCase()) return null;
  return { supabase, user };
}
