import type { SupabaseClient } from "@supabase/supabase-js";
import { alocar, fechamento, periodoDaSemana, totalCobranca, type LinhaCobranca } from "@/lib/contaCorrente";

/** Operações da cobrança semanal. Recebem um cliente com permissão de escrita
 *  (admin logado ou service role no cron), depois de checado quem pediu. */

const centavos = (n: number) => Math.round(n * 100) / 100;
const hoje = () => new Date().toISOString().slice(0, 10);
const somaDias = (iso: string, d: number) => new Date(new Date(iso + "T12:00:00Z").getTime() + d * 864e5).toISOString().slice(0, 10);

export type Config = { favorecido: string | null; banco: string | null; pix: string | null; abono_ate: number; cobranca_dia: number; cobranca_prazo: number };
export async function lerConfig(db: SupabaseClient): Promise<Config> {
  const { data } = await db.from("config").select("*").maybeSingle();
  return { favorecido: null, banco: null, pix: null, abono_ate: 5, cobranca_dia: 1, cobranca_prazo: 7, ...(data ?? {}), } as Config;
}

type ItemPend = {
  id: string; proprietario_id: string; valor: number; taxa_adm: number;
  proprietarios: { nome: string; pagador_id: string | null };
  imoveis: { identificacao: string; endereco: string | null; condominios: { nome: string } | null };
  despesas: { id: string; descricao: string; pdf_path: string | null; status: string };
};

/** Gera a cobrança de cada pagador com o que está pendente (contas decididas para a cobrança semanal e ajustes).
 *  Depois usa o crédito que o pagador já tenha. Devolve as cobranças criadas. */
export async function gerarCobrancas(db: SupabaseClient, emissao = hoje(), soPagador?: string) {
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
  for (const i of (its ?? []) as unknown as ItemPend[]) {
    const pagador = i.proprietarios.pagador_id ?? i.proprietario_id;
    const g = de(pagador);
    g.linhas.push({
      tipo: "despesa", ref: i.id, descricao: i.despesas.descricao, despesaId: i.despesas.id, temPdf: !!i.despesas.pdf_path,
      onde: [i.imoveis.condominios?.nome ?? i.imoveis.endereco, i.imoveis.identificacao].filter(Boolean).join(" · "),
      proprietario: i.proprietarios.nome, valor: centavos(Number(i.valor) + Number(i.taxa_adm)),
    });
    g.itens.push(i.id);
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
    const { data: c, error } = await db.from("cobrancas").insert({
      pagador_id: pagador, inicio, fim, vencimento: somaDias(emissao, cfg.cobranca_prazo), total, linhas: g.linhas,
      status: total <= 0 ? "paga" : "aberta", quitada_em: total <= 0 ? new Date().toISOString() : null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    if (g.itens.length) await db.from("despesa_itens").update({ cobranca_id: c!.id }).in("id", g.itens);
    if (g.ajustes.length) await db.from("ajustes").update({ cobranca_id: c!.id }).in("id", g.ajustes);
    if (sobraCredito < 0) await lancarAjuste(db, pagador, "Crédito da cobrança anterior", sobraCredito);
    await aplicarCredito(db, pagador);
    criadas.push(c!.id);
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

/** Pagamentos confirmados com valor ainda não usado (crédito do pagador). */
async function creditos(db: SupabaseClient, pagador: string) {
  const { data } = await db.from("pagamentos").select("id, valor_confirmado, data, alocacoes(valor)").eq("pagador_id", pagador).eq("status", "confirmado").order("data");
  return ((data ?? []) as unknown as { id: string; valor_confirmado: number; alocacoes: { valor: number }[] }[])
    .map((p) => ({ id: p.id, livre: centavos(Number(p.valor_confirmado) - p.alocacoes.reduce((a, x) => a + Number(x.valor), 0)) }))
    .filter((p) => p.livre > 0);
}

/** Usa o valor de um pagamento (ou o crédito livre) nas cobranças em aberto, da mais antiga para a mais nova. */
async function usar(db: SupabaseClient, pagamentoId: string, livre: number, pagador: string) {
  const abertas = await cobrancasAbertas(db, pagador);
  const { alocacoes, sobra } = alocar(abertas.map((c) => ({ id: c.id, vencimento: c.vencimento, emitidaEm: c.emitida_em, saldo: c.saldo })), livre);
  for (const a of alocacoes) {
    const c = abertas.find((x) => x.id === a.cobrancaId)!;
    const { data: ja } = await db.from("alocacoes").select("valor").eq("pagamento_id", pagamentoId).eq("cobranca_id", a.cobrancaId).maybeSingle();
    if (ja) await db.from("alocacoes").update({ valor: centavos(Number(ja.valor) + a.valor) }).eq("pagamento_id", pagamentoId).eq("cobranca_id", a.cobrancaId);
    else await db.from("alocacoes").insert({ pagamento_id: pagamentoId, cobranca_id: a.cobrancaId, valor: a.valor });
    const pago = centavos(Number(c.pago) + a.valor);
    const quitada = centavos(c.saldo - a.valor) <= 0;
    await db.from("cobrancas").update({ pago, ...(quitada ? { status: "paga", quitada_em: new Date().toISOString() } : {}) }).eq("id", c.id);
  }
  return { alocacoes, sobra };
}

export async function aplicarCredito(db: SupabaseClient, pagador: string) {
  for (const p of await creditos(db, pagador)) await usar(db, p.id, p.livre, pagador);
}

/** Imobiliária confere o pagamento: confirma o valor que caiu na conta, distribui nas cobranças
 *  e abona a diferença pequena (até o limite da configuração) se `abonar`. */
export async function confirmarPagamento(db: SupabaseClient, pagamentoId: string, valor: number, abonar: boolean) {
  const cfg = await lerConfig(db);
  const { data: p } = await db.from("pagamentos").select("id, pagador_id, status").eq("id", pagamentoId).single();
  if (!p) throw new Error("Pagamento não encontrado.");
  if (p.status === "confirmado") throw new Error("Este pagamento já foi confirmado.");
  if (!(valor > 0)) throw new Error("Informe o valor que caiu na conta.");
  const { error } = await db.from("pagamentos").update({ status: "confirmado", valor_confirmado: centavos(valor), confirmado_em: new Date().toISOString(), motivo_recusa: null }).eq("id", pagamentoId);
  if (error) throw new Error(error.message);
  const { alocacoes, sobra } = await usar(db, pagamentoId, centavos(valor), p.pagador_id);
  // diferença pequena na última cobrança tocada por este pagamento
  let abonado = 0;
  const ultima = alocacoes.at(-1);
  if (ultima && sobra === 0) {
    const [c] = (await cobrancasAbertas(db, p.pagador_id)).filter((x) => x.id === ultima.cobrancaId);
    if (c) {
      const f = fechamento(c.saldo, Number(cfg.abono_ate), abonar);
      if (f.quitada && f.abono > 0) {
        await db.from("cobrancas").update({ abonado: centavos(Number(c.abonado) + f.abono), status: "paga", quitada_em: new Date().toISOString() }).eq("id", c.id);
        abonado = f.abono;
      }
    }
  }
  return { alocado: centavos(alocacoes.reduce((a, x) => a + x.valor, 0)), credito: sobra, abonado };
}

/** Lança um ajuste para a próxima cobrança (positivo: o pagador deve; negativo: crédito). */
export async function lancarAjuste(db: SupabaseClient, pagador: string, descricao: string, valor: number, userId?: string, itemId?: string) {
  const { error } = await db.from("ajustes").insert({ pagador_id: pagador, descricao, valor: centavos(valor), created_by: userId ?? null, despesa_item_id: itemId ?? null });
  if (error) throw new Error(error.message);
}

/** Conta que já foi cobrada e foi corrigida ou cancelada: devolve como crédito na próxima cobrança. */
export async function estornarItens(db: SupabaseClient, itemIds: string[], motivo: string, userId?: string) {
  if (!itemIds.length) return 0;
  const { data } = await db.from("despesa_itens").select("id, valor, taxa_adm, cobranca_id, proprietarios(pagador_id, id), despesas(descricao)").in("id", itemIds).not("cobranca_id", "is", null);
  let n = 0;
  for (const i of (data ?? []) as unknown as { id: string; valor: number; taxa_adm: number; proprietarios: { id: string; pagador_id: string | null }; despesas: { descricao: string } }[]) {
    await lancarAjuste(db, i.proprietarios.pagador_id ?? i.proprietarios.id, `Estorno: ${i.despesas.descricao} (${motivo})`, -(Number(i.valor) + Number(i.taxa_adm)), userId, i.id);
    n++;
  }
  return n;
}
