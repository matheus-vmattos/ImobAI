"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import * as avisos from "@/lib/avisos";
import { BRL, data } from "@/lib/format";
import type { PostgrestError } from "@supabase/supabase-js";
import { exigirAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { numero, obrigatorio, texto } from "@/lib/form";

const voltar = (path: string, params: Record<string, string>): never =>
  redirect(`${path}?${new URLSearchParams(params)}`);

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

function checar(error: PostgrestError | null) {
  if (!error) return;
  if (error.code === "23505") throw new Error("Já existe um cadastro com esses dados (e-mail ou contrato ativo repetido).");
  if (error.code === "23503") throw new Error("Este registro está em uso por outro cadastro.");
  throw new Error(error.message);
}

/* ---------- proprietários ---------- */

export async function salvarProprietario(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = texto(form, "id");
  const back = id ? `/admin/proprietarios/${id}` : "/admin/proprietarios/novo";
  let novoId = id;
  try {
    const dados = {
      nome: obrigatorio(form, "nome", "Nome"),
      cpf_cnpj: texto(form, "cpf_cnpj"),
      email: texto(form, "email")?.toLowerCase() ?? null,
      telefone: texto(form, "telefone"),
      pix: texto(form, "pix"),
      dados_bancarios: texto(form, "dados_bancarios"),
      observacoes: texto(form, "observacoes"),
      forma_padrao: form.get("forma_padrao") === "repasse" ? "repasse" : "cobranca",
      aprova_ate: numero(form, "aprova_ate") ?? 300,
      pagador_id: texto(form, "pagador_id"),
      desconta_vencidas: form.get("desconta_vencidas") === "on",
    };
    if (id && dados.pagador_id === id) throw new Error("O pagador precisa ser outro proprietário.");
    if (id) {
      checar((await supabase.from("proprietarios").update(dados).eq("id", id)).error);
    } else {
      const { data, error } = await supabase.from("proprietarios").insert(dados).select("id").single();
      checar(error);
      novoId = data!.id;
    }
  } catch (e) {
    voltar(back, { erro: mensagem(e) });
  }
  revalidatePath("/admin", "layout");
  voltar(`/admin/proprietarios/${novoId}`, { ok: "Proprietário salvo." });
}

export async function excluirProprietario(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const { error } = await supabase.from("proprietarios").delete().eq("id", id);
  if (error) voltar(`/admin/proprietarios/${id}`, { erro: "Não foi possível excluir: " + error.message });
  revalidatePath("/admin", "layout");
  voltar("/admin/proprietarios", { ok: "Proprietário excluído." });
}

/** Envia o e-mail de convite. O vínculo com o cadastro acontece pelo e-mail (trigger no banco). */
export async function convidarProprietario(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const back = `/admin/proprietarios/${id}`;
  const { data: p } = await supabase.from("proprietarios").select("nome, email, user_id").eq("id", id).single();
  if (!p?.email) voltar(back, { erro: "Cadastre um e-mail antes de enviar o convite." });
  if (p!.user_id) voltar(back, { erro: "Este proprietário já tem acesso." });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await createServiceClient().auth.admin.inviteUserByEmail(p!.email!, {
    data: { nome: p!.nome },
    redirectTo: `${site}/auth/confirm?next=/definir-senha`,
  });
  if (error) {
    voltar(back, {
      erro: /registered|exists/i.test(error.message)
        ? "Já existe um login com esse e-mail. Peça ao proprietário para usar “Esqueci minha senha”."
        : "Falha ao enviar convite: " + error.message,
    });
  }
  voltar(back, { ok: `Convite enviado para ${p!.email}.` });
}

/** Outro login (cônjuge, sócio, contador) com acesso ao mesmo cadastro. */
export async function adicionarAcesso(form: FormData) {
  const { supabase } = await exigirAdmin();
  const proprietario_id = String(form.get("proprietario_id"));
  const back = `/admin/proprietarios/${proprietario_id}`;
  const email = texto(form, "email")?.toLowerCase();
  if (!email) voltar(back, { erro: "Informe o e-mail." });
  const { error } = await supabase.from("proprietario_acessos").insert({ proprietario_id, email, nome: texto(form, "nome") });
  if (error) voltar(back, { erro: error.code === "23505" ? "Esse e-mail já tem acesso." : error.message });
  // quem ainda não tem login recebe convite; quem já tem é vinculado na hora (gatilho no banco)
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error: e2 } = await createServiceClient().auth.admin.inviteUserByEmail(email!, {
    data: { nome: texto(form, "nome") }, redirectTo: `${site}/auth/confirm?next=/definir-senha`,
  });
  revalidatePath("/admin", "layout");
  voltar(back, { ok: e2 && /registered|exists/i.test(e2.message) ? `${email} já tinha login e foi vinculado.` : `Convite enviado para ${email}.` });
}

export async function removerAcesso(form: FormData) {
  const { supabase } = await exigirAdmin();
  const back = `/admin/proprietarios/${String(form.get("proprietario_id"))}`;
  const { error } = await supabase.from("proprietario_acessos").delete().eq("id", String(form.get("id")));
  if (error) voltar(back, { erro: error.message });
  revalidatePath("/admin", "layout");
  voltar(back, { ok: "Acesso removido." });
}

/* ---------- condomínios ---------- */

export async function salvarCondominio(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = texto(form, "id");
  const back = id ? `/admin/condominios/${id}` : "/admin/condominios";
  let novoId = id;
  try {
    const dados = {
      nome: obrigatorio(form, "nome", "Nome"),
      endereco: texto(form, "endereco"),
      cidade: texto(form, "cidade"),
      cotas_padrao: numero(form, "cotas_padrao"),
      regra_padrao: texto(form, "regra_padrao"),
      observacoes: texto(form, "observacoes"),
    };
    if (id) {
      checar((await supabase.from("condominios").update(dados).eq("id", id)).error);
    } else {
      const { data, error } = await supabase.from("condominios").insert(dados).select("id").single();
      checar(error);
      novoId = data!.id;
    }
  } catch (e) {
    voltar(back, { erro: mensagem(e) });
  }
  revalidatePath("/admin", "layout");
  voltar(`/admin/condominios/${novoId}`, { ok: "Condomínio salvo." });
}

export async function excluirCondominio(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const { error } = await supabase.from("condominios").delete().eq("id", id);
  if (error) voltar(`/admin/condominios/${id}`, { erro: "Não foi possível excluir: " + error.message });
  revalidatePath("/admin", "layout");
  voltar("/admin/condominios", { ok: "Condomínio excluído. Os imóveis dele viraram avulsos." });
}

/* ---------- imóveis ---------- */

export async function salvarImovel(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = texto(form, "id");
  const back = id ? `/admin/imoveis/${id}` : "/admin/imoveis/novo";
  let novoId = id;
  try {
    const condominio_id = texto(form, "condominio_id");
    const endereco = texto(form, "endereco");
    if (!condominio_id && !endereco) throw new Error("Imóvel avulso precisa de endereço.");

    const donos = form.getAll("proprietario_id").map(String);
    const pcts = form.getAll("percentual").map((v) => Number(String(v).replace(",", ".")));
    const vinculos = donos
      .map((pid, i) => ({ proprietario_id: pid, percentual: pcts[i] }))
      .filter((v) => v.proprietario_id);
    if (!vinculos.length) throw new Error("Escolha pelo menos um proprietário.");
    if (new Set(vinculos.map((v) => v.proprietario_id)).size !== vinculos.length) throw new Error("Proprietário repetido na lista.");
    if (vinculos.some((v) => !(v.percentual > 0))) throw new Error("Informe o percentual de cada proprietário.");
    const soma = vinculos.reduce((a, v) => a + v.percentual, 0);
    if (Math.abs(soma - 100) > 0.01) throw new Error(`Os percentuais somam ${soma}%. Precisam somar 100%.`);

    const status = String(form.get("status") ?? "vazio");
    const dados = {
      condominio_id,
      identificacao: obrigatorio(form, "identificacao", "Identificação"),
      endereco,
      tipo: texto(form, "tipo"),
      status,
      cotas: numero(form, "cotas") ?? 1,
      aluguel_pedido: numero(form, "aluguel_pedido"),
      seguro_incendio_mensal: numero(form, "seguro_incendio_mensal"),
      taxa_adm_pct: numero(form, "taxa_adm_pct") ?? 10,
      motivo_indisponivel: status === "indisponivel" ? texto(form, "motivo_indisponivel") : null,
      observacoes: texto(form, "observacoes"),
      condominio_pago_por: form.get("condominio_pago_por") === "proprietario" ? "proprietario" : "imobiliaria",
    };
    if (id) {
      checar((await supabase.from("imoveis").update(dados).eq("id", id)).error);
    } else {
      const { data, error } = await supabase.from("imoveis").insert(dados).select("id").single();
      checar(error);
      novoId = data!.id;
    }
    checar((await supabase.from("imovel_proprietarios").delete().eq("imovel_id", novoId!)).error);
    checar((await supabase.from("imovel_proprietarios").insert(vinculos.map((v) => ({ ...v, imovel_id: novoId })))).error);
  } catch (e) {
    voltar(back, { erro: mensagem(e) });
  }
  revalidatePath("/admin", "layout");
  voltar(`/admin/imoveis/${novoId}`, { ok: "Imóvel salvo." });
}

export async function excluirImovel(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const { error } = await supabase.from("imoveis").delete().eq("id", id);
  if (error) voltar(`/admin/imoveis/${id}`, { erro: "Não foi possível excluir: " + error.message });
  revalidatePath("/admin", "layout");
  voltar("/admin/imoveis", { ok: "Imóvel excluído." });
}

/* ---------- contratos ---------- */

export async function salvarContrato(form: FormData) {
  const { supabase } = await exigirAdmin();
  const imovel_id = String(form.get("imovel_id"));
  const id = texto(form, "id");
  const back = `/admin/imoveis/${imovel_id}`;
  try {
    const aluguel = numero(form, "aluguel");
    if (aluguel == null) throw new Error('Preencha o campo "Aluguel".');
    const dados = {
      imovel_id,
      inquilino: obrigatorio(form, "inquilino", "Inquilino"),
      inquilino_contato: texto(form, "inquilino_contato"),
      aluguel,
      inicio: obrigatorio(form, "inicio", "Início"),
      fim: obrigatorio(form, "fim", "Fim"),
      dia_vencimento: numero(form, "dia_vencimento"),
      aviso_saida_em: texto(form, "aviso_saida_em"),
      entrega_chaves_prevista: texto(form, "entrega_chaves_prevista"),
      observacoes: texto(form, "observacoes"),
    };
    if (dados.fim < dados.inicio) throw new Error("O fim do contrato é anterior ao início.");
    if (id) {
      checar((await supabase.from("contratos").update(dados).eq("id", id)).error);
    } else {
      checar((await supabase.from("contratos").insert({ ...dados, ativo: true })).error);
    }
    // status do imóvel acompanha o contrato
    const status = dados.aviso_saida_em || dados.entrega_chaves_prevista ? "devolucao" : "locado";
    checar((await supabase.from("imoveis").update({ status }).eq("id", imovel_id)).error);
  } catch (e) {
    voltar(back, { erro: mensagem(e) });
  }
  revalidatePath("/admin", "layout");
  voltar(back, { ok: "Contrato salvo." });
}

export async function encerrarContrato(form: FormData) {
  const { supabase } = await exigirAdmin();
  const imovel_id = String(form.get("imovel_id"));
  const id = String(form.get("id"));
  const back = `/admin/imoveis/${imovel_id}`;
  try {
    checar((await supabase.from("contratos").update({ ativo: false }).eq("id", id)).error);
    checar((await supabase.from("imoveis").update({ status: "vazio" }).eq("id", imovel_id)).error);
  } catch (e) {
    voltar(back, { erro: mensagem(e) });
  }
  revalidatePath("/admin", "layout");
  voltar(back, { ok: "Contrato encerrado. Imóvel marcado como vazio." });
}

/* ---------- renovação (fase 3) ---------- */

/** Encerra o contrato atual e abre o novo com as datas e o valor combinados. */
export async function registrarRenovacao(form: FormData) {
  const { supabase } = await exigirAdmin();
  const imovel_id = String(form.get("imovel_id"));
  const id = String(form.get("contrato_id"));
  const back = `/admin/imoveis/${imovel_id}`;
  try {
    const aluguel = numero(form, "aluguel");
    if (aluguel == null || aluguel <= 0) throw new Error('Preencha o campo "Novo aluguel".');
    const inicio = obrigatorio(form, "inicio", "Novo início");
    const fim = obrigatorio(form, "fim", "Novo fim");
    if (fim < inicio) throw new Error("O fim do contrato é anterior ao início.");
    const { data: atual, error } = await supabase.from("contratos").select("*").eq("id", id).eq("ativo", true).single();
    checar(error);
    checar((await supabase.from("contratos").update({ ativo: false }).eq("id", id)).error);
    const novo = await supabase.from("contratos").insert({
      imovel_id, inquilino: atual.inquilino, inquilino_contato: atual.inquilino_contato, aluguel, inicio, fim,
      dia_vencimento: atual.dia_vencimento, ativo: true, observacoes: texto(form, "observacoes") ?? atual.observacoes,
    });
    if (novo.error) {
      await supabase.from("contratos").update({ ativo: true }).eq("id", id);
      checar(novo.error);
    }
    checar((await supabase.from("renovacoes").update({ concluida_em: new Date().toISOString() }).eq("contrato_id", id)).error);
    checar((await supabase.from("imoveis").update({ status: "locado" }).eq("id", imovel_id)).error);
  } catch (e) {
    voltar(back, { erro: mensagem(e) });
  }
  const aluguel = numero(form, "aluguel")!, fim = String(form.get("fim"));
  after(() => avisos.renovacaoRegistrada(imovel_id, `contrato renovado até ${data(fim)}, aluguel de ${BRL(aluguel)}.`));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(back, { ok: "Contrato renovado." });
}

/** Proprietário não quer renovar: o imóvel entra em devolução com entrega das chaves no fim do contrato. */
export async function registrarNaoRenovacao(form: FormData) {
  const { supabase } = await exigirAdmin();
  const imovel_id = String(form.get("imovel_id"));
  const id = String(form.get("contrato_id"));
  const back = `/admin/imoveis/${imovel_id}`;
  try {
    const { data: atual, error } = await supabase.from("contratos").select("fim, entrega_chaves_prevista").eq("id", id).eq("ativo", true).single();
    checar(error);
    checar((await supabase.from("contratos").update({ entrega_chaves_prevista: atual!.entrega_chaves_prevista ?? atual!.fim }).eq("id", id)).error);
    checar((await supabase.from("renovacoes").update({ concluida_em: new Date().toISOString() }).eq("contrato_id", id)).error);
    checar((await supabase.from("imoveis").update({ status: "devolucao" }).eq("id", imovel_id)).error);
  } catch (e) {
    voltar(back, { erro: mensagem(e) });
  }
  after(() => avisos.renovacaoRegistrada(imovel_id, "registramos que o contrato não será renovado. O imóvel entra em devolução e avisaremos o inquilino."));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(back, { ok: "Não renovação registrada. Imóvel em devolução." });
}
