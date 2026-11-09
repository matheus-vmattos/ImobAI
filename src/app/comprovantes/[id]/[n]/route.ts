import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Abre um comprovante de pagamento. O acesso é checado pelo RLS (admin ou o pagador). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });
  const { data: p } = await supabase.from("pagamentos").select("comprovantes").eq("id", id).maybeSingle();
  const path = p?.comprovantes?.[Number(n)];
  if (!path) return new NextResponse("Comprovante não encontrado", { status: 404 });
  const { data, error } = await createServiceClient().storage.from("comprovantes").createSignedUrl(path, 120);
  if (error || !data) return new NextResponse("Não foi possível abrir o comprovante", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
