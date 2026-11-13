import type { SupabaseClient } from "@supabase/supabase-js";
import { mesDe } from "@/lib/repasse";

/** Cria (se faltar) a linha de aluguel do mês de cada contrato que vale no mês. */
export async function garantirAlugueis(supabase: SupabaseClient, competencia: string) {
  const { ini, fim } = mesDe(competencia);
  const { data: cs } = await supabase.from("contratos").select("id, aluguel, dia_vencimento, inicio, fim").lte("inicio", fim).gte("fim", ini);
  const ultimo = Number(fim.slice(8, 10));
  const linhas = (cs ?? []).map((c) => ({
    contrato_id: c.id as string, competencia: ini, valor: Number(c.aluguel),
    vencimento: `${competencia}-${String(Math.min(Number(c.dia_vencimento ?? 10), ultimo)).padStart(2, "0")}`,
  }));
  if (linhas.length) await supabase.from("alugueis").upsert(linhas, { onConflict: "contrato_id,competencia", ignoreDuplicates: true });
}

export type AluguelLinha = {
  id: string; contrato_id: string; vencimento: string; valor: number; recebido_em: string | null; valor_recebido: number | null;
  contratos: { inquilino: string; imovel_id: string; imoveis: { identificacao: string; endereco: string | null; condominios: { nome: string } | null } };
};

export async function carregarAlugueis(supabase: SupabaseClient, competencia: string) {
  await garantirAlugueis(supabase, competencia);
  const { data } = await supabase.from("alugueis")
    .select("id, contrato_id, vencimento, valor, recebido_em, valor_recebido, contratos!inner(inquilino, imovel_id, imoveis!inner(identificacao, endereco, condominios(nome)))")
    .eq("competencia", `${competencia}-01`).order("vencimento");
  return (data ?? []) as unknown as AluguelLinha[];
}
