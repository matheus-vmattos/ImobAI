import type { SupabaseClient } from "@supabase/supabase-js";
import { periodoDaSemana, totalCobranca, type LinhaCobranca } from "@/lib/contaCorrente";
import { hojeSP } from "@/lib/format";

/** Operações da cobrança semanal. Recebem um cliente com permissão de escrita
 *  (admin logado ou service role no cron), depois de checado quem pediu. */

const centavos = (n: number) => Math.round(n * 100) / 100;
const somaDias = (iso: string, d: number) => new Date(new Date(iso + "T12:00:00Z").getTime() + d * 864e5).toISOString().slice(0, 10);

export type Config = { favorecido: string | null; banco: string | null; pix: string | null; abono_ate: number; cobranca_dia: number; cobranca_prazo: number; repasse_dia: number; controla_alugueis: boolean };
export async function lerConfig(db: SupabaseClient): Promise<Config> {
  const { data } = await db.from("config").select("*").maybeSingle();
  return { favorecido: null, banco: null, pix: null, abono_ate: 5, cobranca_dia: 1, cobranca_prazo: 7, repasse_dia: 10, controla_alugueis: false, ...(data ?? {}) } as Config;
}

/** A imobiliária controla aqui se o inquilino pagou? Desligado (padrão): o recebimento fica no ERP,
 *  o portal mostra só o valor do aluguel e o repasse usa o valor do contrato. */
export async function controlaAlugueis(db: SupabaseClient) {
  const { data } = await db.from("config").select("controla_alugueis").maybeSingle();
  return !!data?.controla_alugueis;
}

type ItemPend = {
  id: string; proprietario_id: string; valor: number; taxa_adm: number;
  proprietarios: { nome: string; pagador_id: string | null };
  imoveis: { identificacao: string; endereco: string | null; condominios: { nome: string } | null };
  despesas: { id: string; descricao: string; pdf_path: string | null; status: string };
};

/** Gera a cobrança de cada pagador com o que está pendente (contas decididas para a cobrança semanal e ajustes).
 *  Depois usa o crédito que o pagador já tenha. Devolve as cobranças criadas. */
export async function gerarCobrancas(db: SupabaseClient, emissao = hojeSP(), soPagador?: string, userId?: string) {
  const cfg = await lerConfig(db);
  const { inicio, fim } = periodoDaSemana(emissao);
  const [{ data: its }, { data: ajs }] = await Promise.all([
    db.from("despesa_itens")
      .select("id, proprietario_id, valor, taxa_adm, proprietarios!inner(nome, pagador_id), imoveis(identificacao, endereco, condominios(nome)), despesas!inner(id, descricao, pdf_path, status)")
      .eq("decisao", "reembolso").eq("responsavel", "proprietario").is("cobranca_id", null).eq("despesas.status", "enviada"),
    db.from("ajustes").select("id, pagador_id, descricao, valor").is("cobranca_id", null),
  ]);
  const grupos = new Map<string, { linhas: LinhaCobranca[]; itens: string[]; ajustes: string[] }>();
  const de = (g: string) => { if (!grupos.has(g)) grupos.set(g, { linhas: [], itens: [], ajustes: [] }); return grupos.get(g)!; };
  // uma linha por conta e proprietário (a conta rateada em 20 unidades vira uma linha com "20 unidades")
  const porConta = new Map<string, ItemPend[]>();
  for (const i of (its ?? []) as unknown as ItemPend[]) {
    const k = `${i.proprietarios.pagador_id ?? i.proprietario_id}|${i.despesas.id}|${i.proprietario_id}`;
    porConta.set(k, [...(porConta.get(k) ?? []), i]);
  }
  for (const [k, lista] of porConta) {
    const i = lista[0];
    const g = de(k.split("|")[0]);
    const lugar = i.imoveis.condominios?.nome ?? i.imoveis.endereco;
    g.linhas.push({
      tipo: "despesa", ref: lista.map((x) => x.id).join(","), descricao: i.despesas.descricao, despesaId: i.despesas.id, temPdf: !!i.despesas.pdf_path,
      onde: [lugar, lista.length > 1 ? `${lista.length} unidades` : i.imoveis.identificacao].filter(Boolean).join(" · "),
      proprietario: i.proprietarios.nome, valor: centavos(lista.reduce((a, x) => a + Number(x.valor) + Number(x.taxa_adm), 0)),
    });
    g.itens.push(...lista.map((x) => x.id));
  }
  for (const a of ajs ?? []) {
    const g = de(a.pagador_id as string);
    g.linhas.push({ tipo: "ajuste", ref: a.id as string, descricao: a.descricao as string, onde: "Ajuste", proprietario: "", valor: Number(a.valor) });
    g.ajustes.push(a.id as string);
  }
  const criadas: string[] = [];
  for (const [pagador, g] of grupos) {
    if (soPagador && pagador !== soPagador) continue;
    let total = totalCobranca(g.linhas);
    if (total <= 0 && !g.itens.length) continue;      // só crédito solto: espera a próxima conta
    let sobraCredito = 0;
    if (total < 0) {
      // crédito maior que as contas: zera esta cobrança e leva a sobra para a próxima
      sobraCredito = total;
      g.linhas.push({ tipo: "ajuste", ref: "credito", descricao: "Crédito que passa para a próxima cobrança", onde: "Ajuste", proprietario: "", valor: -total });
      total = 0;
    }
    // uma transação só no banco: cria a cobrança, prende contas e ajustes, leva a sobra e usa o crédito
    const { data: id, error } = await db.rpc("emitir_cobranca", {
      p_pagador: pagador, p_inicio: inicio, p_fim: fim, p_vencimento: somaDias(emissao, cfg.cobranca_prazo), p_total: total,
      p_linhas: g.linhas, p_itens: g.itens, p_ajustes: g.ajustes, p_sobra: sobraCredito, p_user: userId ?? null,
    });
    if (error) throw new Error(error.message);
    criadas.push(id as string);
  }
  return criadas;
}

type Aberta = { id: string; vencimento: string; emitida_em: string; total: number; pago: number; abonado: number; descontado: number };
const saldoDe = (c: Aberta) => centavos(Number(c.total) - Number(c.pago) - Number(c.abonado) - Number(c.descontado));

export async function cobrancasAbertas(db: SupabaseClient, pagador: string) {
  const { data } = await db.from("cobrancas").select("id, vencimento, emitida_em, total, pago, abonado, descontado")
    .eq("pagador_id", pagador).eq("status", "aberta").order("vencimento");
  return ((data ?? []) as Aberta[]).map((c) => ({ ...c, saldo: saldoDe(c) }));
}

/** Imobiliária confere o pagamento: confirma o valor que caiu na conta, distribui nas cobranças (da mais antiga
 *  para a mais nova), abona a diferença pequena se `abonar` e guarda a sobra como crédito.
 *  Roda numa transação só no banco (função confirmar_pagamento). */
export async function confirmarPagamento(db: SupabaseClient, pagamentoId: string, valor: number, abonar: boolean, userId?: string) {
  const { data, error } = await db.rpc("confirmar_pagamento", { p_pagamento: pagamentoId, p_valor: centavos(valor), p_abonar: abonar, p_user: userId ?? null });
  if (error) throw new Error(error.message);
  const r = data as { alocado: number; credito: number; abonado: number };
  return { alocado: Number(r.alocado), credito: Number(r.credito), abonado: Number(r.abonado) };
}

/** Lança um ajuste para a próxima cobrança (positivo: o pagador deve; negativo: crédito). */
export async function lancarAjuste(db: SupabaseClient, pagador: string, descricao: string, valor: number, userId?: string, itemId?: string) {
  const { error } = await db.from("ajustes").insert({ pagador_id: pagador, descricao, valor: centavos(valor), created_by: userId ?? null, despesa_item_id: itemId ?? null });
  if (error) throw new Error(error.message);
}

/** Conta que já foi cobrada e foi corrigida ou cancelada: devolve como crédito na próxima cobrança. */
export async function estornarItens(db: SupabaseClient, itemIds: string[], motivo: string, userId?: string) {
  if (!itemIds.length) return 0;
  const { data: ja } = await db.from("ajustes").select("id").in("despesa_item_id", itemIds).limit(1);
  if (ja?.length) throw new Error("Esta conta já foi estornada.");
  const { data } = await db.from("despesa_itens").select("id, valor, taxa_adm, cobranca_id, proprietarios(pagador_id, id), despesas(descricao)").in("id", itemIds).not("cobranca_id", "is", null).order("id");
  // um crédito por conta e pagador (a linha "20 unidades" vira um estorno só)
  const grupos = new Map<string, { pagador: string; descricao: string; valor: number; item: string }>();
  for (const i of (data ?? []) as unknown as { id: string; valor: number; taxa_adm: number; proprietarios: { id: string; pagador_id: string | null }; despesas: { descricao: string } }[]) {
    const pagador = i.proprietarios.pagador_id ?? i.proprietarios.id;
    const k = `${pagador}|${i.despesas.descricao}`;
    const g = grupos.get(k) ?? { pagador, descricao: i.despesas.descricao, valor: 0, item: i.id };
    g.valor += Number(i.valor) + Number(i.taxa_adm);
    grupos.set(k, g);
  }
  let n = 0;
  for (const g of grupos.values()) {
    await lancarAjuste(db, g.pagador, `Estorno: ${g.descricao} (${motivo})`, -g.valor, userId, g.item);
    n++;
  }
  return n;
}
