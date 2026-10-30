import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Destino dos links de convite e redefinição de senha enviados pelo Supabase. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/definir-senha";

  const supabase = await createClient();
  const { error } = token_hash && type
    ? await supabase.auth.verifyOtp({ type, token_hash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("link inválido") };

  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent("Link expirado ou inválido. Peça um novo.")}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
