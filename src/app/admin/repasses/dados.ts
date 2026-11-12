import { hojeSP, mesSP } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularRepasses, mesDe, type DescontoRepasse, type ImovelRepasse } from "@/lib/repasse";
import { garantirAlugueis } from "../alugueis/dados";

type ImRow = {
  id: string; identificacao: string; endereco: string | null; taxa_adm_pct: number; seguro_incendio_mensal: number | null;
  condominios: { nome: string } | null;
  imovel_proprietarios: { proprietario_id: string; percentual: number }[];
  contratos: { id: string; aluguel: number; inicio: string; fim: string; inquilino: string }[];
};
type ItemRow = { id: string; proprietario_id: string; imovel_id: string; valor: number; taxa_adm: number; despesas: { descricao: string; status: string } };

/** Prévia do repasse do mês para todos os proprietários (cliente admin). */
export async function calcularPrevia(supabase: SupabaseClient, competencia: string, opts: { garantir?: boolean } = {}) {
  const { ini, fim } = mesDe(competencia);
  if (opts.garantir !== false) await garantirAlugueis(supabase, competencia);
  const [{ data: im }, { data: it }, { data: al }] = await Promise.all([
    supabase.from("imoveis")
      .select("id, identificacao, endereco, taxa_adm_pct, seguro_incendio_mensal, condominios(nome), imovel_proprietarios(proprietario_id, percentual), contratos(id, aluguel, inicio, fim, inquilino)")
      .lte("contratos.inicio", fim).gte("contratos.fim", ini),
    supabase.from("despesa_itens").select("id, proprietario_id, imovel_id, valor, taxa_adm, despesas!inner(descricao, status)")
      .eq("decisao", "desconto").eq("responsavel", "proprietario").is("repasse_id", null).eq("despesas.status", "enviada"),
    supabase.from("alugueis").select("contrato_id, valor_recebido").eq("competencia", ini),
  ]);
  // só entra no repasse o aluguel que o inquilino pagou
  const recebido = new Map((al ?? []).map((a) => [a.contrato_id as string, a.valor_recebido == null ? null : Number(a.valor_recebido)]));
  const imoveis: ImovelRepasse[] = ((im ?? []) as unknown as ImRow[]).map((r) => ({
    id: r.id,
    nome: r.condominios ? `${r.condominios.nome} · ${r.identificacao}` : [r.endereco, r.identificacao].filter(Boolean).join(" · "),
    taxaPct: Number(r.taxa_adm_pct),
    seguro: r.seguro_incendio_mensal != null ? Number(r.seguro_incendio_mensal) : null,
    donos: r.imovel_proprietarios.map((d) => ({ proprietarioId: d.proprietario_id, percentual: Number(d.percentual) })),
    contratos: r.contratos.map((c) => ({ ...c, aluguel: Number(c.aluguel), recebido: recebido.has(c.id) ? recebido.get(c.id)! : null })),
  }));
  const descontos: DescontoRepasse[] = ((it ?? []) as unknown as ItemRow[]).map((i) => ({
    itemId: i.id, proprietarioId: i.proprietario_id, imovelId: i.imovel_id, descricao: i.despesas.descricao, valor: Number(i.valor), taxaAdm: Number(i.taxa_adm),
  }));
  const previa = calcularRepasses(competencia, imoveis, descontos).map((r) => ({ ...r, cobrancas: [] as { id: string; saldo: number }[] }));
  return incluirCobrancasVencidas(supabase, previa);
}

/** Proprietário que aceita: cobrança vencida e não paga sai do repasse (item "Cobrança ... em aberto"). */
async function incluirCobrancasVencidas<T extends ReturnType<typeof calcularRepasses>[number] & { cobrancas: { id: string; saldo: number }[] }>(supabase: SupabaseClient, previa: T[]) {
  const ids = previa.map((r) => r.proprietarioId);
  if (!ids.length) return previa;
  const hoje = hojeSP();
  const [{ data: cs }, { data: ps }] = await Promise.all([
    supabase.from("cobrancas").select("id, pagador_id, inicio, fim, total, pago, abonado, descontado").eq("status", "aberta").lt("vencimento", hoje).in("pagador_id", ids),
    supabase.from("proprietarios").select("id, desconta_vencidas").in("id", ids),
  ]);
  const aceita = new Set((ps ?? []).filter((p) => p.desconta_vencidas).map((p) => p.id as string));
  const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  for (const c of cs ?? []) {
    const r = previa.find((x) => x.proprietarioId === c.pagador_id);
    if (!r || !aceita.has(c.pagador_id)) continue;
    const saldo = Math.round((Number(c.total) - Number(c.pago) - Number(c.abonado) - Number(c.descontado)) * 100) / 100;
    if (saldo <= 0) continue;
    r.linhas.push({ imovelId: "", imovel: "Cobranças", tipo: "cobranca", descricao: `Cobrança ${dm(c.inicio)} a ${dm(c.fim)} vencida e não paga`, valor: -saldo });
    r.cobrancas.push({ id: c.id, saldo });
    r.despesas = Math.round((r.despesas + saldo) * 100) / 100;
    r.liquido = Math.round((r.liquido - saldo) * 100) / 100;
  }
  return previa;
}

/** "2026-11" do mês corrente, ou o informado se for válido. */
export const competenciaOu = (mes?: string) => (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : mesSP());
