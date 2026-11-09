import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contrato, Imovel, StatusImovel } from "@/lib/types";

export type ImovelPortal = {
  id: string;
  nome: string;
  condominioId: string | null;
  status: StatusImovel;
  contratoId: string | null;
  percentual: number;
  aluguel: number | null;      // do contrato ativo, ou o pedido se vazio
  fim: string | null;
  entregaChaves: string | null;
  inquilino: string | null;
  motivo: string | null;
};
export type CondominioPortal = { id: string | null; nome: string; endereco: string };

type Row = Imovel & { contratos: Contrato[]; imovel_proprietarios: { percentual: number; proprietario_id: string }[] };

/** Imóveis do proprietário logado. O RLS já restringe ao que é dele. */
export async function carregarPortal(supabase: SupabaseClient, proprietarioIds: string[]) {
  const [{ data: rows }, { data: condos }] = await Promise.all([
    supabase.from("imoveis").select("*, contratos(*), imovel_proprietarios(percentual, proprietario_id)").order("identificacao"),
    supabase.from("condominios").select("id, nome, endereco").order("nome"),
  ]);
  const imoveis: ImovelPortal[] = ((rows ?? []) as unknown as Row[]).map((i) => {
    const c = i.contratos.find((x) => x.ativo);
    // soma das partes dos cadastros deste login (ex.: o dono e a holding dele)
    const pct = i.imovel_proprietarios.filter((v) => proprietarioIds.includes(v.proprietario_id)).reduce((a, v) => a + Number(v.percentual), 0);
    return {
      id: i.id,
      nome: i.condominio_id ? i.identificacao : [i.endereco, i.identificacao].filter(Boolean).join(" · "),
      condominioId: i.condominio_id,
      status: i.status,
      contratoId: c?.id ?? null,
      percentual: pct || 100,
      aluguel: c ? Number(c.aluguel) : i.aluguel_pedido != null ? Number(i.aluguel_pedido) : null,
      fim: c?.fim ?? null,
      entregaChaves: c?.entrega_chaves_prevista ?? null,
      inquilino: c?.inquilino ?? null,
      motivo: i.motivo_indisponivel,
    };
  });
  const condominios: CondominioPortal[] = [
    ...(condos ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string, endereco: (c.endereco as string) ?? "" })),
    { id: null, nome: "Imóveis avulsos", endereco: "Sem condomínio" },
  ];
  return { imoveis, condominios };
}
