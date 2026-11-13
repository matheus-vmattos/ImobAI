import type { SupabaseClient } from "@supabase/supabase-js";

export type DonoRateio = { proprietarioId: string; nome: string; percentual: number };
export type UnidadeForm = { id: string; rotulo: string; cotas: number; taxa: number; donos: DonoRateio[] };
export type CondominioForm = { id: string; nome: string; cotasPadrao: number | null; regraPadrao: string | null; unidades: UnidadeForm[] };

type Row = {
  id: string; identificacao: string; endereco: string | null; cotas: number; taxa_adm_pct: number; condominio_id: string | null;
  imovel_proprietarios: { percentual: number; proprietarios: { id: string; nome: string } }[];
};

/** Imóveis com donos e condomínios, para o formulário e para recalcular o rateio no servidor. */
export async function carregarCarteira(supabase: SupabaseClient) {
  const [{ data: im }, { data: cs }] = await Promise.all([
    supabase.from("imoveis").select("id, identificacao, endereco, cotas, taxa_adm_pct, condominio_id, imovel_proprietarios(percentual, proprietarios(id, nome))").order("identificacao"),
    supabase.from("condominios").select("id, nome, cotas_padrao, regra_padrao").order("nome"),
  ]);
  const unidade = (r: Row): UnidadeForm => ({
    id: r.id,
    rotulo: r.condominio_id ? r.identificacao : [r.endereco, r.identificacao].filter(Boolean).join(" · "),
    cotas: Number(r.cotas),
    taxa: Number(r.taxa_adm_pct),
    donos: r.imovel_proprietarios.map((v) => ({ proprietarioId: v.proprietarios.id, nome: v.proprietarios.nome, percentual: Number(v.percentual) })),
  });
  const rows = (im ?? []) as unknown as Row[];
  const condominios: CondominioForm[] = (cs ?? []).map((c) => ({
    id: c.id, nome: c.nome,
    cotasPadrao: c.cotas_padrao != null ? Number(c.cotas_padrao) : null,
    regraPadrao: c.regra_padrao,
    unidades: rows.filter((r) => r.condominio_id === c.id).map(unidade),
  }));
  const imoveis = rows.map((r) => ({ ...unidade(r), condominio: condominios.find((c) => c.id === r.condominio_id)?.nome ?? null }));
  return { condominios, imoveis };
}
