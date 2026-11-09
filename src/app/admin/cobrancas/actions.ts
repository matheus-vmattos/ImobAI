"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { guardarComprovantes } from "@/lib/arquivos";
import { exigirAdmin } from "@/lib/auth";
import * as avisos from "@/lib/avisos";
import { confirmarPagamento, estornarItens, gerarCobrancas, lancarAjuste } from "@/lib/cobrancas";
import { numero, obrigatorio, texto } from "@/lib/form";
import { BRL } from "@/lib/format";

const voltar = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);
const msg = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
const FORMAS = ["deposito", "pix", "transferencia", "outro"];
const atualizar = () => { revalidatePath("/admin", "layout"); revalidatePath("/portal", "layout"); };

export async function gerarAgora() {
  const { supabase } = await exigirAdmin();
  let criadas: string[] = [];
  try { criadas = await gerarCobrancas(supabase); } catch (e) { voltar("/admin/cobrancas", { erro: msg(e) }); }
  if (criadas.length) after(() => avisos.cobrancasEmitidas(criadas));
  atualizar();
  voltar("/admin/cobrancas", { ok: criadas.length ? `${criadas.length} cobrança${criadas.length > 1 ? "s" : ""} gerada${criadas.length > 1 ? "s" : ""} e enviada${criadas.length > 1 ? "s" : ""}.` : "Nada pendente para cobrar." });
}

/** Pagamento que a imobiliária viu no banco (sem comprovante do proprietário): já entra conferido. */
export async function registrarPagamento(form: FormData) {
  const { supabase } = await exigirAdmin();
  const back = "/admin/cobrancas";
  let resumo = "";
  try {
    const pagador_id = obrigatorio(form, "pagador_id", "Proprietário");
    const valor = numero(form, "valor");
    if (!valor || valor <= 0) throw new Error("Informe o valor.");
    const forma = String(form.get("forma"));
    const comprovantes = await guardarComprovantes(form.getAll("comprovantes"), pagador_id);
    const { data: p, error } = await supabase.from("pagamentos").insert({
      pagador_id, valor, data: texto(form, "data") ?? new Date().toISOString().slice(0, 10), forma: FORMAS.includes(forma) ? forma : "outro",
      comprovantes, observacao: texto(form, "observacao"), informado_por: "imobiliaria",
    }).select("id").single();
    if (error) throw new Error(error.message);
    const r = await confirmarPagamento(supabase, p!.id, valor, form.get("abonar") !== "nao");
    resumo = `Pagamento de ${BRL(valor)} registrado.` + (r.abonado ? ` Diferença de ${BRL(r.abonado)} abonada.` : "") + (r.credito ? ` ${BRL(r.credito)} ficou de crédito.` : "");
    after(() => avisos.pagamentoConfirmado(p!.id));
  } catch (e) { voltar(back, { erro: msg(e) }); }
  atualizar();
  voltar(back, { ok: resumo });
}

export async function conferirPagamento(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  let resumo = "";
  try {
    const valor = numero(form, "valor") ?? 0;
    const r = await confirmarPagamento(supabase, id, valor, form.get("abonar") !== "nao");
    resumo = `Pagamento confirmado: ${BRL(r.alocado)} baixados.` + (r.abonado ? ` Diferença de ${BRL(r.abonado)} abonada.` : "") + (r.credito ? ` ${BRL(r.credito)} ficou de crédito.` : "");
    after(() => avisos.pagamentoConfirmado(id));
  } catch (e) { voltar(`/admin/cobrancas/pagamento/${id}`, { erro: msg(e) }); }
  atualizar();
  voltar("/admin/cobrancas", { ok: resumo });
}

export async function recusarPagamento(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const motivo = texto(form, "motivo") ?? "Comprovante não confere com o extrato.";
  const { error } = await supabase.from("pagamentos").update({ status: "recusado", motivo_recusa: motivo }).eq("id", id).eq("status", "informado");
  if (error) voltar(`/admin/cobrancas/pagamento/${id}`, { erro: error.message });
  after(() => avisos.pagamentoRecusado(id));
  atualizar();
  voltar("/admin/cobrancas", { ok: "Comprovante recusado. O proprietário foi avisado." });
}

export async function ajusteManual(form: FormData) {
  const { supabase, user } = await exigirAdmin();
  const pagador = String(form.get("pagador_id"));
  const back = String(form.get("voltar") || "/admin/cobrancas");
  try {
    const valor = numero(form, "valor");
    if (!valor) throw new Error("Informe o valor do ajuste.");
    const sinal = form.get("sinal") === "credito" ? -1 : 1;
    await lancarAjuste(supabase, pagador, obrigatorio(form, "descricao", "Descrição"), sinal * Math.abs(valor), user.id);
  } catch (e) { voltar(back, { erro: msg(e) }); }
  atualizar();
  voltar(back, { ok: "Ajuste lançado. Entra na próxima cobrança." });
}

export async function estornarLinha(form: FormData) {
  const { supabase, user } = await exigirAdmin();
  const back = String(form.get("voltar"));
  try {
    const n = await estornarItens(supabase, [String(form.get("item_id"))], texto(form, "motivo") ?? "corrigido pela imobiliária", user.id);
    if (!n) throw new Error("Esta conta não está em nenhuma cobrança.");
  } catch (e) { voltar(back, { erro: msg(e) }); }
  atualizar();
  voltar(back, { ok: "Estorno lançado como crédito na próxima cobrança." });
}

export async function salvarConfig(form: FormData) {
  const { supabase } = await exigirAdmin();
  const { error } = await supabase.from("config").update({
    favorecido: texto(form, "favorecido"), banco: texto(form, "banco"), pix: texto(form, "pix"),
    abono_ate: numero(form, "abono_ate") ?? 5,
    cobranca_dia: Math.min(6, Math.max(0, Number(form.get("cobranca_dia") ?? 1))),
    cobranca_prazo: Math.max(1, numero(form, "cobranca_prazo") ?? 7),
  }).eq("id", true);
  if (error) voltar("/admin/configuracoes", { erro: error.message });
  atualizar();
  voltar("/admin/configuracoes", { ok: "Configurações salvas." });
}
