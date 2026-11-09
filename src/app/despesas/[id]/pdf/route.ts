import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Abre o PDF de uma despesa. O acesso é checado pelo RLS (admin, proprietário com item enviado ou pagador da cobrança). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });

  let { data: d } = await supabase.from("despesas").select("pdf_path").eq("id", id).maybeSingle();
  if (!d) {
    // pagador do grupo: vê a conta porque ela está numa cobrança dele
    const { data: c } = await supabase.from("cobrancas").select("id").contains("linhas", [{ despesaId: id }]).limit(1).maybeSingle();
    if (c) ({ data: d } = await createServiceClient().from("despesas").select("pdf_path").eq("id", id).maybeSingle());
  }
  if (!d?.pdf_path) return new NextResponse("PDF não encontrado", { status: 404 });

  const { data, error } = await createServiceClient().storage.from("despesas").createSignedUrl(d.pdf_path, 120);
  if (error || !data) return new NextResponse("Não foi possível abrir o PDF", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
