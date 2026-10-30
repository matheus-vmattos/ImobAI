import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contrato, Imovel, StatusImovel } from "@/lib/types";

export type ImovelPortal = {
  id: string;
  nome: string;
  condominioId: string | null;
  status: StatusImovel;
  percentual: number;
  aluguel: number | null;      // do contrato ativo, ou o pedido se vazio
  fim: string | null;
  entregaChaves: string | null;
  inquilino: string | null;
  motivo: string | null;
};
export type CondominioPortal = { id: string | null; nome: string; endereco: string };

type Row = Imovel & { contratos: Contrato[]; imovel_proprietarios: { percentual: number; proprietarios: { user_id: string | null } }[] };

/** Imóveis do proprietário logado. O RLS já restringe ao que é dele. */
export async function carregarPortal(supabase: SupabaseClient, userId: string) {
  const [{ data: rows }, { data: condos }] = await Promise.all([
    supabase.from("imoveis").select("*, contratos(*), imovel_proprietarios(percentual, proprietarios(user_id))").order("identificacao"),
    supabase.from("condominios").select("id, nome, endereco").order("nome"),
  ]);
  const imoveis: ImovelPortal[] = ((rows ?? []) as unknown as Row[]).map((i) => {
    const c = i.contratos.find((x) => x.ativo);
    const meu = i.imovel_proprietarios.find((v) => v.proprietarios?.user_id === userId);
    return {
      id: i.id,
      nome: i.condominio_id ? i.identificacao : [i.endereco, i.identificacao].filter(Boolean).join(" · "),
      condominioId: i.condominio_id,
      status: i.status,
      percentual: Number(meu?.percentual ?? 100),
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
