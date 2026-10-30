"use server";

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

const voltar = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);
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

    const { error: e1 } = await supabase.from("despesas").insert({
      id, condominio_id, imovel_id,
      tipo: String(form.get("tipo") ?? "variavel"),
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
    })));
    if (e2) {
      await supabase.from("despesas").delete().eq("id", id);
      throw new Error(e2.message);
    }
  } catch (e) {
    voltar(back, { erro: e instanceof Error ? e.message : "Não foi possível lançar a despesa." });
  }
  if (enviar) after(() => avisos.despesaEnviada(id!));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(`/admin/despesas/${id}`, { ok: enviar ? "Despesa enviada aos proprietários." : "Rascunho salvo." });
}

export async function enviarDespesa(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const { error } = await supabase.from("despesas").update({ status: "enviada", enviada_em: new Date().toISOString() }).eq("id", id).eq("status", "rascunho");
  if (error) voltar(`/admin/despesas/${id}`, { erro: error.message });
  after(() => avisos.despesaEnviada(id));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(`/admin/despesas/${id}`, { ok: "Despesa enviada aos proprietários." });
}

export async function excluirDespesa(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
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
