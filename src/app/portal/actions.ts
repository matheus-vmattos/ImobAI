"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import { numero } from "@/lib/form";

const voltar = (params: Record<string, string>, ancora = "pendencias", path = "/portal"): never =>
  redirect(`${path}?${new URLSearchParams(params)}#${ancora}`);
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

const RENOVACAO = ["atual", "novo_valor", "nao_renovar"];

export async function responderRenovacao(form: FormData) {
  const { supabase } = await getSessao();
  const decisao = String(form.get("decisao") ?? "");
  const pedido = String(form.get("voltar") ?? "");
  const path = /^\/portal(\/|$)/.test(pedido) ? pedido : "/portal";
  const { error } = await supabase.rpc("responder_renovacao", {
    p_contrato: String(form.get("contrato_id")),
    p_decisao: RENOVACAO.includes(decisao) ? decisao : null,
    p_valor: decisao === "novo_valor" ? numero(form, "valor") : null,
    p_comentario: String(form.get("comentario") ?? "").trim() || null,
  });
  if (error) voltar({ erro: error.message }, "renovacoes", path);
  revalidatePath("/", "layout");
  voltar({ ok: !decisao ? "Resposta desfeita." : decisao === "nao_renovar" ? "Registrado: não renovar. A imobiliária vai avisar o inquilino." : "Resposta de renovação enviada à imobiliária." }, "renovacoes", path);
}
