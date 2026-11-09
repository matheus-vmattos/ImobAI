import type { SupabaseClient } from "@supabase/supabase-js";
import { situacao, type Decisao, type Situacao, type StatusReembolso, type TipoDespesa } from "@/lib/types";

type ItemRow = {
  id: string; imovel_id: string; cotas: number | null; percentual_dono: number; valor: number; taxa_adm: number;
  decisao: Decisao | null; comentario: string | null; reembolso: StatusReembolso | null; reembolso_confirmado_em: string | null;
  respondido_em: string | null; repassado_em: string | null;
  responsavel: string; decidido_auto: boolean; cobranca_id: string | null; cobrancas: { status: string } | null;
  imoveis: { identificacao: string; endereco: string | null };
  despesas: {
    id: string; descricao: string; tipo: TipoDespesa; competencia: string | null; valor_total: number; regra: string; divisor: number | null;
    prazo: string | null; enviada_em: string | null; pdf_path: string | null; cobra_taxa_adm: boolean;
    condominio_id: string | null; condominios: { nome: string } | null;
  };
};

/** Uma despesa do ponto de vista do proprietário: soma dos itens dele (pode ter várias unidades). */
export type DespesaPortal = {
  id: string; descricao: string; tipo: TipoDespesa; competencia: string | null; valorTotal: number;
  condominioId: string | null; onde: string; regraTxt: string; prazo: string | null; enviadaEm: string | null; temPdf: boolean;
  unidades: { imovelId: string; nome: string; valor: number }[];
  valor: number; taxa: number; total: number;
  situacao: Situacao; comentario: string | null; confirmadoEm: string | null; respondidoEm: string | null;
};

export async function carregarDespesas(supabase: SupabaseClient) {
  const { data } = await supabase.from("despesa_itens")
    .select("*, cobrancas(status), imoveis(identificacao, endereco), despesas(id, descricao, tipo, competencia, valor_total, regra, divisor, prazo, enviada_em, pdf_path, cobra_taxa_adm, condominio_id, condominios(nome))");
  const rows = (data ?? []) as unknown as ItemRow[];
  const porDespesa = new Map<string, ItemRow[]>();
  rows.forEach((r) => porDespesa.set(r.despesas.id, [...(porDespesa.get(r.despesas.id) ?? []), r]));

  const despesas: DespesaPortal[] = [...porDespesa.values()].map((todos) => {
    // o que é do inquilino ou pago direto não soma na parte do proprietário
    const doDono = todos.filter((i) => i.responsavel === "proprietario");
    const its = doDono.length ? doDono : todos;
    const d = its[0].despesas;
    const valor = its.reduce((a, i) => a + Number(i.valor), 0);
    const taxa = its.reduce((a, i) => a + Number(i.taxa_adm), 0);
    const n = its.length;
    const q = Number(its[0].cotas);
    const regraTxt = d.regra === "integral" ? "Imóvel inteiro"
      : d.regra === "cotas" ? `${n > 1 ? `${n} × ` : ""}${q} de ${Number(d.divisor)} cotas`
      : d.regra === "percentual" ? `${n > 1 ? `${n} × ` : ""}${q}% da conta` : "Valor fixo por unidade";
    const pct = Number(its[0].percentual_dono);
    return {
      id: d.id, descricao: d.descricao, tipo: d.tipo, competencia: d.competencia, valorTotal: Number(d.valor_total),
      condominioId: d.condominio_id,
      onde: d.condominios?.nome ?? [its[0].imoveis.endereco, its[0].imoveis.identificacao].filter(Boolean).join(" · "),
      regraTxt: regraTxt + (pct < 100 ? ` · sua parte ${pct}%` : "") + (taxa > 0 ? " + taxa adm." : ""),
      prazo: d.prazo, enviadaEm: d.enviada_em, temPdf: !!d.pdf_path,
      unidades: its.map((i) => ({ imovelId: i.imovel_id, nome: i.imoveis.identificacao, valor: Number(i.valor) + Number(i.taxa_adm) })),
      valor, taxa, total: valor + taxa,
      situacao: situacao(its[0]), comentario: its[0].comentario, confirmadoEm: its[0].reembolso_confirmado_em, respondidoEm: its[0].respondido_em,
    };
  }).sort((a, b) => (b.enviadaEm ?? "").localeCompare(a.enviadaEm ?? ""));

  const emAberto = (d: DespesaPortal) => d.situacao === "aguardando";
  /** itens de desconto ainda não repassados, por imóvel (para o extrato) */
  const descontosPorImovel = (imovelId: string) =>
    rows.filter((r) => r.imovel_id === imovelId && r.decisao === "desconto" && r.responsavel === "proprietario" && !r.repassado_em)
      .map((r) => ({ descricao: r.despesas.descricao, valor: Number(r.valor) + Number(r.taxa_adm) }));

  return { despesas, pendentes: despesas.filter(emAberto), historico: despesas.filter((d) => !emAberto(d)), descontosPorImovel };
}
