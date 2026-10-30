"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";

const voltar = (params: Record<string, string>): never => redirect(`/portal?${new URLSearchParams(params)}#pendencias`);
const DECISOES = ["desconto", "reembolso", "proprio"];

export async function responderDespesa(form: FormData) {
  const { supabase } = await getSessao();
  const despesa = String(form.get("despesa_id"));
  const decisao = String(form.get("decisao") ?? "");
  const comentario = String(form.get("comentario") ?? "").trim() || null;
  const { error } = await supabase.rpc("responder_despesa", {
    p_despesa: despesa,
    p_decisao: DECISOES.includes(decisao) ? decisao : null,
    p_comentario: comentario,
  });
  if (error) voltar({ erro: error.message });
  revalidatePath("/", "layout");
  voltar({ ok: decisao ? "Resposta enviada à imobiliária." : "Resposta desfeita." });
}

export async function descontarTodas(form: FormData) {
  const { supabase } = await getSessao();
  const ids = form.getAll("despesa_id").map(String);
  for (const id of ids) {
    const { error } = await supabase.rpc("responder_despesa", { p_despesa: id, p_decisao: "desconto", p_comentario: null });
    if (error) voltar({ erro: error.message });
  }
  revalidatePath("/", "layout");
  voltar({ ok: `${ids.length} despesa${ids.length > 1 ? "s" : ""} marcada${ids.length > 1 ? "s" : ""} para desconto no repasse.` });
}

export async function informarReembolso(form: FormData) {
  const { supabase } = await getSessao();
  const concluido = form.get("concluido") === "1";
  const { error } = await supabase.rpc("informar_reembolso", { p_despesa: String(form.get("despesa_id")), p_concluido: concluido });
  if (error) voltar({ erro: error.message });
  revalidatePath("/", "layout");
  voltar({ ok: concluido ? "Reembolso informado. A imobiliária vai confirmar o recebimento." : "Reembolso marcado como pendente." });
}
