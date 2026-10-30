import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularRepasses, mesDe, type DescontoRepasse, type ImovelRepasse } from "@/lib/repasse";

type ImRow = {
  id: string; identificacao: string; endereco: string | null; taxa_adm_pct: number; seguro_incendio_mensal: number | null;
  condominios: { nome: string } | null;
  imovel_proprietarios: { proprietario_id: string; percentual: number }[];
  contratos: { id: string; aluguel: number; inicio: string; fim: string; inquilino: string }[];
};
type ItemRow = { id: string; proprietario_id: string; imovel_id: string; valor: number; taxa_adm: number; despesas: { descricao: string; status: string } };

/** Prévia do repasse do mês para todos os proprietários (cliente admin). */
export async function calcularPrevia(supabase: SupabaseClient, competencia: string) {
  const { ini, fim } = mesDe(competencia);
  const [{ data: im }, { data: it }] = await Promise.all([
    supabase.from("imoveis")
      .select("id, identificacao, endereco, taxa_adm_pct, seguro_incendio_mensal, condominios(nome), imovel_proprietarios(proprietario_id, percentual), contratos(id, aluguel, inicio, fim, inquilino)")
      .lte("contratos.inicio", fim).gte("contratos.fim", ini),
    supabase.from("despesa_itens").select("id, proprietario_id, imovel_id, valor, taxa_adm, despesas!inner(descricao, status)")
      .eq("decisao", "desconto").is("repasse_id", null).eq("despesas.status", "enviada"),
  ]);
  const imoveis: ImovelRepasse[] = ((im ?? []) as unknown as ImRow[]).map((r) => ({
    id: r.id,
    nome: r.condominios ? `${r.condominios.nome} · ${r.identificacao}` : [r.endereco, r.identificacao].filter(Boolean).join(" · "),
    taxaPct: Number(r.taxa_adm_pct),
    seguro: r.seguro_incendio_mensal != null ? Number(r.seguro_incendio_mensal) : null,
    donos: r.imovel_proprietarios.map((d) => ({ proprietarioId: d.proprietario_id, percentual: Number(d.percentual) })),
    contratos: r.contratos.map((c) => ({ ...c, aluguel: Number(c.aluguel) })),
  }));
  const descontos: DescontoRepasse[] = ((it ?? []) as unknown as ItemRow[]).map((i) => ({
    itemId: i.id, proprietarioId: i.proprietario_id, imovelId: i.imovel_id, descricao: i.despesas.descricao, valor: Number(i.valor), taxaAdm: Number(i.taxa_adm),
  }));
  return calcularRepasses(competencia, imoveis, descontos);
}

/** "2026-11" do mês corrente, ou o informado se for válido. */
export const competenciaOu = (mes?: string) => (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : new Date().toISOString().slice(0, 7));
