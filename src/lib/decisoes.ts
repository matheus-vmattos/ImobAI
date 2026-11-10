import type { SupabaseClient } from "@supabase/supabase-js";
import { decisaoAutomatica, responsavelPor, TIPOS_FIXOS } from "@/lib/contaCorrente";

/** Responsável de cada parte da conta, pelo tipo e pela situação de cada imóvel. */
export async function responsaveis(supabase: SupabaseClient, tipo: string, imovelIds: string[]) {
  const { data } = await supabase.from("imoveis").select("id, status, condominio_pago_por").in("id", imovelIds);
  return new Map((data ?? []).map((i) => [i.id as string, responsavelPor(tipo, i.status, i.condominio_pago_por)]));
}

type ItemRow = {
  id: string; proprietario_id: string; valor: number; taxa_adm: number; responsavel: string; decisao: string | null;
  proprietarios: { aprova_ate: number; forma_padrao: "cobranca" | "repasse" };
  despesas: { requer_aprovacao: boolean; recorrente_id: string | null; status: string; tipo: string };
};

/** Ao enviar a despesa: o que não precisa de resposta já entra decidido pela forma padrão do proprietário.
 *  Devolve os proprietários que ainda precisam responder (para o aviso por e-mail). */
export async function aplicarDecisoesAutomaticas(supabase: SupabaseClient, despesaId: string) {
  const { data } = await supabase.from("despesa_itens")
    .select("id, proprietario_id, valor, taxa_adm, responsavel, decisao, proprietarios(aprova_ate, forma_padrao), despesas(requer_aprovacao, recorrente_id, status, tipo)")
    .eq("despesa_id", despesaId);
  const itens = (data ?? []) as unknown as ItemRow[];
  const porDono = new Map<string, ItemRow[]>();
  itens.forEach((i) => porDono.set(i.proprietario_id, [...(porDono.get(i.proprietario_id) ?? []), i]));
  const precisam: string[] = [];
  for (const [dono, its] of porDono) {
    const pendentes = its.filter((i) => !i.decisao && i.responsavel === "proprietario");
    if (!pendentes.length) continue;
    const p = its[0].proprietarios, d = its[0].despesas;
    const dec = decisaoAutomatica({
      responsavel: "proprietario", requerAprovacao: d.requer_aprovacao, recorrente: !!d.recorrente_id || TIPOS_FIXOS.includes(d.tipo),
      valorDoProprietario: pendentes.reduce((a, i) => a + Number(i.valor) + Number(i.taxa_adm), 0),
      aprovaAte: Number(p.aprova_ate), formaPadrao: p.forma_padrao,
    });
    if (!dec) { precisam.push(dono); continue; }
    await supabase.from("despesa_itens").update({ decisao: dec, decidido_auto: true, respondido_em: new Date().toISOString() })
      .in("id", pendentes.map((i) => i.id));
  }
  return precisam;
}
