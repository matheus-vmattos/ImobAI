import type { SupabaseClient } from "@supabase/supabase-js";
import { situacaoAluguel, vencimentoDoMes, type AluguelMes } from "@/lib/aluguel";
import { diasAte, hojeSP, mesSP } from "@/lib/format";
import { controlaAlugueis } from "@/lib/cobrancas";
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
  /** aluguel deste mês: pago, a receber ou atrasado (só para imóvel com contrato) */
  aluguelMes: AluguelMes | null;
  /** há quantos dias está na situação atual (ex.: vago há 40 dias) */
  diasNaSituacao: number;
};
export type CondominioPortal = { id: string | null; nome: string; endereco: string };

type Row = Imovel & { status_desde: string } & { contratos: Contrato[]; imovel_proprietarios: { percentual: number; proprietario_id: string }[] };

/** Imóveis do proprietário logado. O RLS já restringe ao que é dele. */
export async function carregarPortal(supabase: SupabaseClient, proprietarioIds: string[]) {
  const hoje = hojeSP(), mes = mesSP();
  const controla = await controlaAlugueis(supabase);
  const [{ data: rows }, { data: condos }, { data: als }] = await Promise.all([
    supabase.from("imoveis").select("*, contratos(*), imovel_proprietarios(percentual, proprietario_id)").order("identificacao"),
    supabase.from("condominios").select("id, nome, endereco").order("nome"),
    controla ? supabase.from("alugueis").select("contrato_id, vencimento, valor, recebido_em, valor_recebido").eq("competencia", `${mes}-01`) : Promise.resolve({ data: null }),
  ]);
  const aluguelDe = new Map((als ?? []).map((a) => [a.contrato_id as string, a]));
  const imoveis: ImovelPortal[] = ((rows ?? []) as unknown as Row[]).map((i) => {
    const c = i.contratos.find((x) => x.ativo);
    // soma das partes dos cadastros deste login (ex.: o dono e a holding dele)
    const pct = i.imovel_proprietarios.filter((v) => proprietarioIds.includes(v.proprietario_id)).reduce((a, v) => a + Number(v.percentual), 0);
    // sem linha lançada ainda, vale o vencimento do contrato; contrato que começa depois deste mês não conta
    const al = c ? aluguelDe.get(c.id) : null;
    const aluguelMes = !controla || !c || c.inicio.slice(0, 7) > mes ? null : situacaoAluguel(al
      ? { vencimento: al.vencimento, valor: Number(al.valor), recebidoEm: al.recebido_em, valorRecebido: al.valor_recebido == null ? null : Number(al.valor_recebido) }
      : { vencimento: vencimentoDoMes(mes, c.dia_vencimento), valor: Number(c.aluguel), recebidoEm: null, valorRecebido: null }, hoje);
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
      aluguelMes,
      diasNaSituacao: Math.max(0, -diasAte(i.status_desde)),
    };
  });
  const condominios: CondominioPortal[] = [
    ...(condos ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string, endereco: (c.endereco as string) ?? "" })),
    { id: null, nome: "Imóveis avulsos", endereco: "Sem condomínio" },
  ];
  return { imoveis, condominios };
}
