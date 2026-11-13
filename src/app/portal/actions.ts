"use server";

import { hojeSP } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import * as avisos from "@/lib/avisos";
import { getSessao } from "@/lib/auth";
import { numero, texto } from "@/lib/form";
import { guardarComprovantes } from "@/lib/arquivos";
import { createServiceClient } from "@/lib/supabase/server";

const voltar = (params: Record<string, string>, ancora = "pendencias", path = "/portal/decidir"): never =>
  redirect(`${path}?${new URLSearchParams(params)}#${ancora}`);
const DECISOES = ["desconto", "reembolso", "proprio"];

/** Ações do portal são só do proprietário: o admin na visão do proprietário fica só olhando. */
async function sessaoDoProprietario() {
  const s = await getSessao();
  if (s.papel === "admin") redirect("/portal?erro=" + encodeURIComponent("Visão do proprietário é só leitura."));
  return s;
}

export async function responderDespesa(form: FormData) {
  const { supabase, user } = await sessaoDoProprietario();
  const despesa = String(form.get("despesa_id"));
  const decisao = String(form.get("decisao") ?? "");
  const comentario = String(form.get("comentario") ?? "").trim() || null;
  const { error } = await supabase.rpc("responder_despesa", {
    p_despesa: despesa,
    p_decisao: DECISOES.includes(decisao) ? decisao : null,
    p_comentario: comentario,
  });
  if (error) voltar({ erro: error.message });
  if (decisao) after(() => avisos.respostaDespesa([despesa], user.id));
  revalidatePath("/", "layout");
  voltar({ ok: decisao ? "Resposta enviada à imobiliária." : "Resposta desfeita." });
}

export async function descontarTodas(form: FormData) {
  const { supabase, user } = await sessaoDoProprietario();
  const ids = form.getAll("despesa_id").map(String);
  for (const id of ids) {
    const { error } = await supabase.rpc("responder_despesa", { p_despesa: id, p_decisao: "desconto", p_comentario: null });
    if (error) voltar({ erro: error.message });
  }
  after(() => avisos.respostaDespesa(ids, user.id));
  revalidatePath("/", "layout");
  voltar({ ok: `${ids.length} despesa${ids.length > 1 ? "s" : ""} marcada${ids.length > 1 ? "s" : ""} para desconto no repasse.` });
}

export async function informarReembolso(form: FormData) {
  const { supabase, user } = await sessaoDoProprietario();
  const concluido = form.get("concluido") === "1";
  const despesa = String(form.get("despesa_id"));
  const { error } = await supabase.rpc("informar_reembolso", { p_despesa: despesa, p_concluido: concluido });
  if (error) voltar({ erro: error.message });
  if (concluido) after(() => avisos.respostaDespesa([despesa], user.id));
  revalidatePath("/", "layout");
  voltar({ ok: concluido ? "Reembolso informado. A imobiliária vai confirmar o recebimento." : "Reembolso marcado como pendente." });
}

const RENOVACAO = ["atual", "novo_valor", "nao_renovar"];

export async function responderRenovacao(form: FormData) {
  const { supabase, user } = await sessaoDoProprietario();
  const contrato = String(form.get("contrato_id"));
  const decisao = String(form.get("decisao") ?? "");
  const pedido = String(form.get("voltar") ?? "");
  const path = /^\/portal(\/|$)/.test(pedido) ? pedido : "/portal/decidir";
  const { error } = await supabase.rpc("responder_renovacao", {
    p_contrato: contrato,
    p_decisao: RENOVACAO.includes(decisao) ? decisao : null,
    p_valor: decisao === "novo_valor" ? numero(form, "valor") : null,
    p_comentario: String(form.get("comentario") ?? "").trim() || null,
  });
  if (error) voltar({ erro: error.message }, "renovacoes", path);
  after(() => avisos.respostaRenovacao(contrato, user.id));
  revalidatePath("/", "layout");
  voltar({ ok: !decisao ? "Resposta desfeita." : decisao === "nao_renovar" ? "Registrado: não renovar. A imobiliária vai avisar o inquilino." : "Resposta de renovação enviada à imobiliária." }, "renovacoes", path);
}

const FORMAS = ["deposito", "pix", "transferencia", "outro"];

/** Proprietário informa um pagamento com um ou mais comprovantes; a imobiliária confere. */
export async function informarPagamento(form: FormData) {
  const { proprietarioIds } = await sessaoDoProprietario();
  const pagador = String(form.get("pagador_id"));
  const back = `/portal/pagar?${new URLSearchParams({ cobranca: String(form.get("cobranca_id") ?? "") })}`;
  let id = "";
  try {
    if (!proprietarioIds.includes(pagador)) throw new Error("Cadastro não encontrado.");
    const valor = numero(form, "valor");
    if (!valor || valor <= 0) throw new Error("Informe o valor pago.");
    const comprovantes = await guardarComprovantes(form.getAll("comprovantes"), pagador);
    if (!comprovantes.length) throw new Error("Anexe pelo menos um comprovante (foto ou PDF).");
    const forma = String(form.get("forma"));
    // gravação pelo servidor depois de conferir o dono (o RLS só deixa o proprietário ler)
    const { data, error } = await createServiceClient().from("pagamentos").insert({
      pagador_id: pagador, valor, data: texto(form, "data") ?? hojeSP(),
      forma: FORMAS.includes(forma) ? forma : "outro", comprovantes, observacao: texto(form, "observacao"), informado_por: "proprietario",
    }).select("id").single();
    if (error) throw new Error(error.message);
    id = data!.id;
  } catch (e) {
    redirect(`${back}&${new URLSearchParams({ erro: e instanceof Error ? e.message : "Não foi possível enviar." })}`);
  }
  after(() => avisos.pagamentoInformado(id));
  revalidatePath("/", "layout");
  redirect(`/portal/extrato?${new URLSearchParams({ ok: "Comprovante enviado. A imobiliária vai conferir e dar baixa." })}`);
}
