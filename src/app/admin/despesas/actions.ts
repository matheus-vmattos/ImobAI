"use server";

import { hojeSP } from "@/lib/format";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as avisos from "@/lib/avisos";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { numero, obrigatorio, texto } from "@/lib/form";
import { calcularRateio, type Regra, type UnidadeRateio } from "@/lib/rateio";
import { createServiceClient } from "@/lib/supabase/server";
import { carregarCarteira } from "./dados";
import { aplicarDecisoesAutomaticas, marcaRateio, responsaveis } from "@/lib/decisoes";
import { estornarItens } from "@/lib/cobrancas";
import { enviarDespesa as enviarLancamento, gravarItens, gravarTerceiros, guardarPdf, lancar, ratear } from "@/lib/lancamento";

const voltar = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);
const checar = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
const BUCKET = "despesas";
const MAX_PDF = 10 * 1024 * 1024;

export async function lancarDespesa(form: FormData) {
  const { supabase, user } = await exigirAdmin();
  const back = "/admin/despesas/nova";
  let id: string | null = null;
  let enviar = false;
  try {
    const destino = String(form.get("destino"));
    const total = numero(form, "valor_total");
    if (total == null || total <= 0) throw new Error("Informe o valor total.");
    enviar = form.get("enviar") === "1";
    const cobraTaxa = form.get("cobra_taxa") === "on";

    // o rateio é recalculado aqui com os donos do banco; do formulário só vêm as quantidades
    const { condominios, imoveis } = await carregarCarteira(supabase);
    let regra: Regra;
    let divisor: number | null = null;
    let unidades: UnidadeRateio[];
    let condominio_id: string | null = null;
    let imovel_id: string | null = null;

    if (destino === "avulso") {
      imovel_id = obrigatorio(form, "imovel_id", "Imóvel");
      const im = imoveis.find((i) => i.id === imovel_id);
      if (!im) throw new Error("Imóvel não encontrado.");
      regra = "integral";
      unidades = [{ imovelId: im.id, quantidade: 1, donos: im.donos }];
    } else {
      condominio_id = obrigatorio(form, "condominio_id", "Condomínio");
      const c = condominios.find((x) => x.id === condominio_id);
      if (!c) throw new Error("Condomínio não encontrado.");
      regra = String(form.get("regra")) as Regra;
      if (!["cotas", "percentual", "fixo"].includes(regra)) throw new Error("Regra de rateio inválida.");
      divisor = regra === "cotas" ? numero(form, "divisor") : null;
      const ids = form.getAll("unidade_id").map(String);
      const qts = form.getAll("quantidade").map((v) => Number(String(v).replace(",", ".")));
      unidades = ids.map((uid, i) => {
        const u = c.unidades.find((x) => x.id === uid);
        if (!u) throw new Error("Unidade não pertence a este condomínio.");
        return { imovelId: u.id, quantidade: qts[i] || 0, donos: u.donos };
      });
    }

    const taxaDe = (imId: string) => imoveis.find((i) => i.id === imId)?.taxa ?? 10;
    const r = calcularRateio({ total, regra, divisor, unidades, cobraTaxa, taxaPct: taxaDe });
    if (r.erro) throw new Error(r.erro);

    id = randomUUID();
    let pdf_path: string | null = null;
    const pdf = form.get("pdf");
    if (pdf instanceof File && pdf.size > 0) {
      if (pdf.type !== "application/pdf") throw new Error("O anexo precisa ser um PDF.");
      if (pdf.size > MAX_PDF) throw new Error("PDF maior que 10 MB.");
      pdf_path = `${id}.pdf`;
      const { error } = await createServiceClient().storage.from(BUCKET).upload(pdf_path, pdf, { contentType: "application/pdf" });
      if (error) throw new Error("Falha ao enviar o PDF: " + error.message);
    }

    const tipo = String(form.get("tipo") ?? "variavel");
    const rateada = await marcaRateio(supabase, { condominioId: condominio_id, imovelId: imovel_id }, tipo, texto(form, "rateio_inquilinos"));
    const resp = await responsaveis(supabase, tipo, r.itens.map((i) => i.imovelId), rateada);
    const { error: e1 } = await supabase.from("despesas").insert({
      id, condominio_id, imovel_id, tipo, rateada_inquilinos: rateada,
      requer_aprovacao: form.get("requer_aprovacao") === "on",
      unidades: unidades.map((u) => ({ imovelId: u.imovelId, quantidade: u.quantidade })),
      descricao: obrigatorio(form, "descricao", "Descrição"),
      competencia: texto(form, "competencia"),
      valor_total: total, regra, divisor, valor_fora: r.fora,
      cobra_taxa_adm: cobraTaxa, pdf_path,
      prazo: texto(form, "prazo"),
      status: enviar ? "enviada" : "rascunho",
      enviada_em: enviar ? new Date().toISOString() : null,
      created_by: user.id,
    });
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabase.from("despesa_itens").insert(r.itens.map((i) => ({
      despesa_id: id, imovel_id: i.imovelId, proprietario_id: i.proprietarioId,
      cotas: i.quantidade, percentual_dono: i.percentualDono, valor: i.valor, taxa_adm: i.taxaAdm,
      responsavel: resp.get(i.imovelId)?.responsavel ?? "proprietario", volta_inquilino: resp.get(i.imovelId)?.volta ?? false,
    })));
    if (e2) {
      await supabase.from("despesas").delete().eq("id", id);
      throw new Error(e2.message);
    }
    await gravarTerceiros(supabase, id, condominio_id, r.fora, { regra, divisor, total });
  } catch (e) {
    voltar(back, { erro: e instanceof Error ? e.message : "Não foi possível lançar a despesa." });
  }
  if (enviar) {
    const precisam = await aplicarDecisoesAutomaticas(supabase, id!);
    if (precisam.length) after(() => avisos.despesaEnviada(id!, precisam));
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(`/admin/despesas/${id}`, { ok: enviar ? "Despesa enviada aos proprietários." : "Rascunho salvo." });
}

export async function enviarDespesa(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const { error } = await supabase.from("despesas").update({ status: "enviada", enviada_em: new Date().toISOString() }).eq("id", id).eq("status", "rascunho");
  if (error) voltar(`/admin/despesas/${id}`, { erro: error.message });
  const precisam = await aplicarDecisoesAutomaticas(supabase, id);
  if (precisam.length) after(() => avisos.despesaEnviada(id, precisam));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(`/admin/despesas/${id}`, { ok: "Despesa enviada aos proprietários." });
}

export async function excluirDespesa(form: FormData) {
  const { supabase, user } = await exigirAdmin();
  const id = String(form.get("id"));
  // o que já foi cobrado volta como crédito na próxima cobrança
  const { data: cobrados } = await supabase.from("despesa_itens").select("id").eq("despesa_id", id).not("cobranca_id", "is", null);
  if (cobrados?.length) await estornarItens(supabase, cobrados.map((i) => i.id), "despesa excluída", user.id);
  const { data: d } = await supabase.from("despesas").select("pdf_path").eq("id", id).single();
  const { error } = await supabase.from("despesas").delete().eq("id", id);
  if (error) voltar(`/admin/despesas/${id}`, { erro: error.message });
  if (d?.pdf_path) await createServiceClient().storage.from(BUCKET).remove([d.pdf_path]);
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar("/admin/despesas", { ok: "Despesa excluída." });
}

export async function confirmarReembolso(form: FormData) {
  const { supabase } = await exigirAdmin();
  const despesa = String(form.get("despesa_id"));
  const prop = String(form.get("proprietario_id"));
  const pedido = String(form.get("voltar") ?? "");
  const back = /^\/admin(\/|$)/.test(pedido) ? pedido : `/admin/despesas/${despesa}`;
  const { error } = await supabase.from("despesa_itens")
    .update({ reembolso: "confirmado", reembolso_confirmado_em: new Date().toISOString() })
    .eq("despesa_id", despesa).eq("proprietario_id", prop).eq("decisao", "reembolso").in("reembolso", ["pendente", "informado"]);
  if (error) voltar(back, { erro: error.message });
  after(() => avisos.reembolsoConfirmado(despesa, prop));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(back, { ok: "Recebimento confirmado." });
}

/** Conta mensal de valor variável: informa o valor do mês, rateia e envia. */
export async function completarDespesa(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const back = `/admin/despesas/${id}`;
  try {
    const valor = numero(form, "valor");
    if (!valor || valor <= 0) throw new Error("Informe o valor.");
    const { data: d } = await supabase.from("despesas").select("*").eq("id", id).eq("status", "rascunho").single();
    if (!d) throw new Error("Rascunho não encontrado.");
    const { r, regra, divisor, unidades } = await ratear(supabase, { condominioId: d.condominio_id, imovelId: d.imovel_id, regra: d.regra, divisor: d.divisor, unidades: d.unidades }, valor, d.cobra_taxa_adm);
    const pdf_path = (await guardarPdf(form.get("pdf"), id)) ?? d.pdf_path;
    await supabase.from("despesa_itens").delete().eq("despesa_id", id);
    const { error } = await supabase.from("despesas").update({ valor_total: valor, valor_fora: r.fora, regra, divisor, unidades, pdf_path, prazo: texto(form, "prazo") }).eq("id", id);
    if (error) throw new Error(error.message);
    await gravarItens(supabase, id, d.tipo, r.itens, d.rateada_inquilinos);
    await gravarTerceiros(supabase, id, d.condominio_id, r.fora, { regra, divisor, total: valor });
    const precisam = await enviarLancamento(supabase, id);
    if (precisam.length) after(() => avisos.despesaEnviada(id, precisam));
  } catch (e) { voltar(back, { erro: e instanceof Error ? e.message : "Não foi possível enviar." }); }
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(back, { ok: "Valor informado e despesa enviada." });
}

/** Vários PDFs de uma vez (ex.: boletos de condomínio de cada unidade): cada linha vira uma despesa do imóvel. */
export async function lancarLote(form: FormData) {
  const { supabase, user } = await exigirAdmin();
  const back = "/admin/despesas/lote";
  const pdfs = form.getAll("pdf");
  const imoveis = form.getAll("imovel_id").map(String);
  const descricoes = form.getAll("descricao").map(String);
  const valores = form.getAll("valor").map((v) => Number(String(v).replace(/\./g, "").replace(",", ".")));
  const tipos = form.getAll("tipo").map(String);
  const prazo = texto(form, "prazo");
  const competencia = texto(form, "competencia");
  let n = 0;
  try {
    if (!imoveis.length) throw new Error("Adicione pelo menos um PDF.");
    imoveis.forEach((im, i) => {
      if (!im) throw new Error(`Linha ${i + 1}: escolha o imóvel.`);
      if (!(valores[i] > 0)) throw new Error(`Linha ${i + 1}: informe o valor.`);
    });
    for (let i = 0; i < imoveis.length; i++) {
      const { id, precisam } = await lancar(supabase, {
        destino: { condominioId: null, imovelId: imoveis[i], regra: "integral", divisor: null, unidades: null },
        tipo: tipos[i] || "condominio", descricao: descricoes[i] || "Conta", total: valores[i], cobraTaxa: false,
        competencia, prazo, pdf: pdfs[i] ?? null, criadoPor: user.id,
      });
      if (precisam.length) after(() => avisos.despesaEnviada(id, precisam));
      n++;
    }
  } catch (e) { voltar(back, { erro: (n ? `${n} lançadas antes do erro. ` : "") + (e instanceof Error ? e.message : "Falha no lote.") }); }
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar("/admin/despesas", { ok: `${n} despesas lançadas e enviadas.` });
}

export async function terceiroRecebido(form: FormData) {
  const { supabase } = await exigirAdmin();
  const back = String(form.get("voltar"));
  const recebido = form.get("recebido") === "1";
  const { error } = await supabase.from("despesa_terceiros").update({ recebido_em: recebido ? hojeSP() : null }).eq("id", String(form.get("id")));
  if (error) voltar(back, { erro: error.message });
  revalidatePath("/admin", "layout");
  voltar(back, { ok: recebido ? "Recebimento do terceiro registrado." : "Recebimento desfeito." });
}

/** Troca a marca "rateada com os inquilinos" / "do proprietário" e refaz o que volta pelo inquilino
 *  (só nas partes que ainda não foram lançadas no boleto). */
export async function alterarRateio(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const back = `/admin/despesas/${id}`;
  const rateada = form.get("rateada") === "1";
  try {
    const { data: d } = await supabase.from("despesas").select("tipo").eq("id", id).single();
    if (!d) throw new Error("Despesa não encontrada.");
    checar((await supabase.from("despesas").update({ rateada_inquilinos: rateada }).eq("id", id)).error);
    const { data: its } = await supabase.from("despesa_itens").select("id, imovel_id").eq("despesa_id", id).is("inquilino_lancado_em", null);
    const resp = await responsaveis(supabase, d.tipo, (its ?? []).map((i) => i.imovel_id as string), rateada);
    for (const i of its ?? []) checar((await supabase.from("despesa_itens").update({ volta_inquilino: resp.get(i.imovel_id as string)?.volta ?? false }).eq("id", i.id)).error);
  } catch (e) { voltar(back, { erro: e instanceof Error ? e.message : "Não foi possível alterar." }); }
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(back, { ok: rateada ? "Marcada como rateada com os inquilinos." : "Marcada como despesa do proprietário." });
}

/** Resposta da imobiliária a um questionamento do proprietário. */
export async function responderQuestionamento(form: FormData) {
  const { supabase } = await exigirAdmin();
  const despesa = String(form.get("despesa_id"));
  const resposta = texto(form, "resposta");
  if (!resposta) voltar(`/admin/despesas/${despesa}`, { erro: "Escreva a resposta." });
  const { error } = await supabase.from("despesa_questionamentos").update({ resposta, respondido_em: new Date().toISOString() }).eq("id", String(form.get("id")));
  if (error) voltar(`/admin/despesas/${despesa}`, { erro: error.message });
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(`/admin/despesas/${despesa}`, { ok: "Resposta enviada ao proprietário." });
}
