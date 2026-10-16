import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", url.origin));
  const supabase = await serverSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/login" : "/", url.origin));
}
